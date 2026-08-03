import { error, json, type RequestHandler } from "@sveltejs/kit";
import { NATIONAL_GEOID, isNationalGeoid } from "$lib/domain/countyGeoid";
import { DASHBOARD_CACHE_CONTROL } from "./data/compressed-asset";

/**
 * One posture for every by-geoid data endpoint: default to the national
 * sentinel, reject malformed geoids, 404 misses, cache successes, and turn
 * unexpected failures into a 500. Datasets with no national row to serve
 * (side metrics) supply `national` to short-circuit the sentinel.
 */
export function createByGeoidEndpoint<T>(
  read: (geoid: string) => Promise<T | undefined>,
  options: { national?: () => unknown } = {}
): RequestHandler {
  return async ({ url }) => {
    try {
      const geoid = url.searchParams.get("geoid") || NATIONAL_GEOID;

      if (!/^\d{5}$/.test(geoid)) {
        throw error(400, "Invalid geoid");
      }

      if (options.national && isNationalGeoid(geoid)) {
        return json(options.national(), {
          headers: { "Cache-Control": DASHBOARD_CACHE_CONTROL },
        });
      }

      const result = await read(geoid);
      if (!result) {
        throw error(404, `No data found for geoid ${geoid}`);
      }

      return json(result, {
        headers: { "Cache-Control": DASHBOARD_CACHE_CONTROL },
      });
    } catch (err: any) {
      console.error("API Error:", err);
      if (err.status) throw err;
      throw error(500, "Internal server error");
    }
  };
}
