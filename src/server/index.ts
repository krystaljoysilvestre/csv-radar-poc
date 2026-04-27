import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readState, updateState } from "./lib/storage.js";
import {
  persistCurrentArtifacts,
  runAllPhases,
  runFinalReportPhase,
  runPerformancePhase,
} from "./phases/pipeline.js";
import { runAnalysisPhase } from "./phases/analysis.js";
import { runNewsPhase } from "./phases/news.js";
import { runPolicyPhase } from "./phases/policy.js";

const app = express();
const port = Number(process.env.PORT) || 8787;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../../client");

app.use(express.json());

app.get("/api/state", async (_req, res) => {
  const state = await readState();
  res.json(state);
});

app.post("/api/config", async (req, res) => {
  const state = await updateState((current) => {
    const payload = req.body ?? {};
    current.config = {
      policyUsePlaywright: Boolean(
        payload.policyUsePlaywright ?? current.config.policyUsePlaywright,
      ),
      policyRetryCount: Math.max(
        0,
        Math.min(
          6,
          Number(payload.policyRetryCount ?? current.config.policyRetryCount),
        ),
      ),
      policySeedOnly: Boolean(
        payload.policySeedOnly ?? current.config.policySeedOnly,
      ),
    };
    return current;
  });

  res.json(state);
});

app.post("/api/run/analysis", async (_req, res) => {
  const state = await updateState((current) => runAnalysisPhase(current));
  await persistCurrentArtifacts(state);
  res.json(state);
});

app.post("/api/run/news", async (_req, res) => {
  const state = await updateState((current) => runNewsPhase(current));
  await persistCurrentArtifacts(state);
  res.json(state);
});

app.post("/api/run/policy", async (_req, res) => {
  const state = await updateState((current) => runPolicyPhase(current));
  await persistCurrentArtifacts(state);
  res.json(state);
});

app.post("/api/run/performance", async (_req, res) => {
  const state = await updateState((current) => runPerformancePhase(current));
  await persistCurrentArtifacts(state);
  res.json(state);
});

app.post("/api/run/report", async (_req, res) => {
  const state = await updateState((current) => runFinalReportPhase(current));
  await persistCurrentArtifacts(state);
  res.json(state);
});

app.post("/api/run/all", async (_req, res) => {
  const state = await updateState((current) => runAllPhases(current));
  res.json(state);
});

app.use(express.static(clientDist));
app.get("*", async (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }

  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(port, () => {
  console.log(`CSV Radar POC server listening on http://localhost:${port}`);
});
