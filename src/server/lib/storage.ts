import { promises as fs } from "node:fs";
import {
  DashboardState,
  PhaseArtifacts,
  PhaseSummary,
  RuntimeConfig,
} from "../../shared/types.js";
import { ensureDataDir, runtimeStatePath } from "./files.js";

function createPhaseSummary(name: string): PhaseSummary {
  return {
    name,
    status: "idle",
    startedAt: null,
    completedAt: null,
    durationMs: 0,
    itemCount: 0,
    summary: "Not started yet.",
    blockers: [],
  };
}

function createArtifacts(): PhaseArtifacts {
  return {
    analysis: "",
    newsFindings: "",
    policyFindings: "",
    performance: "",
    finalReport: "",
  };
}

function createRuntimeConfig(): RuntimeConfig {
  return {
    policyUsePlaywright: process.env.POLICY_USE_PLAYWRIGHT === "true",
    policyRetryCount: 2,
    policySeedOnly: false,
  };
}

function ensureStateShape(state: DashboardState): DashboardState {
  const defaults = createRuntimeConfig();
  return {
    ...state,
    phaseSummaries: {
      analysis:
        state.phaseSummaries.analysis ??
        createPhaseSummary("Phase 1 — Site Analysis"),
      news:
        state.phaseSummaries.news ??
        createPhaseSummary("Phase 2 — News Fetcher"),
      policy:
        state.phaseSummaries.policy ??
        createPhaseSummary("Phase 3 — Policy Crawler"),
      performance:
        state.phaseSummaries.performance ??
        createPhaseSummary("Phase 4 — Integration & Performance"),
      finalReport:
        state.phaseSummaries.finalReport ??
        createPhaseSummary("Phase 5 — Findings Report"),
    },
    artifacts: {
      analysis: state.artifacts.analysis ?? "",
      newsFindings: state.artifacts.newsFindings ?? "",
      policyFindings: state.artifacts.policyFindings ?? "",
      performance: state.artifacts.performance ?? "",
      finalReport: state.artifacts.finalReport ?? "",
    },
    config: {
      policyUsePlaywright:
        state.config?.policyUsePlaywright ?? defaults.policyUsePlaywright,
      policyRetryCount:
        state.config?.policyRetryCount ?? defaults.policyRetryCount,
      policySeedOnly: state.config?.policySeedOnly ?? defaults.policySeedOnly,
    },
  };
}

export function createInitialState(): DashboardState {
  return {
    generatedAt: null,
    phaseSummaries: {
      analysis: createPhaseSummary("Phase 1 — Site Analysis"),
      news: createPhaseSummary("Phase 2 — News Fetcher"),
      policy: createPhaseSummary("Phase 3 — Policy Crawler"),
      performance: createPhaseSummary("Phase 4 — Integration & Performance"),
      finalReport: createPhaseSummary("Phase 5 — Findings Report"),
    },
    newsArticles: [],
    policyDocuments: [],
    sourceHealth: [],
    artifacts: createArtifacts(),
    config: createRuntimeConfig(),
  };
}

export async function readState() {
  await ensureDataDir();

  try {
    const raw = await fs.readFile(runtimeStatePath, "utf8");
    return ensureStateShape(JSON.parse(raw) as DashboardState);
  } catch {
    const state = createInitialState();
    await writeState(state);
    return state;
  }
}

export async function writeState(state: DashboardState) {
  await ensureDataDir();
  await fs.writeFile(runtimeStatePath, JSON.stringify(state, null, 2), "utf8");
}

export async function updateState(
  mutator: (state: DashboardState) => DashboardState | Promise<DashboardState>,
) {
  const current = await readState();
  const next = await mutator(current);
  next.generatedAt = new Date().toISOString();
  await writeState(next);
  return next;
}
