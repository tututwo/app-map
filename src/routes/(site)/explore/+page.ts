import { loadBreakdown, loadCounts, loadShard, windowIndexOf } from "$lib/explore/metrics";
import { parseExploreQuery, placeFor } from "$lib/explore/model";
import { loadContext } from "$lib/explore/sdoh";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ url, fetch }) => {
  const query = parseExploreQuery(url.searchParams);
  const place = placeFor(query.where, query.level);
  // Shard files hold every Year Window and are cached once fetched, so after the first load a new
  // window, and a new place in an already loaded Shard, resolve without a request.
  // ponytail: a block-group deep link makes the server fetch that state's ten Type files; load the
  // breakdown in the browser instead if that ever shows up in server timings.
  const national = (level: "state" | "county") =>
    Promise.all([loadShard(level, "us", fetch), loadCounts(level, "us", query.type, fetch)]).then(
      ([shard, counts]) => ({ shard, counts })
    );
  const work = Promise.all([
    national("state"),
    // The page names the county legend, so it needs the counties' counts too.
    query.level === "county" ? national("county") : null,
    place ? loadBreakdown(place.level, place.id, windowIndexOf(query.from, query.to), fetch) : null,
    // Context is secondary: without it the panel still shows the counts.
    place ? loadContext(place.level, place.id, fetch).catch(() => null) : null,
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
};
