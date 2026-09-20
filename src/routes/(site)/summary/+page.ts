import { loadSelection } from "$lib/explore/load";
import { parentOf, parseExploreQuery, unitFor } from "$lib/explore/model";
import { loadContext, loadStateContexts } from "$lib/explore/sdoh";
import type { PageLoad } from "./$types";

// The Summary reads Explore's Query, so a link to one is a link to the other.
export const load: PageLoad = async ({ url, fetch }) => {
  const query = parseExploreQuery(url.searchParams);
  const unit = unitFor(query.where, query.level);
  const tract = unit?.level === "blockgroup" && parentOf(unit, "tract");
  const [selection, stateContexts, tractContext] = await Promise.all([
    loadSelection(query, fetch),
    // What the place is set beside. The page still stands without it.
    loadStateContexts(fetch).catch(() => null),
    // Block groups have residents only; their tract carries the community measures.
    tract ? loadContext("tract", tract, fetch).catch(() => null) : null,
  ]);
  return { ...selection, stateContexts, tractContext };
};
