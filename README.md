# DreamCatcher Backend

A thin FastAPI service that wraps the model pipeline from `DTSC.ipynb` so the
frontend can submit a dream and get back its archetype, emotion profile, and
position on the Dream Universe map.

## Layout

```
backend/
├── pyproject.toml
├── dreamcatcher/        # reusable Python package (notebook logic, refactored)
│   ├── preprocess.py    # clean_text() from notebook cell 13
│   ├── pipeline.py      # DreamAnalyzer.load() / .analyze(text)
│   └── artifacts.py     # joblib save/load helpers
├── scripts/
│   └── train.py         # one-time: fit UMAP + HDBSCAN, dump artifacts/
├── app/
│   └── main.py          # FastAPI: /health, POST /analyze
└── artifacts/           # generated, git-ignored
```

## Quick start

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .

# 1) one-time: train the artifacts from Data/dreamsearch.csv (slow: minutes)
python -m scripts.train

# 2) serve the API
uvicorn app.main:app --reload --port 8000
```

## Calling it from the frontend

```js
const res = await fetch("http://localhost:8000/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: userDream }),
});
const { archetype, cluster_id, emotions, point, similar } = await res.json();
```

## Endpoints

- `GET /health` — `{ "ok": true }`
- `POST /analyze` body `{ "text": "..." }` →
  ```json
  {
    "archetype": "Grief & Loss",
    "cluster_id": 46,
    "emotions": { "sadness": 0.34, "fear": 0.12, "...": 0.0 },
    "point": { "x": 1.23, "y": -4.56 },
    "similar": [{ "text": "...", "archetype": "Grief & Loss" }]
  }
  ```

## Notes

- The pipeline mirrors `DTSC.ipynb` cells 1–33 + 48–50 exactly. New artifacts
  must be regenerated with `scripts/train.py` whenever the notebook's modeling
  parameters change.
- HDBSCAN is fit with `prediction_data=True` so new dreams can be assigned via
  `hdbscan.approximate_predict` without refitting the model.
- First request after boot is slow because the SentenceTransformer and emotion
  models download/warm up; the API does a dummy warm-up call on startup.
