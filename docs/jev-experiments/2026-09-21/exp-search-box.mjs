// Throwaway: can a judgment stand in for the search box's fragile text handling?
//   kind  - what the visitor typed (today: one regex, looksLikeAddress)
//   pick  - which Gazetteer row they meant, chosen among candidates that CODE finds ("select, don't generate")
// Baselines are code only: the regex for kind, and "first candidate" for pick.
// Run: node --env-file=.env docs/jev-experiments/2026-09-21/exp-search-box.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { ask } from "./jev.mjs";
import { CASES } from "./cases.mjs";

const { rows } = JSON.parse(readFileSync("static/gazetteer/names.json", "utf8"));
const norm = (text) =>
  text
    .toLowerCase()
    .replace(/[.,'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
// name part and state part of "Harris County, TX"
const table = rows.map(([label], index) => {
  const cut = label.lastIndexOf(", ");
  return {
    label,
    index,
    name: norm(label.slice(0, cut)),
    state: label.slice(cut + 2).toLowerCase(),
  };
});
const byName = new Map();
for (const row of table) (byName.get(row.name) ?? byName.set(row.name, []).get(row.name)).push(row);

// Optimal string alignment distance, capped.
function distance(a, b, cap) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev2 = [],
    prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d = Math.min(d, prev2[j - 2] + 1);
      cur[j] = d;
      if (d < best) best = d;
    }
    if (best > cap) return cap + 1;
    [prev2, prev] = [prev, cur];
  }
  return prev[b.length];
}

const STATE_WORDS = JSON.parse(readFileSync(new URL("./states.json", import.meta.url), "utf8")); // {"texas":"tx",...}
export function candidates(text, limit = 10) {
  const words = norm(text).split(" ").filter(Boolean);
  // a state named anywhere in the text ranks its rows first
  const states = new Set();
  for (let n = 3; n >= 1; n--)
    for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n).join(" ");
      if (STATE_WORDS[gram]) states.add(STATE_WORDS[gram]);
      else if (
        n === 1 &&
        gram.length === 2 &&
        Object.values(STATE_WORDS).includes(gram) &&
        i === words.length - 1
      )
        states.add(gram);
    }
  const scored = new Map();
  const offer = (row, score) => {
    if ((scored.get(row.index)?.score ?? 99) > score) scored.set(row.index, { row, score });
  };
  for (let n = Math.min(4, words.length); n >= 1; n--)
    for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n).join(" ");
      if (gram.length < 4) continue;
      for (const row of byName.get(gram) ?? []) offer(row, 0 - n / 10); // exact name, longer is better
      const cap = gram.length >= 9 ? 2 : 1;
      for (const row of table) {
        if (row.name[0] !== gram[0]) continue; // typos rarely hit the first letter; keeps this at a few ms
        const d = distance(gram, row.name, cap);
        if (d && d <= cap) offer(row, d - n / 10);
      }
    }
  if (words.length === 1 && words[0].length >= 4)
    // "philly" -> names that share its first four letters
    for (const row of table) if (row.name.startsWith(words[0].slice(0, 4))) offer(row, 3);
  return [...scored.values()]
    .sort(
      (a, b) =>
        states.has(b.row.state) - states.has(a.row.state) ||
        a.score - b.score ||
        a.row.index - b.row.index
    )
    .slice(0, limit)
    .map(({ row }) => row.label);
}

const looksLikeAddress = (text) => /^\s*\d+[a-z]?\s+\S*[a-z]/i.test(text);
const KIND = {
  type: "choice",
  instructions:
    "A visitor typed `typed` into the search box of a United States map. The box finds states, counties, cities and ZIP codes by name, and sends street addresses to a geocoder. What is `typed`?",
  criteria: {
    street_address:
      'A postal street address: a building number and a street name, in any style ("One Microsoft Way", "123-45 Queens Blvd", "N6W23001 Bluemound Rd", "Apt 4, 123 Main St"). A city, state or ZIP code may follow.',
    zip_code:
      'A five-digit ZIP code, alone or with a city name or the word ZIP beside it ("06511 New Haven", "zip 77002"), and NO street name.',
    place_name:
      'The name of a US state, county, city or town, even misspelled, abbreviated, a nickname, written with digits ("29 Palms"), or wrapped in other words ("closures near Durham NC").',
    landmark:
      'A named building, institution, business or street corner without a building number ("Yale University", "corner of Elm and Chapel").',
    not_a_place: "No location at all: a topic, a question, a denomination, or random letters.",
  },
};

