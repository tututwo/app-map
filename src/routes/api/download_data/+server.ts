import { error, type RequestHandler } from "@sveltejs/kit";
import { socialDeterminantMetricConfigs } from "$lib/config/sideMetrics";
import { isConnecticutPlanningRegionGeoid, normalizeCountyGeoid } from "$lib/domain/countyGeoid";
import { readSideMetric } from "$lib/server/data/side-metric-data";
import { createSideMetricData } from "$lib/utils/sideMetricTransformation";
import { csvFormat } from "d3";
import JSZip from "jszip";

export const GET: RequestHandler = async ({ url, fetch }) => {
  try {
    // Parse query parameters
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const requestedGeoid = url.searchParams.get("geoid") ?? "00000";
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

    // Build query parameters for API calls
    const baseParams = new URLSearchParams({
      from: fromParam,
      to: toParam,
      geoid,
    });

    // Make parallel requests to all three APIs
    const [lineChartResponse, mapDataResponse, stackedBarResponse] = await Promise.all([
      fetch(`/api/line_chart_data?${baseParams.toString()}`),
      fetch(`/api/map_data?${baseParams.toString()}`),
      fetch(`/api/stacked_bar_chart_data?${baseParams.toString()}`),
    ]);

    // Check if all requests were successful
    if (!lineChartResponse.ok) {
      console.error("Line chart API error:", await lineChartResponse.text());
      throw error(lineChartResponse.status, "Failed to fetch line chart data");
    }

    const hasKnownMapDataGap =
      isConnecticutPlanningRegionGeoid(geoid) && mapDataResponse.status === 404;

    if (!mapDataResponse.ok && !hasKnownMapDataGap) {
      console.error("Map data API error:", await mapDataResponse.text());
      throw error(mapDataResponse.status, "Failed to fetch map data");
    }

    if (!stackedBarResponse.ok) {
      console.error("Stacked bar API error:", await stackedBarResponse.text());
      throw error(stackedBarResponse.status, "Failed to fetch stacked bar data");
    }

    // Parse JSON responses
    const [lineChartData, stackedBarData, mapData] = await Promise.all([
      (await lineChartResponse.json()).filter((row: any) => row.year >= from && row.year <= to),
      (await stackedBarResponse.json()).filter((row: any) => row.year >= from && row.year <= to),
      hasKnownMapDataGap ? [] : await mapDataResponse.json(),
    ]);

    const selectedSideMetricData = await readSideMetric(geoid);
    const statistics =
      geoid === "00000"
        ? []
        : createSideMetricData(selectedSideMetricData, socialDeterminantMetricConfigs);

    const zip = new JSZip();

    if (Array.isArray(lineChartData)) {
      const lineChartCsv = csvFormat(lineChartData);
      zip.file("line_chart_data.csv", lineChartCsv);
    }

    if (Array.isArray(mapData)) {
      const mapDataCsv = csvFormat(mapData);
      zip.file("map_data.csv", mapDataCsv);
    }

    if (Array.isArray(stackedBarData)) {
      const stackedBarCsv = csvFormat(stackedBarData);
      zip.file("stacked_bar_chart_data.csv", stackedBarCsv);
    }

    const statisticsCsv = csvFormat(statistics);
    zip.file("statistics.csv", statisticsCsv);

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
