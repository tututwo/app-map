import { json, type RequestHandler } from "@sveltejs/kit";
import all_geoids from "$data/geoids.json";
import type { CountyDataPoint } from "$lib/types";

function generateMockCountyData(geoid: string): CountyDataPoint {
  const baseClosings = Math.floor(Math.random() * 15);
  const populationDensity = Math.random() * 1000 + 50; // people per sq km

  return {
    geoid,
    close: baseClosings,
    close_r_100k: (baseClosings / populationDensity) * 100000,
    close_r_sqkm: baseClosings / (Math.random() * 500 + 100), // random area
  };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { from, to } = await request.json();

    // Validate input
    if (!from || !to || from > to) {
      return json({ error: "Invalid year range" }, { status: 400 });
    }

    // Generate mock data for approximately 3000 counties (as mentioned in the original function)
    const mockData: CountyDataPoint[] = [];

    // Use sample counties and generate additional ones to reach ~3000
    const allCounties = [...all_geoids];

    // Generate additional random county GEOIDs to simulate ~3000 counties
    while (allCounties.length < 3000) {
      const stateCode = String(Math.floor(Math.random() * 56) + 1).padStart(2, "0");
      const countyCode = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
      const geoid = stateCode + countyCode;

      if (!allCounties.includes(geoid)) {
        allCounties.push(geoid);
      }
    }

    // Generate data for each county
    for (const geoid of allCounties) {
      mockData.push(generateMockCountyData(geoid));
    }

    // Add some delay to simulate real API
    await new Promise((resolve) => setTimeout(resolve, 200));

    return json(mockData);
  } catch (error) {
    return json({ error: "Invalid request body" }, { status: 400 });
  }
};
