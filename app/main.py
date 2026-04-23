"""FastAPI entry point.

    cd backend
    uvicorn app.main:app --reload --port 8000

The frontend then POSTs JSON to /analyze. Artifacts must already exist
under ARTIFACTS_DIR (default: backend/artifacts/) -- run `python -m
scripts.train` first.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from dreamcatcher.pipeline import DreamAnalyzer


logging.basicConfig(level=logging.INFO)
log = logging.getLogger("dreamcatcher.api")

ARTIFACTS_DIR = Path(
    os.environ.get(
        "DREAMCATCHER_ARTIFACTS",
        str(Path(__file__).resolve().parents[1] / "artifacts"),
    )
)

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("DREAMCATCHER_CORS_ORIGINS", "*").split(",")
    if o.strip()
]


class DreamIn(BaseModel):
    text: str = Field(..., min_length=1, description="Raw dream narrative from the user.")
    k_similar: int = Field(3, ge=0, le=20, description="How many similar dreams to return.")


class PointOut(BaseModel):
    x: float
    y: float


class PointOut3D(BaseModel):
    x: float
    y: float
    z: float


class SimilarOut(BaseModel):
    text: str
    archetype: str
    cluster_id: int
    similarity: float


class AnalyzeOut(BaseModel):
    archetype: str
    cluster_id: int
    emotions: dict[str, float]
    point: PointOut
    similar: list[SimilarOut]
    plot_point_3d: PointOut3D | None = None
    cluster: int | None = None
    archetype_name: str | None = None
    emotion: dict[str, Any] | None = None


state: dict[str, Any] = {"analyzer": None}


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not ARTIFACTS_DIR.exists():
        raise RuntimeError(
            f"Artifacts directory not found: {ARTIFACTS_DIR}. "
            "Run `python -m scripts.train` first."
        )
    log.info("loading DreamAnalyzer from %s ...", ARTIFACTS_DIR)
    analyzer = DreamAnalyzer.load(ARTIFACTS_DIR)
    log.info("warming up models ...")
    analyzer.warmup()
    state["analyzer"] = analyzer
    log.info("ready.")
    yield
    state["analyzer"] = None


app = FastAPI(title="DreamCatcher API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_analyzer() -> DreamAnalyzer:
    analyzer = state.get("analyzer")
    if analyzer is None:
        raise HTTPException(status_code=503, detail="model not loaded yet")
    return analyzer


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "model_loaded": state.get("analyzer") is not None}


@app.get("/plot-data-3d")
def plot_data_3d() -> list[dict[str, Any]]:
    analyzer = _get_analyzer()
    if analyzer.corpus_meta is None or analyzer.corpus_embeddings is None:
        raise HTTPException(status_code=503, detail="corpus data not loaded")
    
    try:
        xy_2d = analyzer.umap_2d.transform(analyzer.corpus_embeddings)
        xy_10d = analyzer.umap_10d.transform(analyzer.corpus_embeddings)
        
        points = []
        for idx, row in analyzer.corpus_meta.iterrows():
            cluster_id = int(row.get("cluster_embed", -1))
            archetype_name = analyzer.archetype_names.get(cluster_id, "Unknown")
            
            points.append({
                "x3": float(xy_2d[idx, 0]),
                "y3": float(xy_2d[idx, 1]),
                "z3": float(xy_10d[idx, 2]),
                "cluster_embed": cluster_id,
                "archetype_name": archetype_name,
                "hover_text": str(row.get("text", ""))[:100],  # First 100 chars of dream text
            })
        
        return points
    except Exception as e:
        log.exception("plot_data_3d failed")
        raise HTTPException(status_code=500, detail=f"failed to generate plot data: {e}") from e


@app.post("/analyze")
def analyze(body: DreamIn) -> dict[str, Any]:
    analyzer = _get_analyzer()
    try:
        result = analyzer.analyze(body.text, k_similar=body.k_similar)
        label = "Mixed / reflective"
        confidence = 0.0
        if isinstance(result.get("emotions"), dict) and result["emotions"]:
            label, confidence = max(result["emotions"].items(), key=lambda item: item[1])
        result["cluster"] = result.get("cluster_id", -1)
        result["archetype_name"] = result.get("archetype", "Unknown")
        result["emotion"] = {
            "label": label,
            "confidence": float(confidence),
            "signals": [label],
        }
        result["plot_point_2d"] = result.get("point")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        log.exception("analyze failed")
        raise HTTPException(status_code=500, detail=f"analysis failed: {e}") from e
