import { asset, resolve } from "$app/paths";
import { STATES, type Level, type LngLat } from "./model";

/**
 * Find a Location by what people type (ADR-0003): a state, county, ZIP or city resolves to a point
 * through the Census 2010 Gazetteer (scripts/build-gazetteer.py), loaded on the first keystroke. A
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
    .then((data) => ({ ...data, keys: data.rows.map((row) => plain(row[0])) }))
    .catch((cause) => ((names = undefined), Promise.reject(cause))));
const loadZips = () =>
  (zips ??= table<Record<string, LngLat>>("zips")
    .then((points) => ({ points, codes: Object.keys(points) }))
    .catch((cause) => ((zips = undefined), Promise.reject(cause))));

/** "Houston, Texas" and "houston tx" are the same request. */
export function plain(text: string) {
  const words = text.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  const state = STATES.find(({ name }) => words.endsWith(` ${name.toLowerCase()}`));
  return state ? `${words.slice(0, -state.name.length)}${state.abbreviation.toLowerCase()}` : words;
}

/** A house number, then a street: only the Geocoder can place it. */
export const looksLikeAddress = (text: string) => /^\s*\d+[a-z]?\s+\S*[a-z]/i.test(text);

export async function search(text: string, limit = 8): Promise<Hit[]> {
  const query = plain(text);
  if (/^\d+$/.test(query)) {
    // Two digits match hundreds of ZIPs, and no ZIP is longer than five.
    if (query.length < 3 || query.length > 5) return [];
    const { points, codes } = await loadZips();
    return codes
      .filter((code) => code.startsWith(query))
      .slice(0, limit)
      .map((code) => ({
        label: `ZIP ${code}`,
        kind: "ZIP code",
        at: points[code],
        unit: { level: "zcta", geoid: code },
      }));
  }
  if (query.length < 2) return [];
  const { states, rows, keys } = await loadNames();
  // Territories have no point, and no counts either.
  const hits: Hit[] = STATES.filter(
    ({ id, name, abbreviation }) =>
      states[id] && (name.toLowerCase().startsWith(query) || abbreviation.toLowerCase() === query)
  ).map(({ id, name }) => ({
    label: name,
    kind: "State",
    at: states[id],
    unit: { level: "state", geoid: id },
  }));
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
  const { states, rows } = await loadNames();
  if (unit.level === "state") return states[unit.id];
  const row = unit.level === "county" && rows.find((candidate) => candidate[2] === unit.id);
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
