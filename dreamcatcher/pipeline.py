from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import hdbscan
import numpy as np
import pandas as pd
from sklearn.preprocessing import normalize

from dreamcatcher.artifacts import ArtifactPaths, load_json, load_npy, load_pickle
from dreamcatcher.preprocess import clean_text


EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
EMOTION_MODEL_NAME = "j-hartmann/emotion-english-distilroberta-base"
DEFAULT_OTHER_LABEL = "Other / Unlabeled"


@dataclass
class AnalyzeResult:
    archetype: str
    cluster_id: int
    emotions: dict[str, float]
    point: dict[str, float]
    similar: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "archetype": self.archetype,
            "cluster_id": self.cluster_id,
            "emotions": self.emotions,
            "point": self.point,
            "similar": self.similar,
        }


class DreamAnalyzer:
    """Loads trained artifacts + heavy models once; .analyze() per request."""

    def __init__(
        self,
        embed_model,
        umap_10d,
        umap_2d,
        clusterer,
        archetype_names: dict[int, str],
        corpus_embeddings: np.ndarray | None,
        corpus_meta: pd.DataFrame | None,
        emotion_model,
    ) -> None:
        self.embed_model = embed_model
        self.umap_10d = umap_10d
        self.umap_2d = umap_2d
        self.clusterer = clusterer
        self.archetype_names = archetype_names
        self.corpus_embeddings = corpus_embeddings
        self.corpus_meta = corpus_meta
        self.emotion_model = emotion_model

    @classmethod
    def load(cls, artifacts_dir: str | Path) -> "DreamAnalyzer":
        from sentence_transformers import SentenceTransformer
        from transformers import pipeline

        paths = ArtifactPaths(Path(artifacts_dir))

        umap_10d = load_pickle(paths.umap_10d)
        umap_2d = load_pickle(paths.umap_2d)
        clusterer = load_pickle(paths.hdbscan)

        archetype_raw = load_json(paths.archetype_names)
        archetype_names = {int(k): v for k, v in archetype_raw.items()}

        corpus_embeddings = (
            load_npy(paths.corpus_embeddings) if paths.corpus_embeddings.exists() else None
        )
        corpus_meta = (
            pd.read_parquet(paths.corpus_meta) if paths.corpus_meta.exists() else None
        )

        embed_model = SentenceTransformer(EMBED_MODEL_NAME)
        emotion_model = pipeline(
            "text-classification",
            model=EMOTION_MODEL_NAME,
            top_k=None,
        )

        return cls(
            embed_model=embed_model,
            umap_10d=umap_10d,
            umap_2d=umap_2d,
            clusterer=clusterer,
            archetype_names=archetype_names,
            corpus_embeddings=corpus_embeddings,
            corpus_meta=corpus_meta,
            emotion_model=emotion_model,
        )

    def warmup(self) -> None:
        """Force lazy weight downloads + first inference cost up-front."""
        try:
            self.analyze("I had a strange dream last night about flying over the ocean.")
        except Exception:
            pass

    def _embed(self, text: str) -> np.ndarray:
        cleaned = clean_text(text)
        if not cleaned:
            cleaned = text.lower().strip() or " "
        vec = self.embed_model.encode(
            [cleaned],
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return normalize(vec)

    def _archetype(self, vec_10d: np.ndarray) -> tuple[int, str]:
        labels, _ = hdbscan.approximate_predict(self.clusterer, vec_10d)
        cluster_id = int(labels[0])
        name = self.archetype_names.get(cluster_id, DEFAULT_OTHER_LABEL)
        return cluster_id, name

    def _point_2d(self, vec: np.ndarray) -> dict[str, float]:
        xy = self.umap_2d.transform(vec)
        return {"x": float(xy[0, 0]), "y": float(xy[0, 1])}

    def _emotions(self, text: str) -> dict[str, float]:
        results = self.emotion_model(text[:512])[0]
        return {r["label"]: float(r["score"]) for r in results}

    def _similar(self, vec: np.ndarray, k: int = 3) -> list[dict[str, Any]]:
        if self.corpus_embeddings is None or self.corpus_meta is None or k <= 0:
            return []
        sims = self.corpus_embeddings @ vec[0]
        if sims.size == 0:
            return []
        top_idx = np.argpartition(-sims, min(k, sims.size - 1))[:k]
        top_idx = top_idx[np.argsort(-sims[top_idx])]
        out: list[dict[str, Any]] = []
        for i in top_idx:
            row = self.corpus_meta.iloc[int(i)]
            cluster_id = int(row.get("cluster_embed", -1))
            out.append(
                {
                    "text": str(row.get("text", "")),
                    "archetype": self.archetype_names.get(cluster_id, DEFAULT_OTHER_LABEL),
                    "cluster_id": cluster_id,
                    "similarity": float(sims[int(i)]),
                }
            )
        return out

    def analyze(self, text: str, k_similar: int = 3) -> dict[str, Any]:
        if not isinstance(text, str) or not text.strip():
            raise ValueError("text must be a non-empty string")

        vec = self._embed(text)
        vec_10d = self.umap_10d.transform(vec)
        cluster_id, archetype = self._archetype(vec_10d)
        point = self._point_2d(vec)
        emotions = self._emotions(text)
        similar = self._similar(vec, k=k_similar)

        return AnalyzeResult(
            archetype=archetype,
            cluster_id=cluster_id,
            emotions=emotions,
            point=point,
            similar=similar,
        ).to_dict()
