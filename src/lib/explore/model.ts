import blockGroupManifest from "$lib/generated/blockgroup-manifest.json";
import manifest from "$lib/generated/state-manifest.json";

export { blockGroupManifest, manifest };
export const LEVELS = ["state", "blockgroup"] as const;
export type Level = (typeof LEVELS)[number];
export const WINDOWS = manifest.windows;
export const FROM_YEARS = [...new Set(WINDOWS.map((window) => window.from))].sort((a, b) => a - b);
export const TYPES = Object.fromEntries(
  manifest.religions.map((religion) => [
    religion,
    { label: "All places of worship", noun: "places of worship" },
  ])
);
export type TypeKey = Extract<keyof typeof TYPES, string>;

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
export interface StateMetric extends Stat {
  geoid: string;
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

export const BREAKS = manifest.breaks;
export const NO_DATA_COLOR = "#d9dde2";
const COLORS = ["#dce5f1", "#a6bedf", "#6c93c7", "#3565a8", "#00356b"];
const thresholdLabel = (value: number) =>
  value.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
/** `exact` names whole counts ("0", "2–3") where the breaks are small enough to read that way. */
const classesFor = (breaks: number[], exact = false) =>
  COLORS.map((color, index) => {
    const low = breaks[index - 1] ?? 0;
    const high = breaks[index];
    const label = exact
      ? high === undefined
        ? `${low}+`
        : high - 1 === low
          ? `${low}`
          : `${low}–${high - 1}`
      : index === 0
        ? `<${thresholdLabel(high)}`
        : high === undefined
          ? `${thresholdLabel(low)}+`
          : `${thresholdLabel(low)}–<${thresholdLabel(high)}`;
    return { color, label };
  });
export const CLASSES = classesFor(BREAKS);
export const LEGENDS = {
  state: { breaks: BREAKS, classes: CLASSES },
  blockgroup: {
    breaks: blockGroupManifest.breaks,
    classes: classesFor(blockGroupManifest.breaks, true),
  },
};

/** "Tract 101.01 · Block group 1" from a 12-digit block-group GEOID. */
export function blockGroupLabel(geoid: string) {
  const suffix = geoid.slice(9, 11);
  return `Tract ${Number(geoid.slice(5, 9))}${suffix === "00" ? "" : `.${suffix}`} · Block group ${geoid[11]}`;
}
export const classOf = (value: number | null) =>
  value === null ? -1 : BREAKS.filter((threshold) => value >= threshold).length;

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
  type: manifest.religions[0],
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
    type: type && Object.hasOwn(TYPES, type) ? type : DEFAULT_QUERY.type,
    level: params.get("level") === "blockgroup" ? "blockgroup" : "state",
  };
}

export function selectionFor(query: ExploreQuery, rows: StateMetric[]) {
  const selected = findState(query.where);
  const byId = new Map(rows.map((row) => [row.geoid, row]));
  const stat: Stat = (selected && byId.get(selected.id)) || {
    closed: null,
    per10k: null,
    nOpen: null,
  };
  const range = `${query.from}–${query.to}`;
  const type = TYPES[query.type];
  return {
    selected,
    byId,
    stat,
    range,
    name: selected?.name ?? "United States",
    windowText: `${range} · ${query.to - query.from + 1} inclusive years · ${type.label.toLowerCase()}`,
    noun: type.noun,
    requestText: selected
      ? `State data for ${selected.name}, ${range}.`
      : `State-level data for ${range}.`,
  };
}
export type Selection = ReturnType<typeof selectionFor>;
