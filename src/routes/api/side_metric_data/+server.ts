import MetricData from "$data/sideMetricData.csv";
import { error, json, type RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = ({ url }) => {
  const geoid = url.searchParams.get("geoid") ?? "00000";

  if (!/^\d{5}$/.test(geoid)) {
    error(400, "Invalid geoid");
  }

  const row = MetricData.find((candidate) => candidate.geoid === geoid);
  if (!row) {
    error(404, "Data not found");
  }

  return json(row);
};
