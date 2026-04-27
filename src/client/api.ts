import type { DashboardState } from "../shared/types";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json",
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as DashboardState;
}

export function fetchState() {
  return request("/api/state");
}

export function runPhase(
  endpoint: "analysis" | "news" | "policy" | "performance" | "report" | "all",
) {
  return request(`/api/run/${endpoint}`, {
    method: "POST",
  });
}

export function saveConfig(payload: {
  policyUsePlaywright: boolean;
  policyRetryCount: number;
  policySeedOnly: boolean;
}) {
  return request("/api/config", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
