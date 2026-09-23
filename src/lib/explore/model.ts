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
 * in from `outlineZoom`, which is also where hovering outlines a Unit. The Selection is outlined from
 * `selectZoom`: below it a fine Unit is a speck and the Focus dot marks it. `focusZoom` is where the
 * camera settles to show the Unit under a Focus; a click from further out frames the Unit.
 */
export const TILES = {
  county: {
    archive: "county-2010.pmtiles",
    sourceLayer: "counties",
    revealZoom: 0,
    outlineZoom: 3,
    selectZoom: 0,
    maxZoom: 10,
    focusZoom: 7.5,
  },
  zcta: {
    archive: "zcta-2010-v2.pmtiles",
    sourceLayer: "zctas",
    revealZoom: 0,
    outlineZoom: 8,
    selectZoom: 7,
    maxZoom: 13,
    focusZoom: 10.5,
  },
  tract: {
    archive: "tract-2010-v2.pmtiles",
    sourceLayer: "tracts",
    revealZoom: 0,
    outlineZoom: 8,
    selectZoom: 7,
    maxZoom: 13,
    focusZoom: 11,
  },
  blockgroup: {
    archive: "bg-2010-v2.pmtiles",
    sourceLayer: "blockgroups",
    revealZoom: 0,
    outlineZoom: 9,
    selectZoom: 7,
    maxZoom: 15,
    focusZoom: 13,
  },
};
/** What a newcomer needs to know to read a number for a Fine level. */
export const LEVEL_NOTES: Partial<Record<Level, string>> = {
  zcta: "A ZCTA (ZIP Code Tabulation Area) is the Census Bureau's geographic approximation of postal ZIP codes.",
  tract:
    "A census tract is a small area drawn by the Census Bureau, home to about 4,000 residents.",
  blockgroup: "A block group is a part of a census tract, usually home to 600 to 3,000 residents.",
};
export const LEVEL_NOUNS: Record<Level, { one: string; many: string }> = {
  state: { one: "state", many: "states" },
  county: { one: "county", many: "counties" },
  zcta: { one: "ZCTA", many: "ZCTAs" },
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

/** One statistical geography at a Level, identified by its GEOID. */
export interface Unit {
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
// A minor Type's rate is far below one in 10,000; two decimals would print every such rate as 0.01.
export const per10k = (value: number | null) =>
  value === null ? "—" : value > 0 && value < 0.1 ? value.toPrecision(2) : value.toFixed(2);

export const NO_DATA_COLOR = "#d9dde2";
export const COLORS = [
  "#dce5f1",
  "#c4d4e9",
  "#acc2e1",
  "#93b0d7",
  "#799dcc",
  "#6089c0",
  "#4774b2",
  "#2f60a1",
  "#184a86",
  "#00356b",
];
const whole = (value: number) => value.toLocaleString("en-US");

/**
 * Decile breaks of the positive counts, rounded to two significant digits. A five-year window and a
 * 26-year one differ twentyfold, as do Types, so no fixed break list can serve every selection.
 */
export function breaksFor(values: (number | null)[]): number[] {
  const sorted = values.filter((value): value is number => !!value).sort((a, b) => a - b);
  const nice = (value: number) => {
    const unit = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
    return Math.round(value / unit) * unit;
  };
  return [
    ...new Set(
      Array.from({ length: COLORS.length - 1 }, (_, index) =>
        nice(sorted[Math.floor(((index + 1) / COLORS.length) * sorted.length)] ?? 0)
      )
    ),
  ].filter((value) => value > 0);
}

/** Index into COLORS, spread over however many classes the breaks make; -1 is No data. */
export function colorIndexOf(value: number | null, breaks: number[]) {
  if (value === null) return -1;
  let cls = 0;
  while (cls < breaks.length && value >= breaks[cls]) cls++;
  return Math.round((cls * (COLORS.length - 1)) / Math.max(1, breaks.length));
}

export const legendFor = (breaks: number[], colors: readonly string[] = COLORS) => ({
  breaks,
  classes: [0, ...breaks].map((low, index) => {
    const high = breaks[index];
    return {
      color: colors[colorIndexOf(low, breaks)],
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
 * Fine levels keep fixed classes across windows and Types; their counts are small whole numbers
 * (99th percentile over 2000-2025: ZIP 131, tract 33, block group 17).
 */
export const FIXED_BREAKS = {
  zcta: [1, 2, 3, 5, 8, 12, 20, 50, 100],
  tract: [1, 2, 3, 4, 6, 8, 12, 20, 30],
  blockgroup: [1, 2, 3, 4, 6, 8, 12, 16, 20],
};

/** "Tract 101.01" from a tract or block-group GEOID. */
function tractLabel(geoid: string) {
  const suffix = geoid.slice(9, 11);
  return `Tract ${Number(geoid.slice(5, 9))}${suffix === "00" ? "" : `.${suffix}`}`;
}

const dollars = (value: number) => `$${whole(value)}`;
const percent = (value: number) => `${value.toFixed(1)}%`;
/** Panel order. Residents are the 2010 census count; the rest follows the lab's "Variable availability" sheet. */
export const CONTEXT_FIELDS: Record<
  ContextField,
  { label: string; format: (value: number) => string }
> = {
  pop2010: { label: "Residents, 2010 census", format: whole },
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

export type LngLat = [lng: number, lat: number];

export interface ExploreQuery {
  /** The Selection, written down for the server: the Unit of `level` that contains `at`. */
  where: string;
  /** The Focus. Links from before ADR-0003 carry `where` alone. */
  at: LngLat | null;
  /** What was searched to set the Focus: a Location's label, or "address" (the text itself stays out of URLs). */
  near: string;
  /** Name of the Unit the visitor was reading when View by changed, unless a search already explains the Focus. */
  via: string;
  from: number;
  to: number;
  type: TypeKey;
  level: Level;
}

const defaultWindow = WINDOWS.find(({ from, to }) => from === 2010 && to === 2015) ?? WINDOWS[0];
export const DEFAULT_QUERY: ExploreQuery = {
  where: "",
  at: null,
  near: "",
  via: "",
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

function parseAt(value: string | null): LngLat | null {
  const [lng, lat, ...rest] = (value ?? "").split(",").map(Number);
  return !rest.length && Math.abs(lng) <= 180 && Math.abs(lat) <= 85 ? [lng, lat] : null;
}
export const formatAt = ([lng, lat]: LngLat) => `${lng.toFixed(5)},${lat.toFixed(5)}`;

/** Write a patch of the Query into URL parameters. An empty value removes its parameter. */
export function writeQuery(params: URLSearchParams, patch: Partial<ExploreQuery>) {
  for (const [key, value] of Object.entries(patch)) {
    const text = Array.isArray(value) ? formatAt(value) : String(value ?? "");
    if (text === "") params.delete(key);
    else params.set(key, text);
  }
  return params;
}

/** How a Unit is written into `where`: states keep their name, as Home's form and older links have it. */
export const whereOf = (level: Level, geoid: string | undefined) =>
  !geoid ? "" : level === "state" ? (STATES.find(({ id }) => id === geoid)?.name ?? geoid) : geoid;

export function parseExploreQuery(params: URLSearchParams): ExploreQuery {
  const window = windowFor({
    from: year(params.get("from"), DEFAULT_QUERY.from),
    to: year(params.get("to"), DEFAULT_QUERY.to),
  });
  const type = params.get("type");
  return {
    where: params.get("where") ?? "",
    at: parseAt(params.get("at")),
    near: params.get("near") ?? "",
    via: params.get("via") ?? "",
    from: window.from,
    to: window.to,
    type: type && Object.hasOwn(TYPES, type) ? (type as TypeKey) : DEFAULT_QUERY.type,
    level: LEVELS.find((level) => level === params.get("level")) ?? "state",
  };
}

/**
 * `where` is always read at `level` and never guessed from its shape (ADR-0003): 06037 is Los Angeles
 * County at the county Level and a ZIP in Connecticut at the ZIP Level. A state also answers to its name
 * or abbreviation, which is what Home's form and links from before the Focus send.
 */
export function unitFor(where: string, level: Level): Unit | undefined {
  const counties = countyNames as Record<string, string>;
  const state = STATES.find(({ id }) => id === where.slice(0, 2))?.abbreviation ?? "";
  const within = counties[where.slice(0, 5)] ?? state;
  if (level === "state") {
    const found = findState(where);
    return found && { level, id: found.id, name: found.name };
  }
  if (level === "county")
    return counties[where] ? { level, id: where, name: counties[where] } : undefined;
  if (level === "zcta")
    return /^\d{5}$/.test(where) ? { level, id: where, name: `ZCTA ${where}` } : undefined;
  if (level === "tract")
    return /^\d{11}$/.test(where)
      ? { level, id: where, name: `${tractLabel(where)}, ${within}` }
      : undefined;
  return /^\d{12}$/.test(where)
    ? { level, id: where, name: `Block group ${where[11]}, ${tractLabel(where)}, ${within}` }
    : undefined;
}

const GEOID_LENGTH: Partial<Record<Level, number>> = {
  state: 2,
  county: 5,
  tract: 11,
  blockgroup: 12,
};
/** Up the census hierarchy a Unit's parent is a prefix of its GEOID. ZIPs nest in nothing. */
export function parentOf(unit: Unit, level: Level): string | undefined {
  const [from, to] = [GEOID_LENGTH[unit.level], GEOID_LENGTH[level]];
  return from && to && to < from ? unit.id.slice(0, to) : undefined;
}

/**
 * The rate is the lab's formula, closures per 10,000 of the Unit's 2010 census residents, worked out here
 * because the chunk files' own rate columns rest on inflated denominators. No residents, no rate.
 */
export const rated = (closed: number | null, residents: number | null) => ({
  closed,
  per10k: closed !== null && residents ? (closed / residents) * 10_000 : null,
});
export type Stat = ReturnType<typeof rated>;

function reason({ near, via }: ExploreQuery, selected: Unit | undefined) {
  const what = near === "address" ? "the address you looked up" : near || via;
  if (!selected || !what || what === selected.name) return "";
  const { one } = LEVEL_NOUNS[selected.level];
  if (selected.level !== "state" && selected.level !== "county")
    return `The ${one} at the dot on the map, which marks ${what}. Click the map to see another ${one}.`;
  // Someone who named a city or an address is usually after something smaller than a state.
  return `The ${one} that contains ${what}.${near ? " View by ZCTA, Tract or Block group for a closer look." : ""}`;
}

export type Breakdown = Record<string, number | null>;
/**
 * What the panel can say. `locating`: the Unit under the Focus is being read. `outside`: no Unit of the
 * Level contains the Focus. `uncovered`: the source has no such Unit. `failed`: a file did not load. The
 * last three are different facts and never share a sentence with Zero closures or No observation.
 */
export type Status = "none" | "locating" | "outside" | "uncovered" | "failed" | "ok";

/**
 * `breakdown` is the Selection's reported closures in this window, per Type: null when the source does
 * not contain the Unit, "failed" when its Shard did not load. `context` does not depend on the window.
 */
export function selectionFor(
  query: ExploreQuery,
  breakdown: Breakdown | "failed" | null,
  context: Context | null = null,
  locating: boolean | "failed" = false
) {
  const selected = unitFor(query.where, query.level);
  const range = `${query.from}–${query.to}`;
  const type = TYPES[query.type];
  const counts = typeof breakdown === "object" ? breakdown : null;
  const status: Status =
    locating === true
      ? "locating"
      : locating === "failed" || breakdown === "failed"
        ? "failed"
        : !selected
          ? query.at
            ? "outside"
            : "none"
          : counts
            ? "ok"
            : "uncovered";
  const types = (Object.keys(TYPES) as TypeKey[])
    .filter((key) => key !== "all_religions")
    .map((key) => ({ key, label: TYPES[key].label, closed: counts?.[key] ?? null }));
  return {
    selected,
    status,
    stat: rated(counts?.[query.type] ?? null, context?.pop2010 ?? null),
    // Every Type with a count, largest first. Types with No observation are named together below them.
    types: types
      .filter((row) => row.closed !== null)
      .sort((a, b) => (b.closed ?? 0) - (a.closed ?? 0)),
    inactive: types.filter((row) => row.closed === null).map((row) => row.label),
    // Only what the lab publishes for this kind of Unit: ZIPs have fewer fields, block groups none.
    context: (Object.keys(CONTEXT_FIELDS) as ContextField[]).flatMap((key) => {
      const value = context?.[key];
      return value == null
        ? []
        : [{ key, label: CONTEXT_FIELDS[key].label, value: CONTEXT_FIELDS[key].format(value) }];
    }),
    range,
    name: selected?.name ?? "United States",
    // Why this Unit, when the visitor did not pick it: it lies at the Focus that a search set, or that they
    // were reading at another Level. At a Fine level it is one of many, and a click shows another.
    because: reason(query, selected),
    note: LEVEL_NOTES[query.level] ?? "",
    windowText: `${range} · ${query.to - query.from + 1} inclusive years · ${type.label.toLowerCase()}`,
    noun: type.noun,
    levelNoun: LEVEL_NOUNS[query.level].one,
    requestText: selected
      ? `Data for ${selected.name} (${LEVEL_NOUNS[selected.level].one}), ${range}.`
      : `State-level data for ${range}.`,
  };
}
export type Selection = ReturnType<typeof selectionFor>;
