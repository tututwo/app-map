import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { DASHBOARD_CACHE_CONTROL } from "$lib/server/data/compressed-asset";
import { readLineSeries } from "$lib/server/data/line-data";

export const GET: RequestHandler = async ({ url }) => {
  try {
    const geoidParam = url.searchParams.get("geoid");

    const lookupGeoid = geoidParam && geoidParam !== "00000" ? geoidParam : "00000";
    const result = await readLineSeries(lookupGeoid);

    if (!result) {
      throw error(404, `No data found for geoid ${geoidParam}`);
    }

    return json(result, {
      headers: { "Cache-Control": DASHBOARD_CACHE_CONTROL },
    });
  } catch (err: any) {
    console.error("API Error:", err);

    // If it's already a SvelteKit error, re-throw it
    if (err.status) {
      throw err;
    }

    // Otherwise, return a generic 500 error
    throw error(500, "Internal server error");
  }
};
