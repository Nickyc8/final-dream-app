from __future__ import annotations

import re
from functools import lru_cache

import nltk
from nltk.corpus import stopwords


@lru_cache(maxsize=1)
def _stopwords() -> frozenset[str]:
    try:
        words = stopwords.words("english")
    except LookupError:
        nltk.download("stopwords", quiet=True)
        words = stopwords.words("english")
    return frozenset(words)


def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"http\S+|www\.\S+", " ", text)
    text = re.sub(r"[^a-z\s']", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    sw = _stopwords()
    tokens = [w for w in text.split() if w not in sw and len(w) > 2]
    return " ".join(tokens)
