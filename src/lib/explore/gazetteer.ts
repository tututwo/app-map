import { asset, resolve } from "$app/paths";
import { STATES, type Level, type LngLat } from "./model";

/**
 * Find a Location by what people type (ADR-0003): a state, county, ZIP or city resolves to a point
 * through the Census 2010 Gazetteer (scripts/build-gazetteer.py), loaded when the box gets focus. A
 * street address is not in any table; it goes to the Geocoder when the user submits it.
 */
export interface Hit {
  label: string;
  kind: string;
  /** A point inside the Location: the Focus it sets. */
  at: LngLat;
  /** A Location that is itself a Unit names it, and the search moves to its Level. */
  unit?: { level: Level; geoid: string };
}

type Row = [label: string, kind: string, geoid: string, lng: number, lat: number];
let names: Promise<{ states: Record<string, LngLat>; rows: Row[]; keys: string[] }> | undefined;
let zips: Promise<{ points: Record<string, LngLat>; codes: string[] }> | undefined;

async function table<T>(name: "names" | "zips") {
  const response = await fetch(asset(`/gazetteer/${name}.json`));
  if (!response.ok) throw new Error(`${response.status} for the ${name} gazetteer`);
  return (await response.json()) as T;
}
// A failed download is forgotten, so the next keystroke tries again.
const loadNames = () =>
  (names ??= table<{ states: Record<string, LngLat>; rows: Row[] }>("names")
    .then((data) => ({ ...data, keys: data.rows.map((row) => fold(row[0])) }))
    .catch((cause) => ((names = undefined), Promise.reject(cause))));
/** Someone in the search box is about to type: the names are on their way before the first letter. */
export const warm = () => void loadNames().catch(() => undefined);
const loadZips = () =>
  (zips ??= table<Record<string, LngLat>>("zips")
    .then((points) => ({ points, codes: Object.keys(points) }))
    .catch((cause) => ((zips = undefined), Promise.reject(cause))));

// The Census writes "St. Louis", "Fort Worth" and "Mount Vernon"; people also write Saint, Ft and Mt.
// Mt only before a name: at the end, MT is Montana.
const SPELLED: Record<string, string> = { saint: "st", ft: "fort", mt: "mount" };
/** Case, punctuation and spelling that people vary: "Winston Salem", "lees summit", "Ft. Worth". */
const fold = (text: string) =>
  text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[.,/-]/g, " ")
    .replace(/\b(saint|ft)\b|\bmt\b(?=\s+[a-z])/g, (word) => SPELLED[word])
    .replace(/\s+/g, " ")
    .trim();

// Longest first: "charleston west virginia" also ends with " virginia". Lowercased once, not per row.
const STATE_ENDINGS = STATES.map(
  ({ name, abbreviation }) => [` ${name.toLowerCase()}`, abbreviation.toLowerCase()] as const
).sort((a, b) => b[0].length - a[0].length);
const STATE_NAMES = new Set(STATES.map(({ name }) => name.toLowerCase()));

/** "Houston, Texas" and "houston tx" are the same request. A state's own name stays as typed. */
export function plain(text: string) {
  const words = fold(text);
  if (STATE_NAMES.has(words)) return words;
  const ending = STATE_ENDINGS.find(([name]) => words.endsWith(name));
  return ending ? `${words.slice(0, 1 - ending[0].length)}${ending[1]}` : words;
}

/** A house number, then a street: only the Geocoder can place it. */
export const looksLikeAddress = (text: string) => /^\s*\d+[a-z]?\s+\S*[a-z]/i.test(text);

const zipHit = (code: string, at: LngLat): Hit => ({
  label: `ZCTA ${code}`,
  kind: "ZCTA",
  at,
  unit: { level: "zcta", geoid: code },
});

export async function search(text: string, limit = 8): Promise<Hit[]> {
  const typed = plain(text);
  if (/^\d+$/.test(typed)) {
    // Two digits match hundreds of ZIPs, and no ZIP is longer than five.
    if (typed.length < 3 || typed.length > 5) return [];
    const { points, codes } = await loadZips();
    return codes
      .filter((code) => code.startsWith(typed))
      .slice(0, limit)
      .map((code) => zipHit(code, points[code]));
  }
  // A ZIP among other words: "New Haven 06511", "zip 06511", "06511-1234".
  const code = typed.match(/(?:^| )(\d{5})(?= |$)/)?.[1];
  const point = code && (await loadZips()).points[code];
  const hits: Hit[] = point ? [zipHit(code, point)] : [];
  // An address is in no table of names: a ZIP inside it is all the Gazetteer can offer beside the Geocoder.
  if (looksLikeAddress(text)) return hits;
  // Without its numbers, so that "New Haven, Connecticut 06511" still ends with a state.
  const query = plain(typed.replace(/(^| )\d+(?= |$)/g, ""));
  if (query.length < 2) return hits;
  const { states, rows, keys } = await loadNames();
  // Territories have no point, and no counts either.
  hits.push(
    ...STATES.filter(
      ({ id, name, abbreviation }) =>
        states[id] && (name.toLowerCase().startsWith(query) || abbreviation.toLowerCase() === query)
    ).map(
      ({ id, name }): Hit => ({
        label: name,
        kind: "State",
        at: states[id],
        unit: { level: "state", geoid: id },
      })
    )
  );
  // Rows come most residents first, so the first matches are the likely ones. Names that start with
  // the text go before names that merely contain it.
  const inside: Hit[] = [];
  for (let index = 0; index < rows.length && hits.length < limit; index++) {
    const position = keys[index].indexOf(query);
    if (position < 0) continue;
    const [label, kind, geoid, lng, lat] = rows[index];
    const unit = geoid ? { level: "county" as const, geoid } : undefined;
    const hit: Hit = { label, kind, at: [lng, lat], unit };
    if (position === 0) hits.push(hit);
    else if (inside.length < limit) inside.push(hit);
  }
  return [...hits, ...inside].slice(0, limit);
}

/**
 * A point inside a state, county or ZIP: the Focus for a link that names a Unit only (Home's form, links
 * from before ADR-0003), so that View by can answer for it at the other Levels too.
 */
export async function pointOf(unit: { level: Level; id: string }): Promise<LngLat | undefined> {
  if (unit.level === "zcta") return (await loadZips()).points[unit.id];
  if (unit.level !== "state" && unit.level !== "county") return undefined;
  const { states, rows } = await loadNames();
  if (unit.level === "state") return states[unit.id];
  const row = rows.find((candidate) => candidate[2] === unit.id);
  return row ? [row[3], row[4]] : undefined;
}

/** Null when the Geocoder finds no such address; throws when it cannot be reached. */
export async function geocode(address: string): Promise<{ at: LngLat; label: string } | null> {
  const response = await fetch(resolve("/api/geocode"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!response.ok) throw new Error(`Address lookup failed: ${response.status}`);
  return ((await response.json()) as { match: { at: LngLat; label: string } | null }).match;
}
