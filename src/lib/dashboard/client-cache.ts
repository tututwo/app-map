import { browser } from "$app/environment";
import { createDashboardResultCache } from "./data";

export const dashboardResultCache = browser ? createDashboardResultCache() : undefined;