const out = [];
const queue = [...CASES];
async function worker() {
  for (let item; (item = queue.shift()); ) {
    const found = candidates(item.text);
    const questions = { kind: KIND };
    if (found.length)
      questions.pick = {
        type: "choice",
        instructions:
          "A visitor typed `typed` into a United States place search. `candidates` are real places whose names resemble it. Which one did the visitor most likely mean? Respect a state named in `typed`. A famous large city is more likely than a small town with a similar name.",
        criteria: {
          ...Object.fromEntries(found.map((label) => [label, null])),
          none: "None of the candidates is what the visitor meant.",
        },
      };
    const reply = await ask({ typed: item.text, candidates: found }, questions);
    out.push({
      ...item,
      candidates: found,
      regexKind: looksLikeAddress(item.text)
        ? "street_address"
        : /^\d{3,5}$/.test(item.text.trim())
          ? "zip_code"
          : "place_name",
      jevKind: reply.answers.kind.choice,
      kindConfidence: reply.answers.kind.confidence,
      codePick: found[0] ?? null,
      jevPick: reply.answers.pick?.choice ?? null,
      pickConfidence: reply.answers.pick?.confidence ?? null,
      ms: Math.round(reply.ms),
      tokens: reply.usage.input_tokens,
    });
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
out.sort(
  (a, b) => CASES.findIndex((c) => c.text === a.text) - CASES.findIndex((c) => c.text === b.text)
);
writeFileSync(new URL("./search-box-results.json", import.meta.url), JSON.stringify(out, null, 1));

const kindRight = (key) => out.filter((r) => r[key] === r.kind).length;
console.log(
  `kind   regex ${kindRight("regexKind")}/${out.length}   jev ${kindRight("jevKind")}/${out.length}`
);
for (const r of out.filter((r) => r.jevKind !== r.kind || r.regexKind !== r.kind))
  console.log(
    "  ",
    JSON.stringify(r.text).padEnd(44),
    "truth",
    r.kind.padEnd(15),
    "regex",
    r.regexKind.padEnd(15),
    "jev",
    r.jevKind,
    r.kindConfidence
  );
const named = out.filter((r) => r.kind === "place_name");
const pickRight = (key) => named.filter((r) => r[key] === r.want).length;
console.log(
  `\npick (place names, ${named.length})   candidate list holds it ${named.filter((r) => r.candidates.includes(r.want)).length}   first candidate ${pickRight("codePick")}   jev ${pickRight("jevPick")}`
);
for (const r of named)
  console.log(
    "  ",
    JSON.stringify(r.text).padEnd(44),
    "want",
    String(r.want).padEnd(24),
    "code",
    String(r.codePick).padEnd(26),
    "jev",
    r.jevPick,
    r.pickConfidence
  );
const falsePicks = out.filter((r) => r.kind !== "place_name" && r.kind !== "zip_code");
console.log(
  `\nno place meant (${falsePicks.length}): code offers a first candidate for ${falsePicks.filter((r) => r.codePick).length}, jev picks one for ${falsePicks.filter((r) => r.jevPick && r.jevPick !== "none").length}`
);
const times = out.map((r) => r.ms).sort((a, b) => a - b);
console.log(
  `\nlatency ms  median ${times[times.length >> 1]}  p90 ${times[Math.floor(times.length * 0.9)]}  max ${times.at(-1)}   mean input tokens ${Math.round(out.reduce((s, r) => s + r.tokens, 0) / out.length)}`
);
