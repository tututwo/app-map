// Throwaway: asks Jev (TypeSafe System One) the same UX questions about the same tasks on two versions.
// Transcripts hold literal UI text recorded by one driver; the model is never told which version it reads.
// Run: node --env-file=<project>/.env jev-ux.mjs
import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.TYPESAFE_API_KEY;
if (!KEY) throw new Error("TYPESAFE_API_KEY is not set");
const here = (name) => new URL(`./${name}`, import.meta.url);

const VISITORS = {
  T1: [
    "a member of the public",
    "Find how many places of worship closed in my ZIP code, 06511, between 2010 and 2019.",
  ],
  T2: [
    "a member of the public using only the keyboard",
    "See the closures for the census tract around downtown New Haven, Connecticut, for 2010 to 2019, without touching the map.",
  ],
  T3: [
    "a researcher",
    "I opened a colleague's link to Los Angeles County, California, 2010 to 2019. Now I want the ZIP-code-level figure for that same area.",
  ],
  T4: [
    "a member of the public",
    "Find the closures for the block group that contains the street address 60 College St, New Haven, for 2010 to 2019.",
  ],
  T5: ["a researcher", "Look at Texas at the census-tract level for 2010 to 2019."],
  T6: [
    "a member of the public who mistypes",
    "Find New Haven. I typed it wrong and need the page to help me recover.",
  ],
  T8: [
    "a researcher",
    "I followed a link to ZIP code 99999, which is not in the data. I want to understand what the page is telling me about it.",
  ],
};

const questions = {
  goal_reached: {
    type: "noul",
    instructions:
      "Look at the last entry of `session`. Does its `screen_after.results_panel` report a number of closures for a place that answers `visitor.goal`: the place the visitor asked about, at the geographic level the visitor asked about?",
    criteria: {
      true: "The final results panel names a place that matches the goal, at the level the goal asks for, and shows a closure number for it.",
      false:
        "The final results panel still shows the United States, a different place, a place of a different geographic level than the goal asks for, or no closure number.",
    },
  },
  effort: {
    type: "score",
    instructions:
      "How much effort did `session` cost the visitor on the way to what `visitor.goal` asks for?",
    criteria: [
      "The session ends without the answer; the visitor would have to find another way, such as panning and zooming the map by hand.",
      "The answer appears, but only after an action that had no visible effect or that had to be repeated.",
      "The answer appears after a short chain of actions, each of which visibly moved the visitor forward.",
      "The answer appears right after the visitor names the place and chooses the level; no action was wasted.",
    ],
  },
  feedback: {
    type: "score",
    instructions:
      "Compare each `visitor_action` in `session` with the `screen_after` it produced. How well does the screen tell the visitor what happened and what is now shown?",
    criteria: [
      "At least one action that should have done something left every field of `screen_after` unchanged, and no message explains why.",
      "Actions change the screen, but at some step the visitor is left guessing what is shown: the pressed level and the place named in the results panel do not belong together, or the panel ignores what was just asked.",
      "Every action is answered, and the results panel names the place, its level and the years, but nothing explains why this particular place is shown when it differs from what the visitor typed.",
      "Every action is answered; the results panel names the place, its level and the years, and where the place differs from what the visitor typed it says why this place is shown.",
    ],
  },
  level_matches_panel: {
    type: "noul",
    instructions:
      "Check every step of `session` whose `screen_after.results_panel` names a place other than the United States. Is that place always of the geographic level shown in `screen_after.view_by_pressed`? A state with 'State' pressed matches. A state with 'Tract' pressed does not. A ZIP code with 'ZIP' pressed matches.",
    criteria: {
      true: "In every such step the named place belongs to the pressed level, or no step names a place other than the United States.",
      false:
        "In at least one step the results panel names a place of a different level than the one pressed.",
    },
  },
  dead_end: {
    type: "choice",
    instructions:
      "When something the visitor typed or asked for found nothing, what did the screen do? Judge from `search_message`, `map_message`, `error_banner` and `results_panel` in `session`.",
    criteria: {
      nothing_failed: "Everything the visitor typed or asked for found something.",
      silent: "The input found nothing, the screen did not change, and no message said so.",
      explained:
        "A message said that nothing matched or that something is unavailable, without suggesting what to do.",
      explained_with_next_step:
        "A message said that nothing matched or is unavailable and suggested what to try next.",
    },
  },
  missing_number: {
    type: "choice",
    instructions:
      "Look at the last `screen_after.results_panel`. If it shows a dash instead of a closure number for a named place, what reason does it give?",
    criteria: {
      shows_a_number: "The panel shows a closure number, so there is nothing to explain.",
      no_place_chosen: "No place is chosen yet; the panel asks the visitor to choose one.",
      says_none_were_active:
        "The panel says no places of worship of that kind were active there in those years.",
      says_not_in_the_data: "The panel says the place is not in the source data.",
      says_loading_failed: "The panel says the numbers could not be loaded.",
      no_reason: "A dash is shown for a named place and no reason is given.",
    },
  },
  plain_language: {
    type: "score",
    instructions:
      "Read the last `screen_after.results_panel` as a member of the public who has never worked with census data. How understandable is its wording?",
    criteria: [
      "It leans on unexplained technical terms or codes; a newcomer could not tell what the numbers refer to.",
      "Mostly plain, but one or two terms that matter for reading the result are left unexplained.",
      "Plain throughout; the terms that matter are explained in the same view.",
    ],
  },
};

