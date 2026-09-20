# Explore UX evaluation, 2026-09-20

Evidence for the Focus model (ADR-0003): the same seven tasks on the version that was live that day
("before") and on the branch that introduced the Focus ("after").

**How it was recorded.** `driver.js` was pasted into each page. It drives Explore through DOM events
only (type, arrow keys, Enter, the View by buttons, the To year) and, after every action, records literal
UI text: the search box, its options and message, the pressed Level, the map's message, any error banner
and the first 520 characters of the results panel. Nothing in a transcript is paraphrased.

**How it was judged.** `jev-ux.mjs` sends each transcript to Jev (TypeSafe System One, `jev-1.13.0`) with
the visitor's goal and asks seven typed questions. The model is never told which version it reads.
Rerun with `node --env-file=.env docs/ux-eval/2026-09-20/jev-ux.mjs`. Whether the place named in the
panel belongs to the pressed Level is an exact rule, so the script checks it in code, not with the model
(the model misreads names like "Tract 2214, Harris County, TX").

| Tasks T1–T5, mean          | before | after |
| -------------------------- | -----: | ----: |
| Goal reached (probability) |   0.05 |  0.59 |
| Effort (0–1)               |   0.05 |  0.44 |
| Feedback (0–1, all seven)  |   0.29 |  0.74 |
| Plain language (0–1)       |   0.36 |  0.64 |

- A mistyped place: before `silent` (0.99), after `explained_with_next_step` (0.99).
- ZIP 99999, which is not in the data: before "none were active there" (0.99, and wrong), after "not in
  the source data" (0.99).
- Exact check: before, "Texas" stays in the panel while Tract is pressed; after, no mismatch in any step.

**Read with care.** These are one model's judgments of text, a signal to inspect and not a measurement
of users. T3 ("the ZIP-level figure for Los Angeles County") and T5 ("Texas by tract") stay low after the
change for a real reason: they ask for every ZIP or tract of an area, which only the map shows. The panel
reports one Unit. A ranked list of the Units inside an area would answer them and is not built.
T1's effort is held down by a last step the script adds for comparability (pressing ZIP when ZIP is
already pressed), which changes nothing on the new version.
