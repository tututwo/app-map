import { loadSelection } from "$lib/explore/load";
import { parseExploreQuery } from "$lib/explore/model";
import type { PageLoad } from "./$types";

export const load: PageLoad = ({ url, fetch }) =>
  loadSelection(parseExploreQuery(url.searchParams), fetch);
