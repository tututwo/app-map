import countyNames from "$lib/generated/county-names.json";
import manifest from "$lib/generated/metrics-manifest.json";
import type { Level as DataLevel } from "./metrics";
import type { Context, ContextField } from "./sdoh";

export { manifest };
export const LEVELS = [
  "state",
  "county",
  "zcta",
  "tract",
  "blockgroup",
] as const satisfies readonly DataLevel[];
export type Level = (typeof LEVELS)[number];
/**
 * Tile geometry per Level (ADR-0002), all on 2010 boundaries: counties, ZIPs (ZCTAs) and tracts from the
 * Census cartographic files (scripts/build-census-tiles.sh), block groups from the lab's GeoPackages
 * (scripts/build-tiles.sh). Below its Reveal zoom a Level leaves the states on screen; outlines fade
 * in from `outlineZoom`.
 */
export const TILES = {
  county: {
    archive: "county-2010.pmtiles",
    sourceLayer: "counties",
    revealZoom: 0,
    outlineZoom: 3,
    maxZoom: 10,
  },
  zcta: {
    archive: "zcta-2010.pmtiles",
    sourceLayer: "zctas",
    revealZoom: 7,
    outlineZoom: 8,
    maxZoom: 13,
  },
  tract: {
    archive: "tract-2010.pmtiles",
    sourceLayer: "tracts",
    revealZoom: 7,
    outlineZoom: 8,
    maxZoom: 13,
  },
  blockgroup: {
    archive: "bg-2010.pmtiles",
    sourceLayer: "blockgroups",
    revealZoom: 8,
    outlineZoom: 9,
    maxZoom: 15,
  },
};
export const LEVEL_NOUNS: Record<Level, { one: string; many: string }> = {
  state: { one: "state", many: "states" },
  county: { one: "county", many: "counties" },
  zcta: { one: "ZIP code", many: "ZIP codes" },
  tract: { one: "tract", many: "tracts" },
  blockgroup: { one: "block group", many: "block groups" },
};
/** The state outlines are generalized 2017 display boundaries; the counts use `manifest.boundaryYear`. */
export const STATE_GEOMETRY_YEAR = 2017;
export const WINDOWS = manifest.windows.map(([from, to]) => ({ from, to, key: `${from}_${to}` }));
export const FROM_YEARS = [...new Set(WINDOWS.map((window) => window.from))];
// Upstream classifiers, in the order the Type menu lists them. They are not exclusive: a place of worship
// can carry more than one, so Types may add up to more than "All places of worship".
export const TYPES = {
  all_religions: { label: "All places of worship", noun: "places of worship" },
  christian_church: { label: "Christian congregations", noun: "Christian congregations" },
  jewish_synagogue: { label: "Synagogues", noun: "synagogues" },
  muslim_mosque: { label: "Mosques", noun: "mosques" },
  buddhist_temple: { label: "Buddhist temples", noun: "Buddhist temples" },
  hindu_mandir: { label: "Hindu temples", noun: "Hindu temples" },
  sikh_gurdwara: { label: "Sikh gurdwaras", noun: "Sikh gurdwaras" },
  other_religion: { label: "Other religions", noun: "places of worship of other religions" },
  interfaith: { label: "Interfaith", noun: "interfaith places of worship" },
  unspecified: { label: "Unspecified type", noun: "places of worship of unspecified type" },
} satisfies Record<(typeof manifest.religions)[number], { label: string; noun: string }>;
export type TypeKey = keyof typeof TYPES;

export interface StateRow {
  id: string;
  abbreviation: string;
  name: string;
}

// Identity only; all metrics come from the published state slice.
const STATE_NAMES = [
  ["01", "AL", "Alabama"],
  ["02", "AK", "Alaska"],
  ["04", "AZ", "Arizona"],
  ["05", "AR", "Arkansas"],
  ["06", "CA", "California"],
  ["08", "CO", "Colorado"],
  ["09", "CT", "Connecticut"],
  ["10", "DE", "Delaware"],
  ["11", "DC", "District of Columbia"],
  ["12", "FL", "Florida"],
  ["13", "GA", "Georgia"],
  ["15", "HI", "Hawaii"],
  ["16", "ID", "Idaho"],
  ["17", "IL", "Illinois"],
  ["18", "IN", "Indiana"],
  ["19", "IA", "Iowa"],
  ["20", "KS", "Kansas"],
  ["21", "KY", "Kentucky"],
  ["22", "LA", "Louisiana"],
  ["23", "ME", "Maine"],
  ["24", "MD", "Maryland"],
  ["25", "MA", "Massachusetts"],
  ["26", "MI", "Michigan"],
  ["27", "MN", "Minnesota"],
  ["28", "MS", "Mississippi"],
  ["29", "MO", "Missouri"],
  ["30", "MT", "Montana"],
  ["31", "NE", "Nebraska"],
  ["32", "NV", "Nevada"],
  ["33", "NH", "New Hampshire"],
  ["34", "NJ", "New Jersey"],
  ["35", "NM", "New Mexico"],
  ["36", "NY", "New York"],
  ["37", "NC", "North Carolina"],
  ["38", "ND", "North Dakota"],
  ["39", "OH", "Ohio"],
  ["40", "OK", "Oklahoma"],
  ["41", "OR", "Oregon"],
  ["42", "PA", "Pennsylvania"],
  ["44", "RI", "Rhode Island"],
  ["45", "SC", "South Carolina"],
  ["46", "SD", "South Dakota"],
  ["47", "TN", "Tennessee"],
  ["48", "TX", "Texas"],
  ["49", "UT", "Utah"],
  ["50", "VT", "Vermont"],
  ["51", "VA", "Virginia"],
  ["53", "WA", "Washington"],
  ["54", "WV", "West Virginia"],
  ["55", "WI", "Wisconsin"],
  ["56", "WY", "Wyoming"],
  ["60", "AS", "American Samoa"],
  ["66", "GU", "Guam"],
  ["69", "MP", "Northern Mariana Islands"],
  ["72", "PR", "Puerto Rico"],
  ["78", "VI", "United States Virgin Islands"],
];
export const STATES: StateRow[] = STATE_NAMES.map(([id, abbreviation, name]) => ({
  id,
  abbreviation,
  name,
}));

