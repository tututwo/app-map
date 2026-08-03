import { isNationalGeoid } from "$lib/domain/countyGeoid";
import type { MapDatum } from "./data";
import type { DashboardParams } from "./params";

/**
 * Display name for a geoid, or null for the national aggregate — routes
 * supply their own national label ("All locations", "the United States").
 */
export function countyDisplayName(mapData: readonly MapDatum[], geoid: string): string | null {
  if (isNationalGeoid(geoid)) return null;
  return mapData.find((county) => county.geoid === geoid)?.name ?? geoid;
}

/** The one encoding of dashboard params as a query string. */
export function dashboardSearch(params: DashboardParams): string {
  return new URLSearchParams({
    from: String(params.from),
    to: String(params.to),
    geoid: params.geoid,
  }).toString();
}
