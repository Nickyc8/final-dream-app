from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

import hdbscan
import numpy as np
import pandas as pd
import umap
from sentence_transformers import SentenceTransformer
from sklearn.preprocessing import normalize

from dreamcatcher.artifacts import (
    ArtifactPaths,
    save_json,
    save_npy,
    save_pickle,
)
from dreamcatcher.preprocess import clean_text


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("train")


EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
MIN_WORDS = 20

MODEL_COLS = [
    "Dream Report ID",
    "Dream Text",
    "Word Count",
    "Participant ID",
    "Dream Date",
    "Age",
    "Gender",
]
RENAME = {
    "Dream Report ID": "dream_id",
    "Dream Text": "text",
    "Word Count": "word_count",
    "Participant ID": "participant_id",
    "Dream Date": "date",
}

ARCHETYPE_NAMES = {
    46: "Grief & Loss",
    42: "Overwhelm / Control Loss",
    78: "Identity & Exposure",
}


def _step(name: str):
    log.info("=== %s ===", name)
    return time.perf_counter()


def _done(name: str, t0: float) -> None:
    log.info("%s done in %.1fs", name, time.perf_counter() - t0)


def load_corpus(data_path: Path) -> pd.DataFrame:
    """Cells 3, 5, 6, 9, 11, 13."""
    t0 = _step(f"loading {data_path}")
    df = pd.read_csv(data_path)
    df_model = df[MODEL_COLS].copy().rename(columns=RENAME)
    df_model = df_model.dropna(subset=["text"])
    df_model = df_model[df_model["word_count"] >= MIN_WORDS].copy()
    df_model["clean_text"] = df_model["text"].astype(str).apply(clean_text)
    df_model = df_model[df_model["clean_text"].str.len() > 0].reset_index(drop=True)
    log.info("kept %d dreams after filtering", len(df_model))
    _done("load_corpus", t0)
    return df_model


def embed_corpus(df_model: pd.DataFrame) -> tuple[SentenceTransformer, np.ndarray]:
    """Cells 25 + 27."""
    t0 = _step(f"embedding {len(df_model)} dreams with {EMBED_MODEL_NAME}")
    model = SentenceTransformer(EMBED_MODEL_NAME)
    embeddings = model.encode(
        df_model["clean_text"].tolist(),
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    embeddings = normalize(embeddings)
    log.info("embeddings shape=%s", embeddings.shape)
    _done("embed_corpus", t0)
    return model, embeddings


def fit_umap_10d(embeddings: np.ndarray) -> tuple[umap.UMAP, np.ndarray]:
    """Cell 29."""
    t0 = _step("fitting UMAP 10D")
    reducer = umap.UMAP(
        n_neighbors=20,
        n_components=10,
        min_dist=0.0,
        metric="cosine",
        random_state=42,
    )
    reduced = reducer.fit_transform(embeddings)
    _done("fit_umap_10d", t0)
    return reducer, reduced


def fit_umap_2d(embeddings: np.ndarray) -> umap.UMAP:
    """Cell 32. Notebook only kept the result; we keep the reducer too."""
    t0 = _step("fitting UMAP 2D")
    reducer = umap.UMAP(
        n_neighbors=20,
        n_components=2,
        min_dist=0.1,
        metric="cosine",
        random_state=42,
    )
    reducer.fit(embeddings)
    _done("fit_umap_2d", t0)
    return reducer


def fit_hdbscan(embeddings_umap: np.ndarray) -> tuple[hdbscan.HDBSCAN, np.ndarray]:
    """Cell 30 + the prediction_data=True flag we need at serve time."""
    t0 = _step("fitting HDBSCAN")
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=25,
        min_samples=5,
        metric="euclidean",
        cluster_selection_method="eom",
        prediction_data=True,
    )
    labels = clusterer.fit_predict(embeddings_umap)
    log.info(
        "found %d clusters (excluding noise=-1)",
        int(np.sum(np.unique(labels) != -1)),
    )
    _done("fit_hdbscan", t0)
    return clusterer, labels


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Train DreamCatcher pipeline artifacts")
    parser.add_argument(
        "--data",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "Data" / "dreamsearch.csv",
        help="Path to dreamsearch.csv (default: ../Data/dreamsearch.csv)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "artifacts",
        help="Output dir for artifacts (default: backend/artifacts/)",
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=0,
        help="If >0, train on a random sample of this many dreams (faster smoke test).",
    )
    args = parser.parse_args(argv)

    if not args.data.exists():
        log.error("data file not found: %s", args.data)
        return 1

    paths = ArtifactPaths(args.out)
    paths.root.mkdir(parents=True, exist_ok=True)

    df_model = load_corpus(args.data)
    if args.sample and args.sample < len(df_model):
        df_model = df_model.sample(args.sample, random_state=42).reset_index(drop=True)
        log.info("subsampled to %d dreams for fast training", len(df_model))

    _embed_model, embeddings = embed_corpus(df_model)

    umap_10d, embeddings_10d = fit_umap_10d(embeddings)
    umap_2d_reducer = fit_umap_2d(embeddings)
    clusterer, labels = fit_hdbscan(embeddings_10d)

    df_model["cluster_embed"] = labels
    xy = umap_2d_reducer.transform(embeddings)
    df_model["x"] = xy[:, 0]
    df_model["y"] = xy[:, 1]

    t0 = _step(f"saving artifacts to {paths.root}")
    save_pickle(umap_10d, paths.umap_10d)
    save_pickle(umap_2d_reducer, paths.umap_2d)
    save_pickle(clusterer, paths.hdbscan)
    save_json({str(k): v for k, v in ARCHETYPE_NAMES.items()}, paths.archetype_names)
    save_npy(embeddings.astype(np.float32), paths.corpus_embeddings)
    df_model[
        ["dream_id", "text", "clean_text", "cluster_embed", "x", "y"]
    ].to_parquet(paths.corpus_meta, index=False)
    save_json(
        {
            "embed_model": EMBED_MODEL_NAME,
            "n_dreams": int(len(df_model)),
            "min_words": MIN_WORDS,
            "umap_10d_components": 10,
            "umap_2d_components": 2,
            "hdbscan_min_cluster_size": 25,
            "hdbscan_min_samples": 5,
        },
        paths.meta,
    )
    _done("save", t0)

    log.info("done. artifacts in %s", paths.root)
    return 0


if __name__ == "__main__":
    sys.exit(main())
