import { expect, it } from "vitest";
import { parseStateMetrics } from "../../scripts/prebuild-state.mjs";
import release from "../../data-raw/state-release.json";

it("preserves state identities, zero and missing metrics, and rejects invalid releases", () => {
  const header = "geoid,boundaryYear,window,religion,closed,per10k,nOpen\n";
  const valid = "01,2020,2010_2015,all_religions,0,0,5\n02,2020,2010_2015,all_religions,,,\n";
  const parse = (body: string) =>
    parseStateMetrics(header + body, { boundaryYear: 2020 }, new Set(["01", "02"]));
  expect(parse(valid)).toEqual([
    { geoid: "01", window: "2010_2015", religion: "all_religions", closed: 0, per10k: 0, nOpen: 5 },
    {
      geoid: "02",
      window: "2010_2015",
      religion: "all_religions",
      closed: null,
      per10k: null,
      nOpen: null,
    },
  ]);
  expect(() => parse(valid + valid)).toThrow(/Duplicate/);
  expect(() => parse(valid.replace("01,", "03,"))).toThrow(/no geometry/);
  expect(() => parse(valid.replace("01,", "1,"))).toThrow(/GEOID/);
  expect(() => parse(valid.replace(",0,0,5", ",NaN,0,5"))).toThrow(/Invalid/);
  expect(() => parse(valid.replace("2020", "2010"))).toThrow(/boundary year/);
  expect(
    parseStateMetrics(
      header + valid,
      { boundaryYear: 2020, withheldMetrics: ["per10k", "nOpen"] },
      new Set(["01", "02"])
    )[0]
  ).toMatchObject({ closed: 0, per10k: null, nOpen: null });
  // This inspected release must never expose the known-invalid rate or suspect active count.
  expect(release.withheldMetrics).toEqual(["per10k", "nOpen"]);
  expect(
    parseStateMetrics(header + valid.replaceAll("2020", "2010"), release, new Set(["01", "02"]))[0]
  ).toMatchObject({ closed: 0, per10k: null, nOpen: null });
});
