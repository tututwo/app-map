const COUNTY_DISPLAY_ALIASES: Readonly<Record<string, string>> = {
  "South Central Connecticut Planning Region": "New Haven County",
};

const SOUTH_CENTRAL_PLANNING_REGION_GEOID = "09170";
const NEW_HAVEN_COUNTY_GEOID = "09009";

export function isConnecticutPlanningRegionGeoid(geoid: string): boolean {
  return /^091[1-9]0$/.test(geoid);
}

/**
 * South Central is the only Connecticut planning region for which every app
 * dataset has the same proven legacy-county fallback.
 */
export function normalizeCountyGeoid(geoid: string): string {
  return geoid === SOUTH_CENTRAL_PLANNING_REGION_GEOID ? NEW_HAVEN_COUNTY_GEOID : geoid;
}

export function resolveCountyDisplay(
  countyName: string,
  state: string | null | undefined
): { county: string; displayName: string } {
  const county = COUNTY_DISPLAY_ALIASES[countyName] ?? countyName;
  const stateLabel = state === "Connecticut" ? "CT" : state;

  return {
    county,
    displayName: stateLabel ? `${county}, ${stateLabel}` : county,
  };
}
