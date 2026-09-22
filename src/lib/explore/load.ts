import { browser } from "$app/environment";
import countyBreaks from "$lib/generated/county-breaks.json";
import {
  loadBreakdown,
  loadCounts,
  loadShard,
  valueAt,
  windowIndexOf,
  type Counts,
  type Shard,
} from "./metrics";
import {
  FIXED_BREAKS,
  breaksFor,
  unitFor,
  type ExploreQuery,
  type Level,
  type TypeKey,
} from "./model";
import { loadContext } from "./sdoh";

type National = { shard: Shard; counts: Counts } | null;

/** What Explore and the Summary both read for a Query: the states, the Selection's counts and its context. */
export async function loadSelection(query: ExploreQuery, fetcher: typeof fetch) {
  const unit = unitFor(query.where, query.level);
  // Shard files hold every Year Window and are cached once fetched, so after the first load a new
  // window, and a new Unit in an already loaded Shard, resolve without a request.
  // Whatever the server fetches here, SvelteKit writes into the document for the browser to read again,
  // as base64. So the server reads only what the page prints: the states, and one place (rows.bin).
  const work = Promise.all([
    Promise.all([
      loadShard("state", "us", fetcher),
      loadCounts("state", "us", query.type, fetcher),
    ]).then(([shard, counts]) => ({ shard, counts })),
    // The Selection's files fail on their own: the map keeps its colours and the panel says so.
    unit
      ? loadBreakdown(unit.level, unit.id, windowIndexOf(query.from, query.to), fetcher).catch(
          () => "failed" as const
        )
      : null,
    // Context is secondary: without it the panel still shows the counts.
    unit ? loadContext(unit.level, unit.id, fetcher).catch(() => null) : null,
  ]).catch(() => null);
  // The map paints counties from their matrix and fetches it itself; a browser can have that request on
  // its way before the map has mounted. Nothing here waits for it.
  if (browser && query.level === "county")
    void Promise.all([
      loadShard("county", "us", fetcher),
      loadCounts("county", "us", query.type, fetcher),
    ]).catch(() => undefined);
  // A stalled response must not leave navigation waiting indefinitely.
  let timeout: ReturnType<typeof setTimeout>;
  const loaded = await Promise.race([
    work,
    new Promise<null>((resolve) => {
      timeout = setTimeout(() => resolve(null), 10_000);
    }),
  ]).finally(() => clearTimeout(timeout));
  if (!loaded)
    return {
      query,
      states: null,
      breakdown: null,
      context: null,
      error: "Data could not be loaded. Please retry.",
    };
  const [states, breakdown, context] = loaded;
  return { query, states, breakdown, context, error: null };
}

/** A national Shard's reported closures in one Year Window, in the Shard's row order. */
export const countsIn = (national: National, yearWindow: number) =>
  national?.shard.geoids.map((_, row) => valueAt(national.counts, row, yearWindow)) ?? [];

/**
 * The page owns the legend, so it names the breaks of every Level that can be on screen. The counties'
 * were worked out for every Type and Year Window when their release was built
 * (scripts/build-county-breaks.py), so no page needs their matrix.
 */
export const levelBreaks = (
  states: National,
  type: TypeKey,
  yearWindow: number
): Record<Level, number[]> => ({
  state: breaksFor(countsIn(states, yearWindow)),
  county: (countyBreaks.breaks as Record<string, number[][]>)[type]?.[yearWindow] ?? [],
  ...FIXED_BREAKS,
});