export interface Stat {
  closed: number | null;
  per10k: number | null;
  nOpen: number | null;
}
/** Whatever the panel is showing: a state, or a place of any other Level picked on the map. */
export interface Place {
  level: Level;
  id: string;
  name: string;
}

/** Exact name, abbreviation or GEOID first, then a name prefix. */
export function findState(text: string): StateRow | undefined {
  const q = text.trim().toLowerCase();
  if (!q) return undefined;
  return (
    STATES.find((state) =>
      [state.name.toLowerCase(), state.abbreviation.toLowerCase(), state.id].includes(q)
    ) ?? STATES.find((state) => state.name.toLowerCase().startsWith(q))
  );
}

export const fmt = (value: number | null) =>
  value === null ? "—" : Math.round(value).toLocaleString("en-US");
export const per10k = (value: number | null) => (value === null ? "—" : value.toFixed(2));

export const NO_DATA_COLOR = "#d9dde2";
export const COLORS = ["#dce5f1", "#a6bedf", "#6c93c7", "#3565a8", "#00356b"];
const whole = (value: number) => value.toLocaleString("en-US");

/**
 * Quintile breaks of the positive counts, rounded to two significant digits. A five-year window and a
 * 26-year one differ twentyfold, as do Types, so no fixed break list can serve every selection.
 */
export function breaksFor(values: (number | null)[]): number[] {
  const sorted = values.filter((value): value is number => !!value).sort((a, b) => a - b);
  const nice = (value: number) => {
    const unit = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
    return Math.round(value / unit) * unit;
  };
  return [
    ...new Set([0.2, 0.4, 0.6, 0.8].map((q) => nice(sorted[Math.floor(q * sorted.length)] ?? 0))),
  ].filter((value) => value > 0);
}

/** Index into COLORS, spread over however many classes the breaks make; -1 is No data. */
export function colorIndexOf(value: number | null, breaks: number[]) {
  if (value === null) return -1;
  let cls = 0;
  while (cls < breaks.length && value >= breaks[cls]) cls++;
  return Math.round((cls * (COLORS.length - 1)) / Math.max(1, breaks.length));
}

export const legendFor = (breaks: number[]) => ({
  breaks,
  classes: [0, ...breaks].map((low, index) => {
    const high = breaks[index];
    return {
      color: COLORS[colorIndexOf(low, breaks)],
      label:
        high === undefined
          ? `${whole(low)}+`
          : high - 1 === low
            ? whole(low)
            : `${whole(low)}–${whole(high - 1)}`,
    };
  }),
});
/**
 * Fine levels arrive one Shard at a time, so their classes cannot follow "the data"; their counts are
 * small whole numbers in every window (99th percentile over 2000-2025: ZIP 131, tract 33, block group 17).
 */
export const FIXED_BREAKS = { zcta: [1, 3, 8, 20], tract: [1, 3, 6, 12], blockgroup: [1, 2, 4, 8] };

/** "Tract 101.01" from a tract or block-group GEOID. */
function tractLabel(geoid: string) {
  const suffix = geoid.slice(9, 11);
  return `Tract ${Number(geoid.slice(5, 9))}${suffix === "00" ? "" : `.${suffix}`}`;
}

const dollars = (value: number) => `$${whole(value)}`;
const percent = (value: number) => `${value.toFixed(1)}%`;
/** The lab's covariates in panel order; wording follows its "Variable availability" sheet. */
export const CONTEXT_FIELDS: Record<
  ContextField,
  { label: string; format: (value: number) => string }
