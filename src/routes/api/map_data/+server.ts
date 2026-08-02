import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { DASHBOARD_CACHE_CONTROL } from "$lib/server/data/compressed-asset";
import { readMapRange } from "$lib/server/data/map-data";

export interface CountyData {
  geoid: string;
  name: string;
  closure: number;
  closure_rate_per_10000: number;
  persistence: number;
  reopening: number;
}

function validateYearRange(from: number, to: number): { valid: boolean; error?: string } {
  // Check if years are within valid range
  if (from < 2001 || from > 2021 || to < 2001 || to > 2021) {
    return {
      valid: false,
      error: "Year range must be within 2001-2021",
    };
  }

  // Check if 'from' is before 'to'
  if (from > to) {
    return {
      valid: false,
      error: "Start year must be before or equal to end year",
    };
  }

  // Check minimum 5-year span
  if (to - from + 1 < 5) {
    return {
      valid: false,
      error: "Minimum 5-year span required",
    };
  }

  return { valid: true };
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Parse query parameters
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const geoidParam = url.searchParams.get("geoid");

    // Validate required parameters
    if (!fromParam || !toParam) {
      throw error(400, "Missing required parameters: from and to");
    }

    const from = parseInt(fromParam);
    const to = parseInt(toParam);

    if (isNaN(from) || isNaN(to)) {
      throw error(400, "from and to must be valid integers");
    }

    // Validate year range
    const validation = validateYearRange(from, to);
    if (!validation.valid) {
      throw error(400, validation.error!);
    }

    const dataText = await readMapRange(`${from}-${to}`);

    if (!dataText) {
      throw error(404, `Data not available for year range ${from}-${to}`);
    }

    if (geoidParam) {
      const county = (JSON.parse(dataText) as CountyData[]).find(
        (candidate) => candidate.geoid === geoidParam
      );
      if (!county) {
        throw error(404, `County with geoid ${geoidParam} not found`);
      }
      return json([county], {
        headers: { "Cache-Control": DASHBOARD_CACHE_CONTROL },
      });
    }

    return new Response(dataText, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": DASHBOARD_CACHE_CONTROL,
      },
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
