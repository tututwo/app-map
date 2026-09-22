// Throwaway: the first-keystroke cost of the search box, before and after 2026-09-21. Both bodies are copied
// from src/lib/explore/gazetteer.ts (git history has the old one).
import { readFileSync } from "node:fs";
const model = readFileSync("src/lib/explore/model.ts", "utf8");
const STATES = [...model.matchAll(/\["(\d\d)", "([A-Z]{2})", "([^"]+)"\]/g)].map(
  ([, id, abbreviation, name]) => ({ id, abbreviation, name })
);
const before = (text) => {
  const words = text.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  const state = STATES.find(({ name }) => words.endsWith(` ${name.toLowerCase()}`));
  return state ? `${words.slice(0, -state.name.length)}${state.abbreviation.toLowerCase()}` : words;
};
const SPELLED = { saint: "st", ft: "fort", mt: "mount" };
const after = (text) =>
  text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[.,/-]/g, " ")
    .replace(/\b(saint|ft|mt)\b/g, (word) => SPELLED[word])
    .replace(/\s+/g, " ")
    .trim();
const { rows } = JSON.parse(readFileSync("static/gazetteer/names.json", "utf8"));
for (const [label, fn] of [
  ["before: keys = rows.map(plain)", before],
  ["after:  keys = rows.map(fold)", after],
]) {
  const runs = [];
  for (let i = 0; i < 9; i++) {
    const s = performance.now();
    rows.map((row) => fn(row[0]));
    runs.push(performance.now() - s);
  }
  console.log(
    label.padEnd(34),
    runs.sort((a, b) => a - b)[4].toFixed(1),
    "ms median of 9,",
    rows.length,
    "rows"
  );
}
