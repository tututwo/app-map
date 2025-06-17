import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import data from "$data/stackedBar/stackedBarChart.csv";

type IStackedDatum = {
  year: number;
  negative: number;
  neutral: number;
  positive: number;
};

export const GET: RequestHandler = async ({ url }) => {
  try {
    const geoidParam = url.searchParams.get("geoid");

    let result: IStackedDatum[];

    if (geoidParam && geoidParam !== "00000") {
      // Filter by specific geoid and return data for that geoid sorted by year
      const filteredData = data
        .filter((row: any) => row.geoid === geoidParam)
        .map((row: any) => ({
          year: +row.year,
          negative: +row.negative,
          neutral: +row.neutral,
          positive: +row.positive,
        }))
        .sort((a, b) => a.year - b.year);

      if (filteredData.length === 0) {
        throw error(404, `No data found for geoid ${geoidParam}`);
      }

      result = filteredData;
    } else {
      // Group by year and sum negative, neutral, positive values across all geoids
      const yearMap = new Map<number, { negative: number; neutral: number; positive: number }>();

      data.forEach((row: any) => {
        const year = +row.year;
        const negative = +row.negative;
        const neutral = +row.neutral;
        const positive = +row.positive;

        if (yearMap.has(year)) {
          const existing = yearMap.get(year)!;
          yearMap.set(year, {
            negative: existing.negative + negative,
            neutral: existing.neutral + neutral,
            positive: existing.positive + positive,
          });
        } else {
          yearMap.set(year, { negative, neutral, positive });
        }
      });

      // Convert map to array and sort by year
      result = Array.from(yearMap.entries())
        .map(([year, values]) => ({
          year,
          negative: values.negative,
          neutral: values.neutral,
          positive: values.positive,
        }))
        .sort((a, b) => a.year - b.year);
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
