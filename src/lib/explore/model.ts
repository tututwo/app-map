// Prototype data model from docs/design_handoff_worship_closures (README
// "Interactions & Behavior" + the STATES table in the prototype). It stands in
// for the real API: replace `STATES`/`compute` when Ryan's data lands.

export const FROM_MIN = 2000;
export const FROM_MAX = 2018;
export const TO_MAX = 2023;
export const GAP = 5;
export const FROM_YEARS = Array.from({ length: FROM_MAX - FROM_MIN + 1 }, (_, i) => FROM_MIN + i);

export const TYPES = {
  all: { label: "All places of worship", noun: "places of worship", share: 1, factor: 1 },
  christian: {
    label: "Christian congregations",
    noun: "Christian congregations",
    share: 0.87,
    factor: 0.97,
  },
  synagogues: { label: "Synagogues", noun: "synagogues", share: 0.011, factor: 0.8 },
  mosques: { label: "Mosques", noun: "mosques", share: 0.008, factor: 0.55 },
  temples: {
    label: "Temples & other",
    noun: "temples and other places of worship",
    share: 0.024,
    factor: 0.9,
  },
} as const;
export type TypeKey = keyof typeof TYPES;

export interface StateRow {
  id: string;
  name: string;
  /** Tile-grid position (12 columns), kept for the map step. */
  col: number;
  row: number;
  /** Five-year closure rate, %, all types. */
  rate: number;
  /** Places open in 2010. */
  open: number;
  /** Largest county — prefills the data request. */
  county: string;
}

const ROWS: [string, string, number, number, number, number, string][] = [
  ["AK", "Alaska", 0, 0, 1.6, 1100, "Anchorage Municipality"],
  ["ME", "Maine", 11, 0, 3.1, 1500, "Cumberland County"],
  ["WI", "Wisconsin", 5, 1, 7.9, 6300, "Milwaukee County"],
  ["VT", "Vermont", 9, 1, 10.1, 900, "Chittenden County"],
  ["NH", "New Hampshire", 10, 1, 6.1, 1200, "Hillsborough County"],
  ["WA", "Washington", 0, 2, 8.7, 5600, "King County"],
  ["ID", "Idaho", 1, 2, 1.4, 1700, "Ada County"],
  ["MT", "Montana", 2, 2, 3.6, 1400, "Yellowstone County"],
  ["ND", "North Dakota", 3, 2, 4.6, 1300, "Cass County"],
  ["MN", "Minnesota", 4, 2, 5.2, 6200, "Hennepin County"],
  ["IL", "Illinois", 5, 2, 5.8, 14200, "Cook County"],
  ["MI", "Michigan", 6, 2, 6.8, 11100, "Wayne County"],
  ["NY", "New York", 8, 2, 6.4, 16400, "Kings County"],
  ["MA", "Massachusetts", 9, 2, 9.8, 4900, "Middlesex County"],
  ["OR", "Oregon", 0, 3, 7.8, 3700, "Multnomah County"],
  ["NV", "Nevada", 1, 3, 11.2, 1800, "Clark County"],
  ["WY", "Wyoming", 2, 3, 2.8, 700, "Laramie County"],
  ["SD", "South Dakota", 3, 3, 1.9, 1400, "Minnehaha County"],
  ["IA", "Iowa", 4, 3, 3.9, 4600, "Polk County"],
  ["IN", "Indiana", 5, 3, 6.327, 9800, "Marion County"],
  ["OH", "Ohio", 6, 3, 9.3, 14800, "Franklin County"],
  ["PA", "Pennsylvania", 7, 3, 3.4, 15900, "Philadelphia County"],
  ["NJ", "New Jersey", 8, 3, 4.7, 6900, "Bergen County"],
  ["CT", "Connecticut", 9, 3, 3.7, 3600, "New Haven County"],
  ["RI", "Rhode Island", 10, 3, 7.5, 1000, "Providence County"],
  ["CA", "California", 0, 4, 10.4, 27500, "Los Angeles County"],
  ["UT", "Utah", 1, 4, 5.1, 4800, "Salt Lake County"],
  ["CO", "Colorado", 2, 4, 1.8, 4900, "Denver County"],
  ["NE", "Nebraska", 3, 4, 7.2, 2600, "Douglas County"],
  ["MO", "Missouri", 4, 4, 4.4, 8700, "St. Louis County"],
  ["KY", "Kentucky", 5, 4, 6.9, 7900, "Jefferson County"],
  ["WV", "West Virginia", 6, 4, 6.1, 3400, "Kanawha County"],
  ["VA", "Virginia", 7, 4, 7.4, 9300, "Fairfax County"],
  ["MD", "Maryland", 8, 4, 6.6, 5600, "Montgomery County"],
  ["DE", "Delaware", 9, 4, 6.8, 1000, "New Castle County"],
  ["AZ", "Arizona", 1, 5, 1.7, 6200, "Maricopa County"],
  ["NM", "New Mexico", 2, 5, 5.6, 2300, "Bernalillo County"],
  ["KS", "Kansas", 3, 5, 9.6, 4100, "Johnson County"],
  ["AR", "Arkansas", 4, 5, 3.3, 6400, "Pulaski County"],
  ["TN", "Tennessee", 5, 5, 6.7, 10900, "Shelby County"],
  ["NC", "North Carolina", 6, 5, 7.1, 13900, "Mecklenburg County"],
  ["SC", "South Carolina", 7, 5, 6.2, 7400, "Greenville County"],
  ["DC", "District of Columbia", 8, 5, 6.0, 800, "District of Columbia"],
  ["OK", "Oklahoma", 3, 6, 6.9, 6100, "Oklahoma County"],
  ["LA", "Louisiana", 4, 6, 4.9, 6800, "East Baton Rouge Parish"],
  ["MS", "Mississippi", 5, 6, 7.0, 6500, "Hinds County"],
  ["AL", "Alabama", 6, 6, 7.3, 9600, "Jefferson County"],
  ["GA", "Georgia", 7, 6, 6.5, 12900, "Fulton County"],
  ["HI", "Hawaii", 0, 7, 6.2, 1200, "Honolulu County"],
  ["TX", "Texas", 3, 7, 4.8, 27300, "Harris County"],
  ["FL", "Florida", 8, 7, 6.4, 17800, "Miami-Dade County"],
];
export const STATES: StateRow[] = ROWS.map(([id, name, col, row, rate, open, county]) => ({
  id,
  name,
  col,
  row,
  rate,
  open,
  county,
}));

