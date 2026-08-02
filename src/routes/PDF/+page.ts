import { dashboardResultCache } from "$lib/dashboard/client-cache";
import { loadDashboardData, type DashboardPart } from "$lib/dashboard/data";
import { parseDashboardParams } from "$lib/dashboard/params";

import type { PageLoad } from "./$types";

const PDF_PARTS = new Set<DashboardPart>(["map", "line", "side"]);

export const load: PageLoad = async ({ fetch, depends, url }) => {
  const params = parseDashboardParams(url);
  const results = await loadDashboardData(
    { fetch, depends, cache: dashboardResultCache },
    params,
    PDF_PARTS
  );

  return { params, results };
};
