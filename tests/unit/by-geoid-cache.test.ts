import { expect, test, vi } from "vitest";
import { readCompressedJson } from "$lib/server/data/compressed-asset";
import { readLineSeries } from "$lib/server/data/by-geoid";

vi.mock("$lib/server/data/compressed-asset", () => ({ readCompressedJson: vi.fn() }));

test("a failed cold read cannot poison another request or the settled data cache", async () => {
  const series = [{ year: 2000, close: 7 }];
  const failure = new Error("Asset request was canceled");
  vi.mocked(readCompressedJson)
    .mockRejectedValueOnce(failure)
    .mockResolvedValueOnce({ "01001": series });

  const results = await Promise.allSettled([readLineSeries("01001"), readLineSeries("01001")]);
  expect(results).toEqual([
    { status: "rejected", reason: failure },
    { status: "fulfilled", value: series },
  ]);
  expect(await readLineSeries("01001")).toBe(series);
  expect(await readLineSeries("99999")).toBeUndefined();
  expect(await readLineSeries.keys()).toEqual(["01001"]);
  expect(readCompressedJson).toHaveBeenCalledTimes(2);
});
