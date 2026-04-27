"use client";

import Link from "next/link";
import {
  type CSSProperties,
  type PointerEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type FocusMode = "matched" | "all";
type ViewMode = "clusters" | "salience";
type EmotionFilter = "matched" | "mix" | string;

type RawUniversePoint = {
  x3: number;
  y3: number;
  z3: number;
  cluster_embed: number;
  archetype_name: string;
  hover_text?: string;
};

type LatestDreamPoint = {
  x: number;
  y: number;
  z: number;
  cluster: number;
  archetypeName: string;
  emotion: string;
  text: string;
};

type UniversePoint = {
  id: string;
  x: number;
  y: number;
  z: number;
  cluster: number;
  archetypeName: string;
  emotion: string;
  hoverText: string;
};

type LatestUniversePoint = UniversePoint;

type LegendItem = {
  label: string;
  color: string;
};

type ClusterLabel = {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  color: string;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  rotationX: number;
  rotationZ: number;
};

type StoryTheme = "emotions" | "mental-health" | "therapy";
type FutureWorkTheme = "archetypes" | "deployment" | "database" | "visualizations";

const stats = [
  { label: "Dream reports", value: "~44,000" },
  { label: "Participants", value: "~16,000" },
  { label: "Average report length", value: "~100 words" },
  { label: "Primary archetype clusters", value: "3" },
];

const pipelineSteps = [
  {
    title: "Data Preparation",
    detail:
      "Dream reports were standardized, short records were removed, and Sleep & Dream data was merged with DreamBank for broader coverage.",
  },
  {
    title: "Embedding",
    detail:
      "Each narrative was encoded into a semantic vector using transformer-based embeddings so meaning, not just keywords, drives grouping.",
  },
  {
    title: "Dimensionality Reduction",
    detail:
      "Reducing dimensionality before clustering exposed fine-grained archetypes that raw embeddings alone did not surface.",
  },
  {
    title: "Density Clustering",
    detail:
      "Density-based clustering uncovered latent archetypes organically without predefined dream labels or hand-built taxonomies.",
  },
  {
    title: "Dream Universe",
    detail:
      "The resulting universe positions dreams by semantic similarity: center as everyday dream space, periphery as emotionally salient narratives.",
  },
];

const impactContent: Record<
  StoryTheme,
  {
    title: string;
    body: string;
  }
> = {
  emotions: {
    title: "Modeling Human Emotions",
    body: "Recurring themes across a large dream corpus provide a data-driven view into collective emotional patterns and subconscious processing.",
  },
  "mental-health": {
    title: "Mental Health Indicators",
    body: "Clustered dream content can surface latent markers of stress and emotional dysregulation without requiring diagnostic labels.",
  },
  therapy: {
    title: "Psychotherapeutic Support",
    body: "Archetype-level context can help clinicians interpret patient dream narratives against empirically grounded thematic structures.",
  },
};

const futureWorksContent: Record<
  FutureWorkTheme,
  {
    tab: string;
    title: string;
    body: string;
  }
> = {
  archetypes: {
    tab: "Archetype Standards",
    title: "Stronger Archetype Standards and Richer Cluster Labels",
    body: "Establish clearer naming criteria and validation guidelines so each cluster is easier to interpret, compare, and reuse in downstream studies.",
  },
  deployment: {
    tab: "Deployment",
    title: "Full-Scale Website Deployment",
    body: "Move from demo mode to a production-ready release with hardened API routes, monitoring, and deployment infrastructure that can support larger traffic.",
  },
  database: {
    tab: "Dream Database",
    title: "Persistent Dream Storage",
    body: "Save user-submitted dreams and analysis results to a database so users can revisit prior insights and track longitudinal dream trends over time.",
  },
  visualizations: {
    tab: "Visualizations",
    title: "More Interactive Visualizations",
    body: "Expand the current visual layer with richer filtering, timeline exploration, and drill-down interactions that make the dream universe more exploratory and intuitive.",
  },
};

const LATEST_DREAM_STORAGE_KEY = "dreamcatcher:last-analysis";

const EMOTION_COLORS: Record<string, string> = {
  Fear: "#fff2a8",
  Sadness: "#93c5fd",
  Anger: "#fb7185",
  Joy: "#86efac",
  Confusion: "#c4b5fd",
  Disgust: "#a3e635",
  "Mixed / reflective": "#f5d0fe",
};

const EMOTION_OPTIONS = [
  "Fear",
  "Sadness",
  "Anger",
  "Joy",
  "Confusion",
  "Disgust",
  "Mixed / reflective",
];

const ARCHETYPE_EMOTIONS: Record<string, string> = {
  "Grief & Loss": "Sadness",
  "Overwhelm / Control Loss": "Fear",
  "Identity & Exposure": "Confusion",
};

const EMOTION_LEXICON: Record<string, string[]> = {
  Fear: [
    "afraid",
    "alarm",
    "anxious",
    "chase",
    "chased",
    "danger",
    "dangerous",
    "dark",
    "die",
    "died",
    "escape",
    "fear",
    "fearful",
    "frightened",
    "hide",
    "hiding",
    "lost",
    "monster",
    "panic",
    "run",
    "running",
    "scared",
    "scream",
    "screaming",
    "threat",
    "trapped",
    "worry",
    "worried",
  ],
  Sadness: [
    "alone",
    "cry",
    "crying",
    "dead",
    "death",
    "despair",
    "grief",
    "guilt",
    "hurt",
    "lonely",
    "loss",
    "lost",
    "miss",
    "missing",
    "mourning",
    "sad",
    "sadness",
    "shame",
    "tears",
    "unhappy",
  ],
  Anger: [
    "angry",
    "argue",
    "argued",
    "attack",
    "attacked",
    "fight",
    "fighting",
    "furious",
    "hate",
    "hit",
    "mad",
    "rage",
    "shout",
    "shouting",
    "yell",
    "yelling",
  ],
  Joy: [
    "beautiful",
    "calm",
    "comfort",
    "comfortable",
    "delight",
    "excited",
    "free",
    "friend",
    "fun",
    "glad",
    "happy",
    "hope",
    "joy",
    "laugh",
    "love",
    "peace",
    "peaceful",
    "pleasant",
    "relief",
    "safe",
    "wonderful",
  ],
  Confusion: ["confused", "forgot", "forgotten", "strange", "unknown", "weird", "where", "why"],
  Disgust: ["blood", "dirty", "disease", "gross", "ill", "sick", "smell", "vomit", "waste"],
};

const MAX_POINTS_BY_FOCUS: Record<FocusMode, number> = {
  matched: 320,
  all: 240,
};

const MIN_UNIVERSE_ZOOM = 0.65;
const MAX_UNIVERSE_ZOOM = 1.85;
const UNIVERSE_ZOOM_SENSITIVITY = 0.0016;

function focusLabel(focus: FocusMode) {
  switch (focus) {
    case "matched":
      return "Dream Neighborhood";
    case "all":
      return "Full Universe";
    default:
      return focus;
  }
}

function viewDescription(view: ViewMode) {
  if (view === "clusters") {
    return "Colors show the dominant emotion assigned to each dream.";
  }

  return "Colors emphasize how far a dream sits from the center of the projection.";
}

function focusDescription(focus: FocusMode, latest: LatestUniversePoint | null) {
  if (focus === "matched") {
    return latest
      ? `Shows the semantic neighborhood your dream landed in: cluster ${latest.cluster}.`
      : "Analyze a dream first to show its matching semantic neighborhood.";
  }

  return "Shows a small sample from the full dataset so the audience can see the larger dream space.";
}

function emotionFilterDescription(filter: EmotionFilter, latest: LatestUniversePoint | null) {
  if (filter === "matched") {
    return latest
      ? `Shows dreams in this neighborhood with the same emotion as yours: ${latest.emotion}.`
      : "Shows dreams with the same emotion as your submitted dream.";
  }
  if (filter === "mix") {
    return "Shows every emotion found inside this same semantic neighborhood.";
  }

  return `Shows only ${filter.toLowerCase()} dreams inside this same neighborhood.`;
}

function pointMatchesFocus(point: UniversePoint, focus: FocusMode) {
  if (focus === "all") {
    return true;
  }
  return true;
}

function pointMatchesLatestCluster(point: UniversePoint, latest: LatestUniversePoint | null) {
  return latest ? point.cluster === latest.cluster : false;
}

function samplePoints(points: UniversePoint[], maxPoints: number) {
  if (points.length <= maxPoints) {
    return points;
  }

  const step = points.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, index) => points[Math.floor(index * step)]);
}

