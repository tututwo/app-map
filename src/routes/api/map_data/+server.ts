import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import countiesData from "$data/counties_all.csv";

export interface CountyData {
  geoid: string;
  name: string;
  closure: number;
  closure_rate_per_10000: number;
  persistence: number;
  reopening: number;
}

function findMatchingYearRangeColumn(
  prefix: string,
  from: number,
  to: number,
  headers: string[]
): string | null {
  const targetRange = `${from}-${to}`;
  const targetColumn = `${prefix}_${targetRange}`;

  // Look for exact match first
  if (headers.includes(targetColumn)) {
    return targetColumn;
  }

  return null;
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

    // Get headers from the first row of imported data
    const headers = Object.keys(countiesData[0] || {});

    // Find matching columns for the requested year range
    const closureCountColumn = findMatchingYearRangeColumn("closure_count", from, to, headers);
    const closureRateColumn = findMatchingYearRangeColumn(
      "closure_rate_per_10000",
      from,
      to,
      headers
    );
    const persistenceColumn = findMatchingYearRangeColumn("persistence", from, to, headers);
    const reopeningCountColumn = findMatchingYearRangeColumn("reopening_count", from, to, headers);

    // Check if all required columns exist
    if (!closureCountColumn || !closureRateColumn || !persistenceColumn || !reopeningCountColumn) {
      throw error(404, `Data not available for year range ${from}-${to}`);
    }

    // Process data
    let result: CountyData[] = countiesData.map((row: any) => ({
      geoid: row.geoid,
      name: row.name,
      closure: +row[closureCountColumn],
      closure_rate_per_10000: +row[closureRateColumn],
      persistence: +row[persistenceColumn],
      reopening: +row[reopeningCountColumn],
    }));

    // Filter by geoid if provided
    if (geoidParam) {
      result = result.filter((county) => county.geoid === geoidParam);
      if (result.length === 0) {
        throw error(404, `County with geoid ${geoidParam} not found`);
      }
    }

    return json(result);
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
