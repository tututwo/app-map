import { CONTEXT_FIELDS, rated, writeQuery, type ExploreQuery, type Stat } from "./model";
import type { Context, ContextField } from "./sdoh";

/**
 * The Summary is the printed page of one Selection. It travels without the site around it, so it says
 * less than the panel: a rate that rests on a handful of closures is left out rather than explained.
 */

/** Fewer closures than this make an unstable rate; CDC WONDER marks such rates unreliable. */
export const RELIABLE_FROM = 20;
export const reliableRate = ({ closed, per10k }: Stat) =>
  closed !== null && closed >= RELIABLE_FROM ? per10k : null;

/**
 * All states and D.C. together. Closures and residents are added over the same states and divided once,
 * so the result is the nation's own rate and not an average of the states' rates.
 */
export function nationalStat(
  geoids: string[],
  closed: (number | null)[],
  residents: Record<string, number | null | undefined>
): Stat {
  let [sum, people, seen] = [0, 0, false];
  geoids.forEach((geoid, row) => {
    const here = residents[geoid];
    if (!here) return;
    people += here;
    const count = closed[row];
    if (count === null || count === undefined) return;
    sum += count;
    seen = true;
  });
  return rated(seen ? sum : null, people || null);
}

/**
 * The first measures the place has, in panel order, beside its state's: residents, income, poverty,
 * unemployment and education where the lab publishes them, and what a ZIP has where it does not.
 */
export function contextRows(place: Context | null, state: Context | null, limit = 5) {
  return (Object.keys(CONTEXT_FIELDS) as ContextField[])
    .filter((key) => place?.[key] != null)
    .slice(0, limit)
    .map((key) => {
      const { label, format } = CONTEXT_FIELDS[key];
      const beside = state?.[key];
      return {
        key,
        label,
        place: format(place![key]!),
        state: beside == null ? "—" : format(beside),
      };
    });
}

/** The Summary's own link, as printed on it. A Focus that an address lookup set marks a home: it stays out. */
export function shareSearch({ where, level, from, to, type, at, near }: ExploreQuery) {
  return writeQuery(new URLSearchParams(), {
    where,
    level,
    from,
    to,
    type,
    at: near === "address" ? null : at,
  })
    .toString()
    .replaceAll("%2C", ","); // a comma is legal in a query, and paper reads better without the escape
}
