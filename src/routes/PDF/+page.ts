import { getLineSeries, getMapData, getSideMetric } from "$lib/dashboard/data.remote";
import { parseDashboardParams } from "$lib/dashboard/params";

import type { PageLoad } from "./$types";

// Resolve the report's remote queries before render so the page — including
// server-rendered HTML — awaits already-settled instances instead of showing
// the boundary's pending state.
export const load: PageLoad = async ({ url }) => {
  const { from, to, geoid } = parseDashboardParams(url);

  await Promise.allSettled([getMapData({ from, to }), getLineSeries(geoid), getSideMetric(geoid)]);
};
