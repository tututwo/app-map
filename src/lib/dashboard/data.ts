import type { DashboardParams } from "./params";

export type DashboardPart = "map" | "line" | "stacked" | "side";

export type DashboardErrorKind = "timeout" | "http" | "network" | "invalid-data";

export interface DashboardError {
  ok: false;
  kind: DashboardErrorKind;
  message: string;
}

export type Result<T> = { ok: true; data: T } | DashboardError;

export interface MapDatum {
  geoid: string;
  name: string;
  closure: number;
  closure_rate_per_10000: number;
  persistence: number;
  reopening: number;
}

export interface LineDatum {
  year: number;
  close: number;
}

export interface StackedDatum {
  year: number;
  negative: number;
  neutral: number;
  positive: number;
}

export type SideMetricDatum = Record<string, string>;

export interface DashboardLoadDependencies {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  depends: (dependency: "app:dashboard") => void;
}

export interface DashboardDataResults {
  map?: Result<MapDatum[]>;
  line?: Result<LineDatum[]>;
  stacked?: Result<StackedDatum[]>;
  side?: Result<SideMetricDatum>;
}

const REQUEST_TIMEOUT_MS = 10_000;

function isTimeoutFailure(error: unknown, signal: AbortSignal): boolean {
  return (
    signal.aborted ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "TimeoutError")
  );
}

function timeoutResult(): DashboardError {
  return {
    ok: false,
    kind: "timeout",
    message: "Dashboard request timed out after 10 seconds",
  };
}

async function fetchResult<T>(
  fetch: DashboardLoadDependencies["fetch"],
  url: string,
  isValid: (value: unknown) => value is T
): Promise<Result<T>> {
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (isTimeoutFailure(error, signal)) return timeoutResult();
    return {
      ok: false,
      kind: "network",
      message: error instanceof Error ? error.message : "Dashboard request failed",
    };
  }

  if (!response.ok) {
    const status = response.statusText
      ? `${response.status} ${response.statusText}`
      : String(response.status);
    return {
      ok: false,
      kind: "http",
      message: `Dashboard request failed with HTTP ${status}`,
    };
  }

  try {
    const data: unknown = await response.json();
    if (!isValid(data)) {
      return {
        ok: false,
        kind: "invalid-data",
        message: "Dashboard response had an unexpected shape",
      };
    }
    return { ok: true, data };
  } catch (error) {
    if (isTimeoutFailure(error, signal)) return timeoutResult();
    return {
      ok: false,
      kind: "invalid-data",
      message: error instanceof Error ? error.message : "Dashboard response was not valid JSON",
    };
  }
}

function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

function isSideMetricDatum(value: unknown): value is SideMetricDatum {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function loadDashboardData(
  { fetch, depends }: DashboardLoadDependencies,
  params: DashboardParams,
  parts: ReadonlySet<DashboardPart>
): Promise<DashboardDataResults> {
  depends("app:dashboard");

  const results: DashboardDataResults = {};
  const requests: Promise<void>[] = [];

  if (parts.has("map")) {
    requests.push(
      (async () => {
        results.map = await fetchResult<MapDatum[]>(
          fetch,
          `/api/map_data?from=${params.from}&to=${params.to}`,
          isArray<MapDatum>
        );
      })()
    );
  }

  if (parts.has("line")) {
    requests.push(
      (async () => {
        results.line = await fetchResult<LineDatum[]>(
          fetch,
          `/api/line_chart_data?geoid=${params.geoid}`,
          isArray<LineDatum>
        );
      })()
    );
  }

  if (parts.has("stacked")) {
    requests.push(
      (async () => {
        results.stacked = await fetchResult<StackedDatum[]>(
          fetch,
          `/api/stacked_bar_chart_data?geoid=${params.geoid}`,
          isArray<StackedDatum>
        );
      })()
    );
  }

  if (parts.has("side")) {
    requests.push(
      (async () => {
        results.side = await fetchResult<SideMetricDatum>(
          fetch,
          `/api/side_metric_data?geoid=${params.geoid}`,
          isSideMetricDatum
        );
      })()
    );
  }

  await Promise.all(requests);
  return results;
}
