import { expect, test } from "@playwright/test";
import JSZip from "jszip";

test("download contract preserves ZIP entry names and extracted CSV text", async ({ request }) => {
  const response = await request.get("/api/download_data?from=2003&to=2011&geoid=01001");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/zip");

  const zip = await JSZip.loadAsync(await response.body());
  const entryNames = Object.keys(zip.files).sort();
  expect(entryNames).toEqual([
    "line_chart_data.csv",
    "map_data.csv",
    "stacked_bar_chart_data.csv",
    "statistics.csv",
  ]);

  const extracted = Object.fromEntries(
    await Promise.all(
      entryNames.map(async (name) => [name, await zip.file(name)!.async("string")] as const)
    )
  );

  expect(extracted).toEqual({
    "line_chart_data.csv": `year,close
2003,29
2004,37
2005,1
2006,63
2007,59
2008,20
2009,32
2010,75
2011,57`,
    "map_data.csv": `geoid,name,closure,closure_rate_per_10000,persistence,reopening
01001,"Autauga County, AL",3,0,4,0`,
    "stacked_bar_chart_data.csv": `year,negative,neutral,positive
2003,-12,48,8
2004,-20,19,20
2005,-3,99,5
2006,-5,60,10
2007,-19,41,1
2008,-7,61,4
2009,-9,81,11
2010,-7,56,1
2011,-18,22,14`,
    "statistics.csv": `id,title,currentValueDisplay,currentValue,minValue,maxValue,minLabel,maxLabel,averageValue,averageLabel
median-rent,Median gross rent (USD),$769,769,200,10000,$200,$10k,621,County average
renters-percent,Percentage of occupied housing units that are renter-occupied,25%,25,0,100,0%,100%,28,County average
poverty-level,Percentage of population below the poverty level,11%,11,0,100,0%,100%,16,County average
mobility-level,Percentage of residents living in the same house as one year ago,86%,86,0,100,0%,100%,86,County average
community-health-centers,Number of community health centers,1,1,0,100,0,100,5,County average`,
  });
});