function clampRotationX(value: number) {
  return Math.max(12, Math.min(82, value));
}

function clampUniverseZoom(value: number) {
  return Math.max(MIN_UNIVERSE_ZOOM, Math.min(MAX_UNIVERSE_ZOOM, value));
}

function rotatePlanarPosition(x: number, y: number, rotationDegrees: number) {
  const radians = (rotationDegrees * Math.PI) / 180;
  const centeredX = x - 50;
  const centeredY = y - 50;
  const rotatedX = centeredX * Math.cos(radians) - centeredY * Math.sin(radians);
  const rotatedY = centeredX * Math.sin(radians) + centeredY * Math.cos(radians);

  return {
    x: rotatedX,
    y: rotatedY,
  };
}

function emotionColor(emotion: string) {
  return EMOTION_COLORS[emotion] ?? EMOTION_COLORS["Mixed / reflective"];
}

function inferEmotionLabel(text: string, archetypeName: string) {
  const archetypeEmotion = ARCHETYPE_EMOTIONS[archetypeName];
  if (archetypeEmotion) {
    return archetypeEmotion;
  }

  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  let topEmotion = "Mixed / reflective";
  let topScore = 0;

  for (const [emotion, words] of Object.entries(EMOTION_LEXICON)) {
    const score = words.reduce((total, word) => total + (counts.get(word) ?? 0), 0);
    if (score > topScore) {
      topEmotion = emotion;
      topScore = score;
    }
  }

  return topEmotion;
}

