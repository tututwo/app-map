// Throwaway: what a zero-hit fallback would add on top of the fixed search. Code first; Jev is asked only
// where the search found nothing (after.json), and its answers come from search-box-results.json.
import { readFileSync } from "node:fs";
const read = (name) => JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), "utf8"));
const jev = new Map(read("search-box-results.json").map((row) => [row.text, row]));
let calls = 0,
  right = 0,
  wrongPlace = 0;
const rows = read("after.json");
for (const row of rows) {
  const j = jev.get(row.text);
  let outcome = row.right ? "search" : "miss";
  if (row.enter !== "geocoder" && !row.offered.length && j) {
    calls++;
    if (j.jevKind === "street_address")
      outcome = row.kind === "street_address" ? "jev: geocoder" : "jev: WRONG geocoder";
    else if (j.jevKind === "place_name" && j.jevPick && j.jevPick !== "none") {
      outcome = j.jevPick === row.want ? "jev: did you mean" : "jev: WRONG place";
      if (j.jevPick !== row.want) wrongPlace++;
    } else outcome = row.want || row.kind === "street_address" ? "miss (told why)" : "told why";
  }
  if (!outcome.startsWith("miss") && !outcome.includes("WRONG")) right++;
  if (outcome !== "search")
    console.log(
      outcome.padEnd(20),
      row.kind.padEnd(15),
      JSON.stringify(row.text).padEnd(44),
      j ? `${j.jevKind} ${j.kindConfidence} -> ${j.jevPick ?? "-"} ${j.pickConfidence ?? ""}` : ""
    );
}
console.log(
  `\nright ${right}/${rows.length}   Jev calls ${calls} of ${rows.length} searches   wrong place suggested ${wrongPlace}`
);