export interface Stat {
  open: number;
  rate: number;
  closed: number;
  /** Fewer than 15 places in the baseline year: no rate is reported. */
  nodata: boolean;
}

export function compute(state: StateRow, from: number, to: number, type: TypeKey): Stat {
  const t = TYPES[type];
  const open = Math.round(state.open * t.share);
  const rate = Math.min(60, state.rate * t.factor * ((to - from) / GAP) ** 0.85);
  return { open, rate, closed: Math.round((open * rate) / 100), nodata: open < 15 };
}

/** Exact name or abbreviation first, then a name prefix. */
export function findState(text: string): StateRow | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  return (
    STATES.find((s) => s.name.toLowerCase() === t || s.id.toLowerCase() === t) ??
    STATES.find((s) => s.name.toLowerCase().startsWith(t))
  );
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
export const pct = (rate: number) => `${rate.toFixed(1)}%`;

/** Fixed rate classes: same shade = same rate in every view and window. */
export const CLASSES = [
  { label: "Under 2%", color: "#dce5f1" },
  { label: "2–3.9%", color: "#a6bedf" },
  { label: "4–5.9%", color: "#6c93c7" },
  { label: "6–8.9%", color: "#3565a8" },
  { label: "9%+", color: "#00356b" },
];
export const classOf = (rate: number) =>
  rate < 2 ? 0 : rate < 4 ? 1 : rate < 6 ? 2 : rate < 9 ? 3 : 4;

// ---- Applied query --------------------------------------------------------
// The URL carries the whole applied query (where · from · to · type) so share
// links reproduce a view; `where` is the landing bar's text or a state name.

export interface ExploreQuery {
  where: string;
  from: number;
  to: number;
  type: TypeKey;
}

export const DEFAULT_QUERY: ExploreQuery = { where: "", from: 2010, to: 2015, type: "all" };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const year = (value: string | null, fallback: number) =>
  value !== null && /^\d{4}$/.test(value) ? Number(value) : fallback;

export function parseExploreQuery(params: URLSearchParams): ExploreQuery {
  const from = clamp(year(params.get("from"), DEFAULT_QUERY.from), FROM_MIN, FROM_MAX);
  const to = clamp(year(params.get("to"), DEFAULT_QUERY.to), from + GAP, TO_MAX);
  const type = params.get("type");
  return {
    where: params.get("where") ?? "",
    from,
    to,
    type: type && type in TYPES ? (type as TypeKey) : DEFAULT_QUERY.type,
  };
}

/** Everything the Explore screen shows for one applied query. */
export function selectionFor(query: ExploreQuery) {
  const selected = findState(query.where);
  const byId = new Map(STATES.map((s) => [s.id, compute(s, query.from, query.to, query.type)]));
  let open = 0;
  let closed = 0;
  for (const s of byId.values()) {
    open += s.open;
    closed += s.closed;
  }
  const us: Stat = { open, closed, rate: open ? (closed / open) * 100 : 0, nodata: false };
  const range = `${query.from}–${query.to}`;
  const type = TYPES[query.type];
  return {
    selected,
    byId,
    us,
    stat: selected ? byId.get(selected.id)! : us,
    range,
    name: selected?.name ?? "United States",
    windowText: `${range} · ${query.to - query.from}-year window · ${type.label.toLowerCase()}`,
    noun: type.noun,
    requestText: selected
      ? `Short form, prefilled with ${selected.county}, ${selected.id}, ${range}.`
      : `Short form, prefilled with the United States, ${range}.`,
  };
}
export type Selection = ReturnType<typeof selectionFor>;
