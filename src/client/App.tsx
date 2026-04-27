import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { fetchState, runPhase, saveConfig } from "./api";
import type { Blocker, DashboardState, PhaseSummary } from "../shared/types";

const reportOptions = [
  { key: "analysis", label: "1. Access Check" },
  { key: "newsFindings", label: "2. News Collection" },
  { key: "policyFindings", label: "3. Policy Collection" },
  { key: "performance", label: "4. Health Check" },
  { key: "finalReport", label: "5. Final Summary" },
] as const;

type ReportKey = (typeof reportOptions)[number]["key"];

function emptyState(): DashboardState {
  return {
    generatedAt: null,
    phaseSummaries: {
      analysis: {
        name: "Step 1: Check Site Access",
        status: "idle",
        startedAt: null,
        completedAt: null,
        durationMs: 0,
        itemCount: 0,
        summary: "Not started yet.",
        blockers: [],
      },
      news: {
        name: "Step 2: Collect News Updates",
        status: "idle",
        startedAt: null,
        completedAt: null,
        durationMs: 0,
        itemCount: 0,
        summary: "Not started yet.",
        blockers: [],
      },
      policy: {
        name: "Step 3: Collect Policy Documents",
        status: "idle",
        startedAt: null,
        completedAt: null,
        durationMs: 0,
        itemCount: 0,
        summary: "Not started yet.",
        blockers: [],
      },
      performance: {
        name: "Step 4: Review Data Health",
        status: "idle",
        startedAt: null,
        completedAt: null,
        durationMs: 0,
        itemCount: 0,
        summary: "Not started yet.",
        blockers: [],
      },
      finalReport: {
        name: "Step 5: Create Final Summary",
        status: "idle",
        startedAt: null,
        completedAt: null,
        durationMs: 0,
        itemCount: 0,
        summary: "Not started yet.",
        blockers: [],
      },
    },
    newsArticles: [],
    policyDocuments: [],
    sourceHealth: [],
    artifacts: {
      analysis: "",
      newsFindings: "",
      policyFindings: "",
      performance: "",
      finalReport: "",
    },
    config: {
      policyUsePlaywright: false,
      policyRetryCount: 2,
      policySeedOnly: false,
    },
  };
}