async function ask(state) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "jev-latest", state, questions }),
    });
    if ((response.status === 429 || response.status === 529) && attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * 2 ** attempt));
      continue;
    }
    if (!response.ok)
      throw new Error(`TypeSafe ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return response.json();
  }
}

const results = {};
for (const version of ["before", "after"]) {
  const transcripts = JSON.parse(readFileSync(here(`transcripts-${version}.json`), "utf8"));
  for (const [task, steps] of Object.entries(transcripts)) {
    const [who, goal] = VISITORS[task];
    const state = {
      product:
        "A public research website with a map of the United States. Visitors look up how many places of worship closed in a place during a span of years. A control labelled 'View by' chooses one of five geographic levels: State, County, ZIP, Tract, Block group. A search box finds places. A results panel on the right reports the numbers.",
      visitor: { who, goal },
      session: steps.map(({ action, then }, index) => ({
        step: index + 1,
        visitor_action: action,
        screen_after: {
          search_box: then.search_box,
          search_options: then.search_options,
          search_message: then.search_message,
          view_by_pressed: then.view_by_pressed,
          map_message: then.map_message,
          error_banner: then.error_banner,
          results_panel: then.panel,
        },
      })),
    };
    const reply = await ask(state);
    results[`${version}:${task}`] = {
      model: reply.model,
      usage: reply.usage,
      answers: reply.answers,
    };
    process.stdout.write(".");
  }
}
writeFileSync(here("jev-results.json"), JSON.stringify(results, null, 1));

const round = (value) => (value === undefined ? "" : Number(value).toFixed(2));
const tasks = Object.keys(VISITORS);
console.log(`\nmodel ${Object.values(results)[0].model}\n`);
console.log(
  "task  version  goal_reached  effort/3  feedback/3  level=panel  plain/2  dead_end                     missing_number"
);
for (const task of tasks)
  for (const version of ["before", "after"]) {
    const a = results[`${version}:${task}`].answers;
    console.log(
      [
        task.padEnd(5),
        version.padEnd(8),
        round(a.goal_reached.noul).padEnd(13),
        `${round(a.effort.score)} (${round(a.effort.confidence)})`.padEnd(12 - 2),
        `${round(a.feedback.score)} (${round(a.feedback.confidence)})`.padEnd(12),
        round(a.level_matches_panel.noul).padEnd(12),
        round(a.plain_language.score).padEnd(8),
        `${a.dead_end.choice} (${round(a.dead_end.confidence)})`.padEnd(29),
        `${a.missing_number.choice} (${round(a.missing_number.confidence)})`,
      ].join(" ")
    );
  }
const mean = (version, pick, among = tasks) =>
  among.reduce((sum, task) => sum + pick(results[`${version}:${task}`].answers), 0) / among.length;
const finding = ["T1", "T2", "T3", "T4", "T5"]; // tasks with an answer to reach
console.log("\nmeans over the five find-a-place tasks (T1-T5), and plain language over all seven:");
for (const version of ["before", "after"])
  console.log(
    version.padEnd(7),
    "goal_reached",
    round(mean(version, (a) => a.goal_reached.noul, finding)),
    "| effort",
    round(mean(version, (a) => a.effort.score / 3, finding)),
    "| feedback",
    round(mean(version, (a) => a.feedback.score / 3)),
    "| level=panel",
    round(mean(version, (a) => a.level_matches_panel.noul)),
    "| plain",
    round(mean(version, (a) => a.plain_language.score / 2))
  );
const usage = Object.values(results).reduce(
  (sum, r) => sum + r.usage.input_tokens + r.usage.output_tokens,
  0
);
console.log(`\n${Object.keys(results).length} requests, ${usage} tokens`);

// An exact rule belongs in code, not in a model: does the place named in the panel belong to the pressed Level?
const levelOf = (title) =>
  /^Block group /.test(title)
    ? "Block group"
    : /^Tract /.test(title)
      ? "Tract"
      : /^ZIP /.test(title)
        ? "ZIP"
        : / County, [A-Z]{2}$| Parish, LA$/.test(title)
          ? "County"
          : /^(United States|No .* here)$/.test(title)
            ? null
            : "State";
console.log(
  "\nexact check: steps where the panel names a place of another Level than the one pressed"
);
for (const version of ["before", "after"]) {
  const transcripts = JSON.parse(readFileSync(here(`transcripts-${version}.json`), "utf8"));
  const bad = [];
  for (const [task, steps] of Object.entries(transcripts))
    for (const { action, then } of steps) {
      const title = then.panel?.split(" / ")[1] ?? "";
      const level = levelOf(title);
      if (level && level !== then.view_by_pressed)
        bad.push(
          `${task} "${action}": panel "${title}" while "${then.view_by_pressed}" is pressed`
        );
    }
  console.log(version.padEnd(7), bad.length ? bad.join("\n        ") : "none");
}
