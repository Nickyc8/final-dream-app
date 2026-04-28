from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer


MANUAL_NAMES = {
    46: "Grief & Loss",
    42: "Overwhelm / Control Loss",
    78: "Identity & Exposure",
}

TOPIC_RULES: list[tuple[str, set[str]]] = [
    ("Teeth & Body Anxiety", {"teeth", "tooth", "dentist", "mouth"}),
    ("Politics & Public Figures", {"president", "trump", "obama", "clinton", "election"}),
    ("Spiritual Teachers & Devotion", {"krishna", "srila", "ramesvara", "temple", "guru"}),
    ("Angels & Marriage", {"angel", "angels", "married", "wedding"}),
    ("Family & Home", {"mom", "mother", "father", "dad", "sister", "brother", "house", "home"}),
    ("Smoking & Substances", {"pot", "marijuana", "smoke", "smoking", "cigarettes", "joint"}),
    ("Hospital & Care", {"hospital", "doctor", "nurse", "patient", "patients", "unit"}),
    ("Storms & Tornadoes", {"tornado", "storm", "basement", "wind"}),
    ("Horses & Riding", {"horse", "horses", "riding", "ride", "farm"}),
    ("Travel & Transit", {"bus", "airport", "ticket", "trip", "plane", "train"}),
    ("Church & Creative Retreats", {"church", "retreat", "art", "studio"}),
    ("Rivers & Crossings", {"bridge", "river", "crossing", "crossed", "rope"}),
    ("Aliens & Other Worlds", {"alien", "aliens", "human", "humans"}),
    ("Pregnancy & Babies", {"baby", "pregnant", "birth", "labor", "babies", "child"}),
    ("Games & Play", {"game", "games", "playing", "card", "board"}),
    ("Sports & Competition", {"ball", "basketball", "football", "soccer", "team", "players"}),
    ("Sexuality & Exposure", {"sex", "sexual", "penis", "nude", "bed"}),
    ("Driving & Roads", {"car", "driving", "road", "truck", "train"}),
    ("Work & Jobs", {"work", "job", "working", "boss", "workers", "office"}),
    ("Chase & Escape", {"chased", "chasing", "running", "run", "kill", "away"}),
    ("Violence & Weapons", {"gun", "shoot", "shot", "shooting", "hostage", "weapon"}),
    ("Flying & Falling", {"flying", "fly", "plane", "airplane", "falling", "pilot"}),
    ("Death & Deceased Family", {"died", "dead", "deceased", "death", "mother", "father"}),
    ("Faith & Sacred Encounters", {"jesus", "god", "pastor", "temple", "church"}),
    ("Nightmares & Waking", {"nightmare", "nightmares", "woke", "wake", "scared"}),
    ("Romance & Relationships", {"boyfriend", "girlfriend", "date", "friend", "girl"}),
    ("Dream Recall", {"remember", "dreaming", "wake", "usually", "recall"}),
    ("School & Classrooms", {"class", "school", "students", "teacher", "room"}),
    ("Water & Beaches", {"water", "beach", "boat", "lake", "swimming", "waves", "shore"}),
    ("Cities & Boats", {"seattle", "vancouver", "boat", "ship", "lake"}),
]

GENERIC_WORDS = {
    "dream",
    "dreams",
    "dreamed",
    "dreamt",
    "like",
    "went",
    "going",
    "said",
    "got",
    "came",
    "don",
    "think",
    "remember",
    "forgotten",
    "really",
    "thing",
    "things",
    "people",
    "person",
    "man",
    "woman",
    "room",
}


def title_term(term: str) -> str:
    small_words = {"and", "or", "of", "the", "in", "to"}
    words = term.replace("_", " ").split()
    return " ".join(word if word in small_words else word.capitalize() for word in words)


def rule_name(top_terms: list[str]) -> str | None:
    tokens = set()
    for term in top_terms:
        tokens.update(term.split())

    scores = Counter()
    for label, keywords in TOPIC_RULES:
        scores[label] = len(tokens & keywords)

    if not scores:
        return None

    label, score = scores.most_common(1)[0]
    return label if score > 0 else None


def fallback_name(top_terms: list[str]) -> str:
    useful_terms = [
        term
        for term in top_terms
        if term not in GENERIC_WORDS and not any(part in GENERIC_WORDS for part in term.split())
    ]
    if not useful_terms:
        useful_terms = [term for term in top_terms if term not in GENERIC_WORDS]

    if len(useful_terms) >= 2:
        return f"{title_term(useful_terms[0])} & {title_term(useful_terms[1])}"
    if useful_terms:
        return title_term(useful_terms[0])
    return "Unlabeled Dream Theme"


def build_cluster_names(corpus_meta: Path) -> dict[str, str]:
    df = pd.read_parquet(corpus_meta)
    df = df[df["cluster_embed"] != -1].copy()
    cluster_docs = (
        df.groupby("cluster_embed")["clean_text"]
        .apply(lambda values: " ".join(values.astype(str).head(500)))
        .sort_index()
    )

    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        min_df=3,
        max_features=8000,
    )
    matrix = vectorizer.fit_transform(cluster_docs)
    terms = vectorizer.get_feature_names_out()

    names: dict[str, str] = {}
    for row_index, cluster_id in enumerate(cluster_docs.index):
        if int(cluster_id) in MANUAL_NAMES:
            names[str(int(cluster_id))] = MANUAL_NAMES[int(cluster_id)]
            continue

        row = matrix[row_index].toarray().ravel()
        top_indices = row.argsort()[-12:][::-1]
        top_terms = [terms[index] for index in top_indices if row[index] > 0]
        names[str(int(cluster_id))] = rule_name(top_terms) or fallback_name(top_terms)

    return names


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate readable names for DreamCatcher clusters")
    parser.add_argument(
        "--artifacts",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "artifacts",
        help="Path to backend artifacts directory.",
    )
    args = parser.parse_args()

    corpus_meta = args.artifacts / "corpus_meta.parquet"
    output_path = args.artifacts / "archetype_names.json"
    names = build_cluster_names(corpus_meta)

    output_path.write_text(json.dumps(names, indent=2) + "\n")
    print(f"Wrote {len(names)} cluster names to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