function statusTone(status: PhaseSummary["status"]) {
  switch (status) {
    case "completed":
      return "status-completed";
    case "failed":
      return "status-failed";
    case "running":
      return "status-running";
    default:
      return "status-idle";
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function BlockerList({ blockers }: { blockers: Blocker[] }) {
  if (!blockers.length) {
    return <p className="muted">No blockers recorded for this slice yet.</p>;
  }

  return (
    <div className="stack-sm">
      {blockers.map((blocker) => (
        <article
          key={`${blocker.title}-${blocker.severity}`}
          className={`blocker blocker-${blocker.severity}`}
        >
          <div className="blocker-head">
            <strong>{blocker.title}</strong>
            <span>{blocker.severity}</span>
          </div>
          <p>{blocker.summary}</p>
          <p className="muted">Impact: {blocker.impact}</p>
          <p className="muted">Mitigation: {blocker.mitigation}</p>
        </article>
      ))}
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<DashboardState>(emptyState);
  const [activeReport, setActiveReport] = useState<ReportKey>("finalReport");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState({
    policyUsePlaywright: false,
    policyRetryCount: 2,
    policySeedOnly: false,
  });
  const advancedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    fetchState()
      .then((nextState) => {
        startTransition(() => setState(nextState));
        setConfigDraft(nextState.config);
      })
      .catch((nextError) => {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load state",
        );
      });
  }, []);

  useEffect(() => {
    if (showAdvanced) {
      advancedRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [showAdvanced]);

  const totalBlockers = useMemo(
    () =>
      Object.values(state.phaseSummaries).reduce(
        (count, phase) => count + phase.blockers.length,
        0,
      ),
    [state.phaseSummaries],
  );

  const policyBlockers = state.phaseSummaries.policy.blockers;
  const highPolicyBlockers = policyBlockers.filter(
    (blocker) => blocker.severity === "high",
  ).length;
  const mediumPolicyBlockers = policyBlockers.filter(
    (blocker) => blocker.severity === "medium",
  ).length;
  const newsBlockers = state.phaseSummaries.news.blockers;

  const newsReliability = clamp(92 - newsBlockers.length * 12, 45, 95);
  const policyReliability = clamp(
    58 - highPolicyBlockers * 14 - mediumPolicyBlockers * 8,
    20,
    85,
  );
  const dataCollectionConfidence = clamp(
    62 - highPolicyBlockers * 16 - (state.config.policySeedOnly ? 10 : 0),
    15,
    90,
  );

  const newsStatus = newsReliability >= 75 ? "Ready" : "Needs improvements";
  const policyStatus =
    policyReliability >= 65 ? "Reliable enough" : "Partially reliable";
  const formattedGeneratedAt = state.generatedAt
    ? new Date(state.generatedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "not run yet";

  const reportContent = state.artifacts[activeReport];

  async function execute(
    endpoint: "analysis" | "news" | "policy" | "performance" | "report" | "all",
  ) {
    setBusy(endpoint);
    setError(null);
    try {
      const nextState = await runPhase(endpoint);
      startTransition(() => setState(nextState));
      if (endpoint === "analysis") setActiveReport("analysis");
      if (endpoint === "news") setActiveReport("newsFindings");
      if (endpoint === "policy") setActiveReport("policyFindings");
      if (endpoint === "performance") setActiveReport("performance");
      if (endpoint === "report" || endpoint === "all")
        setActiveReport("finalReport");
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Request failed",
      );
    } finally {
      setBusy(null);
    }
  }

  async function persistConfig() {
    setSavingConfig(true);
    setError(null);

    try {
      const nextState = await saveConfig({
        policyUsePlaywright: configDraft.policyUsePlaywright,
        policyRetryCount: Number(configDraft.policyRetryCount),
        policySeedOnly: configDraft.policySeedOnly,
      });
      startTransition(() => setState(nextState));
      setConfigDraft(nextState.config);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to save config",
      );
    } finally {
      setSavingConfig(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">CSV Radar POC</p>
          <h1>CSV Radar - Feasibility Summary</h1>
          <p className="hero-copy">
            A quick decision view for launch readiness, coverage, and key risks.
          </p>
          <div className="summary-lines">
            <p>
              <strong>News Monitoring:</strong> {newsStatus}
            </p>
            <p>
              <strong>Policy Monitoring:</strong> {policyStatus}
            </p>
          </div>
        </div>
        <div className="hero-metrics">
          <div>
            <span className="metric-label">Articles</span>
            <strong>{state.newsArticles.length}</strong>
          </div>
          <div>
            <span className="metric-label">Policy Docs</span>
            <strong>{state.policyDocuments.length}</strong>
          </div>
          <div>
            <span className="metric-label">Blockers</span>
            <strong>{totalBlockers}</strong>
          </div>
        </div>
      </section>

      <section className="toolbar">
        <button
          disabled={Boolean(busy)}
          onClick={() => execute("analysis")}
          className="button-primary"
        >
          {busy === "analysis" ? "Running analysis…" : "Run analysis"}
        </button>
        <button
          disabled={Boolean(busy)}
          onClick={() => setShowAdvanced((value) => !value)}
        >
          <span className="button-with-icon">
            <span>
              {showAdvanced ? "Advanced (open)" : "Advanced (optional)"}
            </span>
            {showAdvanced ? (
              <ChevronUp size={16} strokeWidth={2.2} />
            ) : (
              <ChevronDown size={16} strokeWidth={2.2} />
            )}
          </span>
        </button>
      </section>

      {showAdvanced ? (
        <section ref={advancedRef} className="advanced-shell">
          <div className="panel span-4">
            <div className="panel-head">
              <h2>Advanced controls</h2>
              <span className="muted">Optional</span>
            </div>
            <div className="config-form">
              <button disabled={Boolean(busy)} onClick={() => execute("all")}>
                {busy === "all" ? "Running everything…" : "Run all steps"}
              </button>
              <button disabled={Boolean(busy)} onClick={() => execute("news")}>
                Run news collection
              </button>
              <button
                disabled={Boolean(busy)}
                onClick={() => execute("policy")}
              >
                Run policy collection
              </button>
              <button
                disabled={Boolean(busy)}
                onClick={() => execute("performance")}
              >
                Run system health
              </button>
              <button
                disabled={Boolean(busy)}
                onClick={() => execute("report")}
              >
                Generate final recommendation
              </button>

              <label className="config-row">
                <span>Retry attempts (0-6)</span>
                <input
                  type="number"
                  min={0}
                  max={6}
                  value={configDraft.policyRetryCount}
                  onChange={(event) =>
                    setConfigDraft((current) => ({
                      ...current,
                      policyRetryCount: Math.max(
                        0,
                        Math.min(6, Number(event.target.value || 0)),
                      ),
                    }))
                  }
                />
              </label>

              <label className="config-row">
                <span>Use saved links only (safer mode)</span>
                <input
                  type="checkbox"
                  checked={configDraft.policySeedOnly}
                  onChange={(event) =>
                    setConfigDraft((current) => ({
                      ...current,
                      policySeedOnly: event.target.checked,
                    }))
                  }
                />
              </label>

              <button
                className="button-primary"
                disabled={savingConfig || Boolean(busy)}
                onClick={persistConfig}
              >
                {savingConfig ? "Saving…" : "Save options"}
              </button>
            </div>
          </div>

          <div className="panel span-8">
            <div className="panel-head">
              <h2>Detailed reports</h2>
              <div className="tab-strip">
                {reportOptions.map((option) => (
                  <button
                    key={option.key}
                    className={option.key === activeReport ? "tab-active" : ""}
                    onClick={() => setActiveReport(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <pre className="report-surface">
              {reportContent ||
                "Run a step to generate notes and report content."}
            </pre>
          </div>
        </section>
      ) : null}

      {error ? <section className="error-banner">{error}</section> : null}

      <section className="dashboard-grid">
        <div className="panel span-12">
          <div className="panel-head">
            <h2>Coverage scorecards</h2>
            <span className="muted">
              Last update: {formattedGeneratedAt}
            </span>
          </div>
          <div className="score-grid">
            <article className="score-card">
              <h3>News Coverage</h3>
              <p className="score-text">{newsReliability}% reliability</p>
              <div className="meter">
                <div
                  className="meter-fill meter-green"
                  style={{ width: `${newsReliability}%` }}
                />
              </div>
              <p className="muted">
                Strong article capture with stable ingestion flow.
              </p>
            </article>

            <article className="score-card">
              <h3>Policy Coverage</h3>
              <p className="score-text">{policyReliability}% reliability</p>
              <div className="meter">
                <div
                  className="meter-fill meter-amber"
                  style={{ width: `${policyReliability}%` }}
                />
              </div>
              <p className="muted">
                Limited by source access restrictions and partial automation.
              </p>
            </article>

            <article className="score-card">
              <h3>Data Collection Confidence</h3>
              <p className="score-text">
                {dataCollectionConfidence}% confidence
              </p>
              <div className="meter">
                <div
                  className="meter-fill meter-red"
                  style={{ width: `${dataCollectionConfidence}%` }}
                />
              </div>
              <p className="muted">
                External site behavior still limits fully automated policy
                collection.
              </p>
            </article>
          </div>
        </div>

        <div className="panel span-6">
          <div className="panel-head">
            <h2>What this means</h2>
            <span className="muted">Plain-language interpretation</span>
          </div>
          <div className="plain-insights">
            <p>
              The system works well for tracking and updating energy-related
              news.
            </p>
            <p>
              Government policy sources are harder to access and may need
              assisted collection.
            </p>
            <p>
              A scoped MVP is feasible now, then deeper automation can be added
              later.
            </p>
          </div>
        </div>

        <div className="panel span-6">
          <div className="panel-head">
            <h2>Risk overview</h2>
            <span className="muted">Grouped themes</span>
          </div>
          <div className="risk-themes">
            <article className="risk-card risk-red">
              <h3>Data Access Limitations</h3>
              <p>Some government sites block automated access.</p>
            </article>
            <article className="risk-card risk-amber">
              <h3>Partial Coverage</h3>
              <p>
                Policy results may be incomplete without manual or browser-based
                extraction.
              </p>
            </article>
            <article className="risk-card risk-green">
              <h3>Stable News Pipeline</h3>
              <p>News ingestion is reliable and ready for production use.</p>
            </article>
          </div>
        </div>

        <div className="panel span-6">
          <div className="panel-head">
            <h2>News articles</h2>
            <span className="muted">{state.newsArticles.length} collected</span>
          </div>
          {state.newsArticles.length === 0 ? (
            <p className="muted" style={{ marginTop: '0.75rem' }}>No articles yet — run news collection.</p>
          ) : (
            <div className="collection-list">
              {state.newsArticles.map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="collection-item"
                >
                  <span className="collection-title">{article.title}</span>
                  <span className="collection-meta">
                    <span>{article.source}</span>
                    {article.publishedAt && <span>{new Date(article.publishedAt).toLocaleDateString()}</span>}
                  </span>
                  {article.tags.length > 0 && (
                    <span className="tag-row">
                      {article.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="panel span-6">
          <div className="panel-head">
            <h2>Policy documents</h2>
            <span className="muted">{state.policyDocuments.length} collected</span>
          </div>
          {state.policyDocuments.length === 0 ? (
            <p className="muted" style={{ marginTop: '0.75rem' }}>No documents yet — run policy collection.</p>
          ) : (
            <div className="collection-list">
              {state.policyDocuments.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="collection-item"
                >
                  <span className="collection-title">{doc.title}</span>
                  <span className="collection-meta">
                    <span>{doc.source}</span>
                    <span>{doc.docType}</span>
                    {doc.isPdf && <span className="tag tag-blue">PDF</span>}
                    {doc.blocked && <span className="tag tag-red">Blocked</span>}
                    {doc.requiresJs && <span className="tag tag-amber">JS required</span>}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>

        {(() => {
          const allBlockers = [
            ...state.phaseSummaries.news.blockers,
            ...state.phaseSummaries.policy.blockers,
          ];
          return (
            <div className="panel span-12">
              <div className="panel-head">
                <h2>Blockers</h2>
                <span className="muted">{allBlockers.length} recorded</span>
              </div>
              {allBlockers.length === 0 ? (
                <p className="muted" style={{ marginTop: '0.75rem' }}>No blockers recorded — run news or policy collection.</p>
              ) : (
                <div className="blocker-grid">
                  {allBlockers.map((blocker) => (
                    <article
                      key={`${blocker.title}-${blocker.severity}`}
                      className={`blocker blocker-${blocker.severity}`}
                    >
                      <div className="blocker-head">
                        <strong>{blocker.title}</strong>
                        <span className={`tag tag-severity-${blocker.severity}`}>{blocker.severity}</span>
                      </div>
                      <p>{blocker.summary}</p>
                      <p className="muted">Impact: {blocker.impact}</p>
                      <p className="muted">Mitigation: {blocker.mitigation}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </section>
    </main>
  );
}
