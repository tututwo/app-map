import { error, type RequestHandler } from "@sveltejs/kit";
import { socialDeterminantMetricConfigs } from "$lib/config/sideMetrics";
import {
  NATIONAL_GEOID,
  isConnecticutPlanningRegionGeoid,
  isNationalGeoid,
  normalizeCountyGeoid,
} from "$lib/domain/countyGeoid";
import { yearWindowViolation } from "$lib/domain/yearWindow";
import type { MapDatum } from "$lib/dashboard/data";
import { readLineSeries, readSideMetric, readStackedSeries } from "$lib/server/data/by-geoid";
import { readMapRange } from "$lib/server/data/map-data";
import { createSideMetricData } from "$lib/utils/sideMetricTransformation";
import { csvFormat } from "d3";
import JSZip from "jszip";

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Parse query parameters
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const requestedGeoid = url.searchParams.get("geoid") ?? NATIONAL_GEOID;
    const geoid = normalizeCountyGeoid(requestedGeoid);

    // Validate required parameters
    if (!fromParam || !toParam) {
      throw error(400, "Missing required parameters: from and to");
    }

    const from = parseInt(fromParam);
    const to = parseInt(toParam);

    if (isNaN(from) || isNaN(to)) {
      throw error(400, "from and to must be valid integers");
    }

    if (!/^\d{5}$/.test(geoid)) {
      throw error(400, "Invalid geoid");
    }

    if (yearWindowViolation(from, to)) {
      throw error(400, "Failed to fetch map data");
    }

    // Read the generated datasets directly
    const [lineSeries, stackedSeries, mapText] = await Promise.all([
      readLineSeries(geoid),
      readStackedSeries(geoid),
      readMapRange(`${from}-${to}`),
    ]);

    if (!lineSeries) {
      throw error(404, "Failed to fetch line chart data");
    }
    if (!stackedSeries) {
      throw error(404, "Failed to fetch stacked bar data");
    }

    const mapData = mapText
      ? (JSON.parse(mapText) as MapDatum[]).filter((row) => row.geoid === geoid)
      : [];

    // Connecticut planning regions have no map rows; their download ships an
    // empty map CSV instead of failing the whole archive.
    if (mapData.length === 0 && !isConnecticutPlanningRegionGeoid(geoid)) {
      throw error(404, "Failed to fetch map data");
    }

    const lineChartData = lineSeries.filter((row) => row.year >= from && row.year <= to);
    const stackedBarData = stackedSeries.filter((row) => row.year >= from && row.year <= to);

    const selectedSideMetricData = await readSideMetric(geoid);
    const statistics = isNationalGeoid(geoid)
      ? []
      : createSideMetricData(selectedSideMetricData, socialDeterminantMetricConfigs);

    const zip = new JSZip();
    zip.file("line_chart_data.csv", csvFormat(lineChartData));
    zip.file("map_data.csv", csvFormat(mapData));
    zip.file("stacked_bar_chart_data.csv", csvFormat(stackedBarData));
    zip.file("statistics.csv", csvFormat(statistics));

    const zipContent = await zip.generateAsync({ type: "nodebuffer" });

    return new Response(zipContent, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="data.zip"`,
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