function normalizeValue(value: number, min: number, max: number) {
  if (max === min) {
    return 50;
  }
  return 8 + ((value - min) / (max - min)) * 84;
}

function normalizeUniversePoints(
  rawPoints: RawUniversePoint[],
  latestDream: LatestDreamPoint | null
) {
  if (rawPoints.length === 0 && !latestDream) {
    return { points: [], latest: null };
  }

  const xValues = rawPoints.map((point) => point.x3);
  const yValues = rawPoints.map((point) => point.y3);
  const zValues = rawPoints.map((point) => point.z3);

  if (latestDream) {
    xValues.push(latestDream.x);
    yValues.push(latestDream.y);
    zValues.push(latestDream.z);
  }

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);

  const points = rawPoints.map((point, index) => ({
    id: `dream-${index}`,
    x: normalizeValue(point.x3, minX, maxX),
    y: normalizeValue(point.y3, minY, maxY),
    z: normalizeValue(point.z3, minZ, maxZ),
    cluster: point.cluster_embed,
    archetypeName: point.archetype_name,
    emotion: inferEmotionLabel(point.hover_text ?? "", point.archetype_name),
    hoverText: point.hover_text ?? "Dream report",
  }));

  const latest: LatestUniversePoint | null = latestDream
    ? {
        id: "latest-dream",
        x: normalizeValue(latestDream.x, minX, maxX),
        y: normalizeValue(latestDream.y, minY, maxY),
        z: normalizeValue(latestDream.z, minZ, maxZ),
        cluster: latestDream.cluster,
        archetypeName: latestDream.archetypeName,
        emotion: latestDream.emotion,
        hoverText: latestDream.text,
      }
    : null;

  return { points, latest };
}

function pointColor(point: UniversePoint, viewMode: ViewMode) {
  if (viewMode === "clusters") {
    return emotionColor(point.emotion);
  }

  const distance = Math.hypot(point.x - 50, point.y - 50, point.z - 50);
  const intensity = Math.min(1, distance / 62);
  return `hsl(${210 + intensity * 120} 90% ${72 - intensity * 24}%)`;
}

function buildClusterLabels(points: UniversePoint[]): ClusterLabel[] {
  const grouped = new Map<
    string,
    {
      label: string;
      points: UniversePoint[];
    }
  >();

  for (const point of points) {
    if (point.cluster === -1) {
      continue;
    }

    const label = point.emotion;
    const key = label;
    const group = grouped.get(key);

    if (group) {
      group.points.push(point);
    } else {
      grouped.set(key, { label, points: [point] });
    }
  }

  return Array.from(grouped.entries())
    .sort(([, a], [, b]) => {
      return b.points.length - a.points.length;
    })
    .slice(0, 8)
    .map(([id, group]) => {
      const count = group.points.length;
      const centroid = group.points.reduce(
        (total, point) => ({
          x: total.x + point.x,
          y: total.y + point.y,
          z: total.z + point.z,
        }),
        { x: 0, y: 0, z: 0 }
      );
      const representative = group.points[0];

      return {
        id,
        label: group.label,
        x: centroid.x / count,
        y: centroid.y / count,
        z: centroid.z / count,
        color: emotionColor(representative.emotion),
      };
    });
}

function buildEmotionLegend(points: UniversePoint[], latest: LatestUniversePoint | null) {
  const emotions = new Map<string, string>();

  for (const point of points) {
    emotions.set(point.emotion, emotionColor(point.emotion));
  }

  const items: LegendItem[] = Array.from(emotions.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 6)
    .map(([emotion, color]) => ({
      label: emotion,
      color,
    }));

  if (points.some((point) => point.cluster === -1)) {
    items.push({ label: "Unclustered", color: "#65517f" });
  }

  if (latest) {
    items.push({
      label: `Your dream: ${latest.emotion}`,
      color: emotionColor(latest.emotion),
    });
  }

  return items;
}

