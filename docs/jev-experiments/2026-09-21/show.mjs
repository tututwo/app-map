// Throwaway: prints a results file of search-box.test.ts.   node show.mjs baseline.json
import { readFileSync } from "node:fs";
const rows = JSON.parse(readFileSync(new URL(`./${process.argv[2]}`, import.meta.url), "utf8"));
const tally = {};
for (const r of rows) {
  console.log(
    r.right ? "ok  " : "MISS",
    r.kind.padEnd(15),
    JSON.stringify(r.text).padEnd(44),
    "->",
    r.enter === "geocoder"
      ? `[geocoder]${r.offered.length ? " + " + r.offered.join(" | ") : ""}`
      : r.offered.join(" | ") || "(no hits)"
  );
  (tally[r.kind] ??= [0, 0])[0] += +r.right;
  tally[r.kind][1]++;
}
console.log(
  Object.entries(tally)
    .map(([k, [a, b]]) => `${k} ${a}/${b}`)
    .join("   "),
  "  TOTAL",
  rows.filter((r) => r.right).length + "/" + rows.length,
  "  slowest search",
  Math.max(...rows.map((r) => r.ms)),
  "ms"
);
