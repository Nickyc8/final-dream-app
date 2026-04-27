from __future__ import annotations

import re
from functools import lru_cache

import nltk
from nltk.corpus import stopwords


# @lru_cache(maxsize=1)
# def _stopwords() -> frozenset[str]:
#     try:
#         words = stopwords.words("english")
#     except LookupError:
#         nltk.download("stopwords", quiet=True)
#         words = stopwords.words("english")
#     return frozenset(words)

@lru_cache(maxsize=1)
def _stopwords() -> frozenset[str]:
    words = [
        "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you",
        "your", "yours", "yourself", "yourselves", "he", "him", "his",
        "himself", "she", "her", "hers", "herself", "it", "its", "itself",
        "they", "them", "their", "theirs", "themselves", "what", "which",
        "who", "whom", "this", "that", "these", "those", "am", "is", "are",
        "was", "were", "be", "been", "being", "have", "has", "had", "having",
        "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if",
        "or", "because", "as", "until", "while", "of", "at", "by", "for",
        "with", "about", "against", "between", "into", "through", "during",
        "before", "after", "above", "below", "to", "from", "up", "down",
        "in", "out", "on", "off", "over", "under", "again", "further",
        "then", "once", "here", "there", "when", "where", "why", "how",
        "all", "both", "each", "few", "more", "most", "other", "some",
        "such", "no", "nor", "not", "only", "own", "same", "so", "than",
        "too", "very", "can", "will", "just", "should", "now", "don",
        "won", "didn", "isn", "wasn", "couldn", "hadn", "hasn", "haven",
        "ain", "aren", "doesn", "mightn", "mustn", "needn", "shan",
        "shouldn", "weren", "wouldn", "s", "t", "re", "ve", "ll", "d", "m"
    ]
    return frozenset(words)


def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"http\S+|www\.\S+", " ", text)
    text = re.sub(r"[^a-z\s']", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    sw = _stopwords()
    tokens = [w for w in text.split() if w not in sw and len(w) > 2]
    return " ".join(tokens)
