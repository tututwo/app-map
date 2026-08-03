import { NATIONAL_GEOID, normalizeCountyGeoid } from "$lib/domain/countyGeoid";
import { clampYearWindow } from "$lib/domain/yearWindow";

export interface DashboardParams {
  from: number;
  to: number;
  geoid: string;
}

export const DEFAULT_DASHBOARD_PARAMS: Readonly<DashboardParams> = {
  from: 2003,
  to: 2011,
  geoid: NATIONAL_GEOID,
};

function parseStrictInteger(value: string | null, fallback: number): number {
  if (value === null || !/^-?(0|[1-9]\d*)$/.test(value)) return fallback;
  return Number(value);
}

function getSingleValue(searchParams: URLSearchParams, name: string): string | null {
  const values = searchParams.getAll(name);
  return values.length === 1 ? values[0] : null;
}

export function parseDashboardParams(url: URL): DashboardParams {
  const from = parseStrictInteger(
    getSingleValue(url.searchParams, "from"),
    DEFAULT_DASHBOARD_PARAMS.from
  );
  const to = parseStrictInteger(
    getSingleValue(url.searchParams, "to"),
    DEFAULT_DASHBOARD_PARAMS.to
  );
  const geoidParam = getSingleValue(url.searchParams, "geoid");

  return {
    ...clampYearWindow(from, to),
    geoid:
      geoidParam && /^\d{5}$/.test(geoidParam)
        ? normalizeCountyGeoid(geoidParam)
        : DEFAULT_DASHBOARD_PARAMS.geoid,
  };
}
