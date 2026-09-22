import { ask } from "./jev.mjs";
for (let i = 0; i < 4; i++) {
  const r = await ask(
    { typed: "29 palms ca" },
    {
      kind: {
        type: "choice",
        instructions: "A visitor typed `typed` into a US place search box. What did they type?",
        criteria: {
          street_address: "A house number and a street.",
          place_name: "The name of a city, county or state.",
          zip_code: "A ZIP code.",
        },
      },
    }
  );
  console.log(
    r.model,
    Math.round(r.ms) + " ms",
    JSON.stringify(r.answers.kind),
    JSON.stringify(r.usage)
  );
}
