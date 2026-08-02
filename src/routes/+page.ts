import { dashboardResultCache } from "$lib/dashboard/client-cache";
import { loadDashboardData, type DashboardPart } from "$lib/dashboard/data";
import { parseDashboardParams } from "$lib/dashboard/params";

import type { PageLoad } from "./$types";

const DASHBOARD_PARTS = new Set<DashboardPart>(["map", "line", "stacked", "side"]);

export const load: PageLoad = async ({ fetch, depends, url }) => {
  const params = parseDashboardParams(url);
  const results = await loadDashboardData(
    { fetch, depends, cache: dashboardResultCache },
    params,
    DASHBOARD_PARTS
  );

  return { params, results };
};
