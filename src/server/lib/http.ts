export async function timedFetch(url: string, init?: RequestInit) {
  const started = performance.now();
  const response = await fetch(url, {
    ...init,
    headers: {
      "user-agent": "CSV-Radar-POC/0.1 (+frontend-pivot)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(init?.headers ?? {}),
    },
  });

  return {
    response,
    durationMs: Math.round(performance.now() - started),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  retryOnStatuses?: number[];
}

export async function timedFetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: RetryOptions,
) {
  const retries = options?.retries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 450;
  const retryOnStatuses = options?.retryOnStatuses ?? [
    408, 425, 429, 500, 502, 503, 504,
  ];

  let attempts = 0;
  let totalDurationMs = 0;
  let lastError: unknown;

  while (attempts <= retries) {
    attempts += 1;

    try {
      const result = await timedFetch(url, init);
      totalDurationMs += result.durationMs;

      const shouldRetry = retryOnStatuses.includes(result.response.status);
      if (!shouldRetry || attempts > retries) {
        return {
          response: result.response,
          durationMs: totalDurationMs,
          attempts,
        };
      }
    } catch (error) {
      lastError = error;
      if (attempts > retries) {
        throw error;
      }
    }

    const delayMs = baseDelayMs * Math.pow(2, attempts - 1);
    await sleep(delayMs);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("timedFetchWithRetry failed unexpectedly");
}
