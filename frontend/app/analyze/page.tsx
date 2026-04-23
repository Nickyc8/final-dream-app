"use client";

import Link from "next/link";
import { useState } from "react";

const LATEST_DREAM_STORAGE_KEY = "dreamcatcher:last-analysis";

export default function AnalyzePage() {
  const [dream, setDream] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<null | {
    input_text: string;
    cluster: number;
    confidence: number;
    archetype_name: string;
    emotion?: {
      label: string;
      confidence: number;
      signals: string[];
    };
    plot_point_2d: {
      x: number;
      y: number;
    };
    plot_point_3d: {
      x: number;
      y: number;
      z: number;
    };
  }>(null);

  async function handleAnalyze() {
    if (!dream.trim()) {
      setError("Please enter a dream first.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dreamText: dream }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      window.localStorage.setItem(
        LATEST_DREAM_STORAGE_KEY,
        JSON.stringify({
          x: data.plot_point_3d.x,
          y: data.plot_point_3d.y,
          z: data.plot_point_3d.z,
          cluster: data.cluster,
          archetypeName: data.archetype_name,
          emotion: data.emotion?.label ?? "Mixed / reflective",
          text: dream,
        })
      );

      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const confidencePercent = result
    ? Math.round(result.confidence <= 1 ? result.confidence * 100 : result.confidence)
    : 0;

  const displayArchetype =
    result?.archetype_name === "Other / Unlabeled"
      ? null
      : result?.archetype_name;
  const emotionConfidencePercent = result?.emotion
    ? Math.round(result.emotion.confidence * 100)
    : 0;

  return (
    <main className="dream-shell">
      <div className="dream-aurora" aria-hidden="true">
        <span className="orb orb-one" />
        <span className="orb orb-two" />
        <span className="orb orb-three" />
      </div>
      <div className="dream-grid" aria-hidden="true" />

      <section className="dream-card">
        <header className="dream-card-top">
          <p className="dream-kicker">Dream Signal Reader</p>
          <Link href="/" className="dream-back-link">
            Back to Homepage
          </Link>
        </header>

        <h1>Dream Emotion Analyzer</h1>
        <p className="dream-subtitle">
          Share a dream and get a fast emotional read from the analyzer.
        </p>

        <textarea
          value={dream}
          onChange={(e) => setDream(e.target.value)}
          placeholder="Type your dream here..."
          rows={8}
          className="dream-input"
        />

        <button onClick={handleAnalyze} className="dream-button" disabled={loading}>
          {loading ? "Analyzing..." : "Analyze Dream"}
        </button>

        {error && <p className="dream-error">{error}</p>}

        {!error && loading && <p className="dream-loading">Analyzing dream...</p>}

        {result && (
          <div className="dream-result">
            <p className="dream-result-label">You</p>
            <p className="dream-result-copy">{dream}</p>

            <p className="dream-result-label">Bot</p>
            <p className="dream-result-copy">
              Dominant emotion: <b>{result.emotion?.label ?? "Mixed / reflective"}</b>
              {result.emotion
                ? ` (${emotionConfidencePercent}% signal strength).`
                : "."}
            </p>

            {result.emotion?.signals && result.emotion.signals.length > 0 && (
              <>
                <p className="dream-result-label">Emotion Signals</p>
                <p className="dream-result-copy">
                  {result.emotion.signals.join(", ")}
                </p>
              </>
            )}

            <p className="dream-result-label">Archetype Match</p>
            <p className="dream-result-copy">
              {displayArchetype ? (
                <>
                  This dream maps most closely to <b>{displayArchetype}</b> (confidence{" "}
                  {confidencePercent}%, cluster {result.cluster}).
                </>
              ) : (
                <>
                  No named archetype match yet. This dream landed in unlabeled cluster{" "}
                  {result.cluster}, so the emotion read above is the clearest result.
                </>
              )}
            </p>

            <Link href="/#dream-universe" className="dream-map-link">
              Show me this dream on the universe map
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
