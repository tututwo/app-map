import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import data from "$data/line/brushableLineChartData.csv";

type IDatum = {
  year: number;
  close: number;
};

export const GET: RequestHandler = async ({ url }) => {
  try {
    const geoidParam = url.searchParams.get("geoid");

    let result: IDatum[];

    if (geoidParam) {
      // Filter by specific geoid and return data for that geoid sorted by year
      const filteredData = data
        .filter((row: any) => row.geoid === geoidParam)
        .map((row: any) => ({
          year: +row.year,
          close: +row.close,
        }))
        .sort((a, b) => a.year - b.year);

      if (filteredData.length === 0) {
        throw error(404, `No data found for geoid ${geoidParam}`);
      }

      result = filteredData;
    } else {
      // Group by year and sum close values across all geoids
      const yearMap = new Map<number, number>();

      data.forEach((row: any) => {
        const year = +row.year;
        const close = +row.close;

        if (yearMap.has(year)) {
          yearMap.set(year, yearMap.get(year)! + close);
        } else {
          yearMap.set(year, close);
        }
      });

      // Convert map to array and sort by year
      result = Array.from(yearMap.entries())
        .map(([year, close]) => ({ year, close }))
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