> = {
  n_pop_total: { label: "Residents", format: whole },
  n_medincome: { label: "Median household income", format: dollars },
  p_poverty: { label: "Below the poverty level", format: percent },
  p_unemp: { label: "Unemployed", format: percent },
  p_edu_no_hs: { label: "Less than 12 years of education", format: percent },
  p_renter: { label: "Rented housing", format: percent },
  n_med_rent: { label: "Median gross rent", format: dollars },
  p_overcrowding: { label: "Overcrowded housing", format: percent },
  p_pct_65p: { label: "Aged 65 or older", format: percent },
  p_pct_black: { label: "Black or African American", format: percent },
  p_pct_hisp: { label: "Hispanic or Latino", format: percent },
  i_gini: { label: "Gini index of income inequality", format: (value) => value.toFixed(3) },
  r_commhlthcntr_100k: {
    label: "Community health centers per 100,000 residents",
    format: (value) => value.toFixed(1),
  },
};

export interface ExploreQuery {
  where: string;
  from: number;
  to: number;
  type: TypeKey;
  level: Level;
}

const defaultWindow = WINDOWS.find(({ from, to }) => from === 2010 && to === 2015) ?? WINDOWS[0];
export const DEFAULT_QUERY: ExploreQuery = {
  where: "",
  from: defaultWindow.from,
  to: defaultWindow.to,
  type: "all_religions",
  level: "state",
};

/** Normalize old links to the closest window that was actually published. */
export function windowFor(query: Pick<ExploreQuery, "from" | "to">) {
  return WINDOWS.reduce((nearest, candidate) =>
    Math.abs(candidate.from - query.from) + Math.abs(candidate.to - query.to) <
    Math.abs(nearest.from - query.from) + Math.abs(nearest.to - query.to)
      ? candidate
      : nearest
  );
}

const year = (value: string | null, fallback: number) =>
  value !== null && /^\d{4}$/.test(value) ? Number(value) : fallback;

export function parseExploreQuery(params: URLSearchParams): ExploreQuery {
  const window = windowFor({
    from: year(params.get("from"), DEFAULT_QUERY.from),
    to: year(params.get("to"), DEFAULT_QUERY.to),
  });
  const type = params.get("type");
  return {
    where: params.get("where") ?? "",
    from: window.from,
    to: window.to,
    type: type && Object.hasOwn(TYPES, type) ? (type as TypeKey) : DEFAULT_QUERY.type,
    level: LEVELS.find((level) => level === params.get("level")) ?? "state",
  };
}

/**
 * `where` is a state (name, abbreviation or GEOID) or the id of a place picked on the map: county (5
 * digits), ZIP (5 digits, read as a ZIP in the ZIP view or when no county has that GEOID), tract (11)
 * or block group (12).
 */
export function placeFor(where: string, level: Level = "state"): Place | undefined {
  const counties = countyNames as Record<string, string>;
  const state = STATES.find(({ id }) => id === where.slice(0, 2))?.abbreviation ?? "";
  if (/^\d{12}$/.test(where))
    return {
      level: "blockgroup",
      id: where,
      name: `${tractLabel(where)} · Block group ${where[11]}, ${state}`,
    };
  if (/^\d{11}$/.test(where))
    return {
      level: "tract",
      id: where,
      name: `${tractLabel(where)}, ${counties[where.slice(0, 5)] ?? state}`,
    };
  if (/^\d{5}$/.test(where))
    return level !== "zcta" && counties[where]
      ? { level: "county", id: where, name: counties[where] }
      : { level: "zcta", id: where, name: `ZIP ${where}` };
  const found = findState(where);
  return found && { level: "state", id: found.id, name: found.name };
}

/**
 * `breakdown` is the selected place's reported closures in this window, per Type; `context` its
 * community context, which does not depend on the window.
 */
export function selectionFor(
  query: ExploreQuery,
  breakdown: Record<string, number | null> | null,
  context: Context | null = null
) {
  const selected = placeFor(query.where, query.level);
  const range = `${query.from}–${query.to}`;
  const type = TYPES[query.type];
  return {
    selected,
    stat: { closed: breakdown?.[query.type] ?? null, per10k: null, nOpen: null } as Stat,
    // Every Type but the total, largest first; a Type that was never active here sorts last.
    types: (Object.keys(TYPES) as TypeKey[])
      .filter((key) => key !== "all_religions")
      .map((key) => ({ key, label: TYPES[key].label, closed: breakdown?.[key] ?? null }))
      .sort((a, b) => (b.closed ?? -1) - (a.closed ?? -1)),
    // Only what the lab publishes for this kind of place: ZIPs have fewer fields, block groups none.
    context: (Object.keys(CONTEXT_FIELDS) as ContextField[]).flatMap((key) => {
      const value = context?.[key];
      return value == null
        ? []
        : [{ key, label: CONTEXT_FIELDS[key].label, value: CONTEXT_FIELDS[key].format(value) }];
    }),
    range,
    name: selected?.name ?? "United States",
    windowText: `${range} · ${query.to - query.from + 1} inclusive years · ${type.label.toLowerCase()}`,
    noun: type.noun,
    requestText: selected
      ? `Data for ${selected.name} (${LEVEL_NOUNS[selected.level].one}), ${range}.`
      : `State-level data for ${range}.`,
  };
}
export type Selection = ReturnType<typeof selectionFor>;
