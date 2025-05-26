import { json, type RequestHandler } from "@sveltejs/kit";
import all_geoids from "$data/geoids.json";

import type { DataPoint } from "$lib/types";

function generateMockDataPoint(geoid: string, year: number): DataPoint {
  const basePopulation = Math.floor(Math.random() * 50000) + 10000;

  return {
    geoid,
    year,
    close: Math.floor(Math.random() * 10),
    persistence: Math.floor(Math.random() * 20) + 80, // 80-100%
    new: Math.floor(Math.random() * 8),
    n_medincome: Math.floor(Math.random() * 30000) + 40000,
    n_pop_total: basePopulation,
    n_pop_black: Math.floor(basePopulation * (Math.random() * 0.4)),
    n_pop_hisp: Math.floor(basePopulation * (Math.random() * 0.3)),
    p_pct_black: Math.random() * 40,
    p_pct_hisp: Math.random() * 30,
    p_renter: Math.random() * 60 + 20,
    p_poverty: Math.random() * 25,
    p_unemp: Math.random() * 15,
    p_overcrowding: Math.random() * 10,
    n_med_rent: Math.floor(Math.random() * 1000) + 800,
    p_mobility: Math.random() * 20,
    n_pop_25: Math.floor(basePopulation * 0.6),
    n_pop_65p: Math.floor(basePopulation * 0.15),
    p_pct_65p: Math.random() * 20 + 10,
    n_edu_yes_hs: Math.floor(basePopulation * 0.8),
    n_edu_no_hs: Math.floor(basePopulation * 0.2),
    p_edu_no_hs: Math.random() * 25,
    n_commhlthcntr: Math.floor(Math.random() * 5),
    r_commhlthcntr_100k: Math.random() * 50,
    i_gini: Math.random() * 0.3 + 0.3, // 0.3-0.6
    d_pop_sqkm: Math.random() * 1000 + 50,
  };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { from, to, geoid } = await request.json();

    // Validate input
    if (!from || !to || from > to) {
      return json({ error: "Invalid year range" }, { status: 400 });
    }

    const mockData: DataPoint[] = [];
    const geoIds = geoid ? [geoid] : all_geoids;

    // Generate data for each year in range and each geoid
    for (let year = from; year <= to; year++) {
      for (const geoId of geoIds) {
        mockData.push(generateMockDataPoint(geoId, year));
      }
    }

    // Add some delay to simulate real API
    await new Promise((resolve) => setTimeout(resolve, 100));

    return json(mockData);
  } catch (error) {
    return json({ error: "Invalid request body" }, { status: 400 });
  }
};
