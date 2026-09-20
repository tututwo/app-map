import {
  loadBreakdown,
  loadCounts,
  loadShard,
  valueAt,
  windowIndexOf,
  type Counts,
  type Shard,
} from "./metrics";
import { FIXED_BREAKS, breaksFor, unitFor, type ExploreQuery, type Level } from "./model";
import { loadContext } from "./sdoh";

type National = { shard: Shard; counts: Counts } | null;

/** What Explore and the Summary both read for a Query: the states, the Selection's counts and its context. */
export async function loadSelection(query: ExploreQuery, fetcher: typeof fetch) {
  const unit = unitFor(query.where, query.level);
  // Shard files hold every Year Window and are cached once fetched, so after the first load a new
  // window, and a new Unit in an already loaded Shard, resolve without a request.
  // ponytail: a block-group deep link makes the server fetch that state's ten Type files; load the
  // breakdown in the browser instead if that ever shows up in server timings.
  const national = (level: "state" | "county") =>
    Promise.all([
      loadShard(level, "us", fetcher),
      loadCounts(level, "us", query.type, fetcher),
    ]).then(([shard, counts]) => ({ shard, counts }));
  const work = Promise.all([
    national("state"),
    // The page names the county legend, so it needs the counties' counts too.
    query.level === "county" ? national("county") : null,
    // The Selection's files fail on their own: the map keeps its colours and the panel says so.
    unit
      ? loadBreakdown(unit.level, unit.id, windowIndexOf(query.from, query.to), fetcher).catch(
          () => "failed" as const
        )
      : null,
    // Context is secondary: without it the panel still shows the counts.
    unit ? loadContext(unit.level, unit.id, fetcher).catch(() => null) : null,
  ]).catch(() => null);
  // A stalled response must not leave navigation waiting indefinitely.
  const loaded = await Promise.race([
    work,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
  ]);
  if (!loaded)
    return {
      query,
      states: null,
      counties: null,
      breakdown: null,
      context: null,
      error: "Data could not be loaded. Please retry.",
    };
  const [states, counties, breakdown, context] = loaded;
  return { query, states, counties, breakdown, context, error: null };
}

/** A national Shard's reported closures in one Year Window, in the Shard's row order. */
export const countsIn = (national: National, yearWindow: number) =>
  national?.shard.geoids.map((_, row) => valueAt(national.counts, row, yearWindow)) ?? [];

/** The page owns the legend, so it names the breaks of every Level that can be on screen. */
export const levelBreaks = (
  data: { states: National; counties: National },
  yearWindow: number
): Record<Level, number[]> => ({
  state: breaksFor(countsIn(data.states, yearWindow)),
  county: breaksFor(countsIn(data.counties, yearWindow)),
  ...FIXED_BREAKS,
});
