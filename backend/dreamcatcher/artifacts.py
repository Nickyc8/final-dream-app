from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np


UMAP_10D = "umap_10d.joblib"
UMAP_2D = "umap_2d.joblib"
HDBSCAN_CLUSTERER = "hdbscan.joblib"
ARCHETYPE_NAMES = "archetype_names.json"
CORPUS_EMBEDDINGS = "corpus_embeddings.npy"
CORPUS_META = "corpus_meta.parquet"
META_JSON = "meta.json"


@dataclass
class ArtifactPaths:
    root: Path

    @property
    def umap_10d(self) -> Path:
        return self.root / UMAP_10D

    @property
    def umap_2d(self) -> Path:
        return self.root / UMAP_2D

    @property
    def hdbscan(self) -> Path:
        return self.root / HDBSCAN_CLUSTERER

    @property
    def archetype_names(self) -> Path:
        return self.root / ARCHETYPE_NAMES

    @property
    def corpus_embeddings(self) -> Path:
        return self.root / CORPUS_EMBEDDINGS

    @property
    def corpus_meta(self) -> Path:
        return self.root / CORPUS_META

    @property
    def meta(self) -> Path:
        return self.root / META_JSON


def save_pickle(obj: Any, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(obj, path)


def load_pickle(path: Path) -> Any:
    return joblib.load(path)


def save_json(obj: Any, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        json.dump(obj, f, indent=2)


def load_json(path: Path) -> Any:
    with path.open("r") as f:
        return json.load(f)


def save_npy(arr: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    np.save(path, arr)


def load_npy(path: Path) -> np.ndarray:
    return np.load(path)
