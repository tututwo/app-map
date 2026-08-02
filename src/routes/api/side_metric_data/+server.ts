import { error, json, type RequestHandler } from "@sveltejs/kit";
import { readSideMetric } from "$lib/server/data/side-metric-data";

export const GET: RequestHandler = async ({ url }) => {
  const geoid = url.searchParams.get("geoid") ?? "00000";

  if (!/^\d{5}$/.test(geoid)) {
    throw error(400, "Invalid geoid");
  }

  if (geoid === "00000") {
    return json({ geoid });
  }

  const row = await readSideMetric(geoid);
  if (!row) {
    throw error(404, "Data not found");
  }

  return json(row);
};
