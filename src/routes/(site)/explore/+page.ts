import { getStateMetrics } from "$lib/explore/data.remote";
import { manifest, parseExploreQuery, windowFor, type StateMetric } from "$lib/explore/model";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ url }) => {
  const query = parseExploreQuery(url.searchParams);
  const window = windowFor(query);
  // A stalled remote response must not leave navigation waiting indefinitely.
  const result = await new Promise<{ rows: StateMetric[]; error: string | null }>((resolve) => {
    const timer = setTimeout(
      () =>
        resolve({
          rows: [],
          error: "State data took too long to load. Please retry.",
        }),
      10_000
    );
    getStateMetrics({
      release: manifest.release,
      level: "state",
      boundaryYear: window.boundaryYear,
      window: window.key,
      religion: query.type,
    }).then(
      (rows) => {
        clearTimeout(timer);
        resolve({ rows, error: null });
      },
      () => {
        clearTimeout(timer);
        resolve({ rows: [], error: "State data could not be loaded. Please retry." });
      }
    );
  });
  return { query, ...result };
};