function emotionFilterLabel(filter: EmotionFilter, latest: LatestUniversePoint | null) {
  if (filter === "matched") {
    return latest ? `Same Emotion (${latest.emotion})` : "Same Emotion";
  }
  if (filter === "mix") {
    return "All Emotions";
  }
  return filter;
}

function emotionFilterStatusLabel(filter: EmotionFilter, latest: LatestUniversePoint | null) {
  if (filter === "matched") {
    return latest?.emotion.toLowerCase() ?? "matched-emotion";
  }
  if (filter === "mix") {
    return "mixed-emotion";
  }
  return filter.toLowerCase();
}

function buildMatchedClusterSummary(points: UniversePoint[], latest: LatestUniversePoint | null) {
  if (!latest) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const point of points) {
    if (point.cluster === latest.cluster) {
      counts.set(point.emotion, (counts.get(point.emotion) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries()).sort(([, a], [, b]) => b - a);
}

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("clusters");
  const [focusMode, setFocusMode] = useState<FocusMode>("all");
  const [emotionFilter, setEmotionFilter] = useState<EmotionFilter>("matched");
  const [isUniverseFullscreen, setIsUniverseFullscreen] = useState(false);
  const [rotation, setRotation] = useState({ x: 58, y: 0, z: -34 });
  const [zoom, setZoom] = useState(1);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(pipelineSteps[0].title);
  const [activeTheme, setActiveTheme] = useState<StoryTheme>("emotions");
  const [activeFutureWork, setActiveFutureWork] = useState<FutureWorkTheme>("archetypes");
  const [rawPoints, setRawPoints] = useState<RawUniversePoint[]>([]);
  const [latestDream, setLatestDream] = useState<LatestDreamPoint | null>(null);
  const [universeStatus, setUniverseStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const universeFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadUniverse() {
      try {
        const response = await fetch("/api/plot-data-3d");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load dream universe.");
        }

        if (!ignore) {
          setRawPoints(data);
          setUniverseStatus("ready");
        }
      } catch {
        if (!ignore) {
          setUniverseStatus("error");
        }
      }
    }

    loadUniverse();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let timer: number | null = null;
    const savedDream = window.localStorage.getItem(LATEST_DREAM_STORAGE_KEY);
    if (!savedDream) {
      return;
    }

    try {
      const parsedDream = JSON.parse(savedDream);
      timer = window.setTimeout(() => {
        setLatestDream(parsedDream);
      }, 0);
    } catch {
      window.localStorage.removeItem(LATEST_DREAM_STORAGE_KEY);
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (latestDream) {
      const timer = window.setTimeout(() => {
        setFocusMode("matched");
        setEmotionFilter("mix");
      }, 0);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [latestDream]);

  const { points, latest } = useMemo(
    () => normalizeUniversePoints(rawPoints, latestDream),
    [rawPoints, latestDream]
  );
  const renderedPoints = useMemo(() => {
    let focusedPoints =
      focusMode === "matched"
        ? points.filter((point) => pointMatchesLatestCluster(point, latest))
        : points.filter((point) => pointMatchesFocus(point, focusMode));

    if (focusMode === "matched") {
      if (emotionFilter === "matched") {
        focusedPoints = focusedPoints.filter((point) => point.emotion === latest?.emotion);
      } else if (emotionFilter !== "mix") {
        focusedPoints = focusedPoints.filter((point) => point.emotion === emotionFilter);
      }
    }

    return samplePoints(focusedPoints, MAX_POINTS_BY_FOCUS[focusMode]);
  }, [emotionFilter, focusMode, latest, points]);
  const legendItems = useMemo(
    () => buildEmotionLegend(renderedPoints, latest),
    [renderedPoints, latest]
  );
  const clusterLabels = useMemo(() => buildClusterLabels(renderedPoints), [renderedPoints]);
  const visibleTotal = useMemo(() => {
    if (focusMode === "matched") {
      const matchedCluster = points.filter((point) => pointMatchesLatestCluster(point, latest));
      if (emotionFilter === "matched") {
        return matchedCluster.filter((point) => point.emotion === latest?.emotion).length;
      }
      if (emotionFilter !== "mix") {
        return matchedCluster.filter((point) => point.emotion === emotionFilter).length;
      }
      return matchedCluster.length;
    }

    return points.filter((point) => pointMatchesFocus(point, focusMode)).length;
  }, [emotionFilter, focusMode, latest, points]);

  useEffect(() => {
    if (focusMode === "matched" && latest && visibleTotal === 0 && emotionFilter !== "mix") {
      setEmotionFilter("mix");
    }
  }, [focusMode, latest, visibleTotal, emotionFilter]);

  const matchedClusterSummary = useMemo(
    () => buildMatchedClusterSummary(points, latest),
    [points, latest]
  );
  const matchedClusterEmotionTotal = useMemo(
    () => matchedClusterSummary.reduce((total, [, count]) => total + count, 0),
    [matchedClusterSummary]
  );
  const selectedPoint = useMemo(() => {
    if (selectedPointId === "latest-dream") {
      return latest;
    }

    return points.find((point) => point.id === selectedPointId) ?? latest;
  }, [latest, points, selectedPointId]);
  const plottedPointCount = renderedPoints.length + (latest ? 1 : 0);
  const rotatedLatest = latest
    ? rotatePlanarPosition(latest.x, latest.y, rotation.z)
    : null;
  const stepDetail =
    pipelineSteps.find((step) => step.title === activeStep) ?? pipelineSteps[0];

  function handleUniversePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rotationX: rotation.x,
      rotationZ: rotation.z,
    });
  }

  function handleUniversePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    setRotation({
      x: clampRotationX(dragState.rotationX - deltaY * 0.22),
      y: 0,
      z: dragState.rotationZ + deltaX * 0.34,
    });
  }

  function handleUniversePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragState?.pointerId === event.pointerId) {
      setDragState(null);
    }
  }

  function handleUniverseWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    setZoom((current) =>
      clampUniverseZoom(current - delta * UNIVERSE_ZOOM_SENSITIVITY)
    );
  }

  async function handleUniverseFullscreenToggle() {
    const frame = universeFrameRef.current;
    if (!frame) {
      return;
    }

    try {
      if (document.fullscreenElement === frame) {
        await document.exitFullscreen();
      } else if (frame.requestFullscreen) {
        await frame.requestFullscreen();
      } else {
        setIsUniverseFullscreen((current) => !current);
      }
    } catch {
      setIsUniverseFullscreen((current) => !current);
    }
  }

  return (
    <main className="home-shell">
      <div className="home-aurora" aria-hidden="true">
        <span className="home-orb home-orb-one" />
        <span className="home-orb home-orb-two" />
        <span className="home-orb home-orb-three" />
      </div>
      <div className="home-grid" aria-hidden="true" />

      <div className="home-container">
        <header className="home-topbar">
          <p className="home-badge">DTSC 4602 Data Science Project</p>
          <Link href="/analyze" className="home-analyze-link">
            Go to Dream Input
          </Link>
        </header>

        <section className="hero-card">
          <p className="hero-kicker">DreamCatcher</p>
          <h1>Uncovering Latent Dream Archetypes with Unsupervised NLP</h1>
          <p>
            We built DreamCatcher to study how large-scale dream narratives can be
            grouped into meaningful archetypes using transformer embeddings,
            dimensionality reduction, and density-based clustering.
          </p>
          <p>
            Team: Soumil Kothari, Michael Stelmack, Garrett Swaney, Ahmad Jebril,
            Nick Greco, Aryaman Kachroo, Aidan Thomas. Adviser: Mirsad Hadzikadic.
          </p>
          <div className="hero-actions">
            <Link href="/analyze" className="hero-cta-primary">
              Start Dream Analysis
            </Link>
            <a href="#why-it-matters" className="hero-cta-secondary">
              Why It Matters
            </a>
          </div>
        </section>

        <section className="stats-grid" aria-label="Key project metrics">
          {stats.map((item) => (
            <article className="stat-card" key={item.label}>
              <p className="stat-value">{item.value}</p>
              <p className="stat-label">{item.label}</p>
            </article>
          ))}
        </section>

        <section className="story-grid" id="why-it-matters">
          <article className="story-card">
            <h2>Why We Did This</h2>
            <p>
              Traditional dream coding is powerful but labor-intensive and rigid.
              Existing frameworks often miss semantic nuance at scale. We wanted a
              data-first way to discover archetypes directly from dream meaning.
            </p>
          </article>
          <article className="story-card">
            <h2>What We Found</h2>
            <p>
              Initial clustering on raw embeddings showed only dominant structure.
              Applying dimensionality reduction first revealed finer archetypes and
              converged to three primary clusters with peripheral, high-salience
              regions.
            </p>
          </article>
          <article className="story-card">
            <h2>Why It Matters</h2>
            <p>
              Dream archetypes can help model emotional patterns, support mental
              health signal discovery, and provide clinicians richer context for
              patient narratives.
            </p>
          </article>
        </section>

        <section
          className="viz-grid"
          id="dream-universe"
          aria-label="Interactive project visuals"
        >
          <article className="viz-card universe-card">
            <div className="viz-head">
              <h2>Interactive Dream Universe</h2>
              <p>
                Inspired by our 2D/3D universe figures: each point is one dream;
                distance encodes semantic similarity.
              </p>
            </div>

            <div className="viz-controls">
              <div className="control-group">
                <span>View:</span>
                <button
                  className={viewMode === "clusters" ? "viz-pill active" : "viz-pill"}
                  onClick={() => setViewMode("clusters")}
                >
                  Emotion Colors
                </button>
                <button
                  className={viewMode === "salience" ? "viz-pill active" : "viz-pill"}
                  onClick={() => setViewMode("salience")}
                >
                  Distance / Outliers
                </button>
              </div>

              <div className="control-group">
                <span>Focus:</span>
                {(["matched", "all"] as const).map((focus) => (
                  <button
                    key={focus}
                    className={focusMode === focus ? "viz-pill active" : "viz-pill"}
                    onClick={() => setFocusMode(focus)}
                    disabled={focus === "matched" && !latest}
                  >
                    {focusLabel(focus)}
                  </button>
                ))}
              </div>

              {latest && focusMode === "matched" && (
                <div className="control-group emotion-filter-group">
                  <span>Emotion:</span>
                  {(["matched", "mix", ...EMOTION_OPTIONS] as EmotionFilter[]).map((filter) => (
                    <button
                      key={filter}
                      className={emotionFilter === filter ? "viz-pill active" : "viz-pill"}
                      onClick={() => setEmotionFilter(filter)}
                    >
                      {emotionFilterLabel(filter, latest)}
                    </button>
                  ))}
                </div>
              )}

              <div className="viz-help" aria-label="Current view explanation">
                <p>
                  <b>View:</b> {viewDescription(viewMode)}
                </p>
                <p>
                  <b>Focus:</b> {focusDescription(focusMode, latest)}
                </p>
                {latest && focusMode === "matched" && (
                  <p>
                    <b>Emotion:</b> {emotionFilterDescription(emotionFilter, latest)}
                  </p>
                )}
              </div>

              <div className="control-group">
                <span>Rotate:</span>
                <button
                  className="viz-pill"
                  onClick={() => setRotation((current) => ({ ...current, z: current.z - 24 }))}
                  aria-label="Rotate dream universe left"
                >
                  Left
                </button>
                <button
                  className="viz-pill"
                  onClick={() => setRotation((current) => ({ ...current, z: current.z + 24 }))}
                  aria-label="Rotate dream universe right"
                >
                  Right
                </button>
                <button
                  className="viz-pill"
                  onClick={() =>
                    setRotation((current) => ({
                      ...current,
                      x: clampRotationX(current.x - 12),
                    }))
                  }
                  aria-label="Tilt dream universe upward"
                >
                  Up
                </button>
                <button
                  className="viz-pill"
                  onClick={() =>
                    setRotation((current) => ({
                      ...current,
                      x: clampRotationX(current.x + 12),
                    }))
                  }
                  aria-label="Tilt dream universe downward"
                >
                  Down
                </button>
                <button
                  className="viz-pill"
                  onClick={() => setRotation({ x: 58, y: 0, z: -34 })}
                  aria-label="Reset dream universe angle"
                >
                  Reset
                </button>
              </div>
            </div>

            <div
              ref={universeFrameRef}
              className={isUniverseFullscreen ? "universe-frame fullscreen" : "universe-frame"}
            >
              <button
                type="button"
                className="universe-fullscreen-toggle"
                onClick={handleUniverseFullscreenToggle}
                aria-label={isUniverseFullscreen ? "Exit fullscreen map" : "Open fullscreen map"}
              >
                {isUniverseFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
              </button>
              <div
                className={dragState ? "universe-stage dragging" : "universe-stage"}
                aria-label="Interactive 3D dream universe"
                role="application"
                onPointerDown={handleUniversePointerDown}
                onPointerMove={handleUniversePointerMove}
                onPointerUp={handleUniversePointerUp}
                onPointerCancel={handleUniversePointerUp}
                onWheel={handleUniverseWheel}
              >
                <div
                  className="universe-space"
                  style={
                    {
                      "--rotate-x": `${rotation.x}deg`,
                      "--rotate-y": `${rotation.y}deg`,
                      "--rotate-z": "0deg",
                      "--zoom": zoom,
                    } as CSSProperties
                  }
                >
                  <div className="universe-plane universe-plane-x" />
                  <div className="universe-plane universe-plane-y" />
                  <div className="universe-plane universe-plane-z" />

                  {universeStatus === "ready" &&
                    renderedPoints.map((point) => {
                      const isSelected = selectedPointId === point.id;
                      const size = point.cluster === -1 ? 4 : 5.5 + point.z / 24;
                      const opacity = point.cluster === -1 ? 0.32 : 0.76;
                      const rotatedPoint = rotatePlanarPosition(point.x, point.y, rotation.z);

                      return (
                        <button
                          key={point.id}
                          type="button"
                          className={
                            isSelected
                              ? "universe-point universe-point-selected"
                              : "universe-point"
                          }
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => setSelectedPointId(point.id)}
                          title={`${point.emotion} emotion / cluster ${point.cluster}: ${point.hoverText}`}
                          style={
                            {
                              "--point-x": `${rotatedPoint.x * 5}px`,
                              "--point-y": `${rotatedPoint.y * 3.5}px`,
                              "--point-z": `${(point.z - 50) * 5}px`,
                              "--point-size": `${size}px`,
                              "--point-color": pointColor(point, viewMode),
                              "--point-opacity": opacity,
                            } as CSSProperties
                          }
                          aria-label={`${point.emotion} emotion, cluster ${point.cluster}`}
                        >
                          <span className="universe-point-core" />
                        </button>
                      );
                    })}

                  {universeStatus === "ready" &&
                    clusterLabels.map((label) => {
                      const rotatedLabel = rotatePlanarPosition(label.x, label.y, rotation.z);

                      return (
                        <span
                          key={label.id}
                          className="universe-cluster-label"
                          style={
                            {
                              "--label-x": `${rotatedLabel.x * 5}px`,
                              "--label-y": `${rotatedLabel.y * 3.5}px`,
                              "--label-z": `${(label.z - 50) * 5}px`,
                              "--label-color": label.color,
                            } as CSSProperties
                          }
                        >
                          {label.label}
                        </span>
                      );
                    })}

                  {latest && rotatedLatest && (
                    <button
                      type="button"
                      className="universe-latest-point"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setSelectedPointId("latest-dream")}
                      title={`Your latest dream / ${latest.emotion} / cluster ${latest.cluster}: ${latest.hoverText}`}
                      style={
                        {
                          "--point-x": `${rotatedLatest.x * 5}px`,
                          "--point-y": `${rotatedLatest.y * 3.5}px`,
                          "--point-z": `${(latest.z - 50) * 5}px`,
                          "--point-color": emotionColor(latest.emotion),
                        } as CSSProperties
                      }
                      aria-label={`Your latest dream, ${latest.emotion}, cluster ${latest.cluster}`}
                    >
                      <span />
                    </button>
                  )}
                </div>
              </div>
              {universeStatus === "loading" && (
                <p className="universe-status">Loading backend universe...</p>
              )}
              {universeStatus === "error" && (
                <p className="universe-status">
                  Start the FastAPI backend to load the real dream universe.
                </p>
              )}
              {universeStatus === "ready" && (
                <p className="universe-status">
                  Plotting {plottedPointCount} markers from {visibleTotal}
                  {focusMode === "matched" && latest
                        ? emotionFilter === "mix"
                          ? ` dataset dreams across all emotions in cluster ${latest.cluster}.`
                          : ` ${emotionFilterStatusLabel(emotionFilter, latest)} dataset dreams in cluster ${latest.cluster}.`
                        : " dreams across the full universe."}
                </p>
              )}
              {focusMode === "matched" && latest && matchedClusterSummary.length > 0 && (
                <div className="emotion-mix" aria-label="Emotion mix in matched cluster">
                  <div className="emotion-mix-head">
                    <p>Emotion Mix In Cluster {latest.cluster}</p>
                    <button
                      type="button"
                      className={emotionFilter === "mix" ? "emotion-mix-all active" : "emotion-mix-all"}
                      onClick={() => setEmotionFilter("mix")}
                    >
                      Show Mix
                    </button>
                  </div>
                  {matchedClusterSummary.map(([emotion, count]) => (
                    <button
                      key={emotion}
                      type="button"
                      className={
                        emotionFilter === emotion ? "emotion-mix-item active" : "emotion-mix-item"
                      }
                      onClick={() => setEmotionFilter(emotion)}
                    >
                      <span
                        className="emotion-mix-swatch"
                        style={{ backgroundColor: emotionColor(emotion) }}
                      />
                      <span className="emotion-mix-label">{emotion}</span>
                      <span className="emotion-mix-track">
                        <span
                          className="emotion-mix-fill"
                          style={{
                            width: `${
                              matchedClusterEmotionTotal
                                ? Math.max(5, (count / matchedClusterEmotionTotal) * 100)
                                : 0
                            }%`,
                            backgroundColor: emotionColor(emotion),
                          }}
                        />
                      </span>
                      <b>{count}</b>
                    </button>
                  ))}
                </div>
              )}
              {legendItems.length > 0 && (
                <div className="universe-legend" aria-label="Dream universe color key">
                  {legendItems.map((item) => (
                    <span className="universe-legend-item" key={item.label}>
                      <span
                        className="universe-legend-swatch"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.label}
                    </span>
                  ))}
                </div>
              )}
              {selectedPoint && (
                <div className="universe-inspector">
                  <p className="universe-inspector-kicker">
                    {selectedPoint.id === "latest-dream" ? "Your Latest Dream" : "Selected Dream"}
                  </p>
                  <p>
                    <b>{selectedPoint.emotion}</b>
                    {` / cluster ${selectedPoint.cluster}`}
                  </p>
                  <p>{selectedPoint.hoverText}</p>
                </div>
              )}
            </div>

            <p className="viz-footnote">
              Drag the universe to rotate the real 3D backend projection, scroll to
              zoom. Labels mark the visible clusters; click any point to inspect an
              example dream.
            </p>
          </article>

          <article className="viz-card pipeline-card">
            <h2>Method Explorer</h2>
            <p>
              Click each stage to see how the DreamCatcher pipeline moves from raw
              narratives to emergent archetypes.
            </p>
            <div className="pipeline-buttons">
              {pipelineSteps.map((step) => (
                <button
                  key={step.title}
                  className={activeStep === step.title ? "pipeline-step active" : "pipeline-step"}
                  onClick={() => setActiveStep(step.title)}
                >
                  {step.title}
                </button>
              ))}
            </div>
            <div className="pipeline-detail">
              <h3>{stepDetail.title}</h3>
              <p>{stepDetail.detail}</p>
            </div>

            <div className="impact-panel">
              <h3>Impact Lens</h3>
              <div className="impact-tabs">
                <button
                  className={activeTheme === "emotions" ? "impact-tab active" : "impact-tab"}
                  onClick={() => setActiveTheme("emotions")}
                >
                  Human Emotions
                </button>
                <button
                  className={
                    activeTheme === "mental-health" ? "impact-tab active" : "impact-tab"
                  }
                  onClick={() => setActiveTheme("mental-health")}
                >
                  Mental Health
                </button>
                <button
                  className={activeTheme === "therapy" ? "impact-tab active" : "impact-tab"}
                  onClick={() => setActiveTheme("therapy")}
                >
                  Psychotherapy
                </button>
              </div>
              <p className="impact-title">{impactContent[activeTheme].title}</p>
              <p>{impactContent[activeTheme].body}</p>
            </div>

            <div className="future-panel">
              <h3>Future Works</h3>
              <div className="impact-tabs">
                <button
                  className={
                    activeFutureWork === "archetypes" ? "impact-tab active" : "impact-tab"
                  }
                  onClick={() => setActiveFutureWork("archetypes")}
                >
                  {futureWorksContent.archetypes.tab}
                </button>
                <button
                  className={
                    activeFutureWork === "deployment" ? "impact-tab active" : "impact-tab"
                  }
                  onClick={() => setActiveFutureWork("deployment")}
                >
                  {futureWorksContent.deployment.tab}
                </button>
                <button
                  className={
                    activeFutureWork === "database" ? "impact-tab active" : "impact-tab"
                  }
                  onClick={() => setActiveFutureWork("database")}
                >
                  {futureWorksContent.database.tab}
                </button>
                <button
                  className={
                    activeFutureWork === "visualizations"
                      ? "impact-tab active"
                      : "impact-tab"
                  }
                  onClick={() => setActiveFutureWork("visualizations")}
                >
                  {futureWorksContent.visualizations.tab}
                </button>
              </div>
              <p className="impact-title">{futureWorksContent[activeFutureWork].title}</p>
              <p>{futureWorksContent[activeFutureWork].body}</p>
            </div>
          </article>
        </section>

        <section className="home-bottom-cta">
          <h2>Ready to Analyze Your Own Dream?</h2>
          <p>
            Go to the Dream Input page and test the analyzer interface built for our
            DTSC 4602 project demo.
          </p>
          <Link href="/analyze" className="hero-cta-primary">
            Open Dream Input Page
          </Link>
        </section>
      </div>
    </main>
  );
}
