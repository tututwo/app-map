import {
  getLineSeries,
  getMapData,
  getSideMetric,
  getStackedSeries,
} from "$lib/dashboard/data.remote";
import { parseDashboardParams } from "$lib/dashboard/params";

import type { PageLoad } from "./$types";

const REQUEST_TIMEOUT_MS = 10_000;

/** One dashboard part: the resolved value, or nothing plus why not. */
export interface SettledPart<T> {
  value?: T;
  timedOut?: boolean;
}

// Bound every part so a stalled fetch cannot hang navigation: failures and
// timeouts resolve to an empty part the page surfaces as its error toast.
function settle<T>(promise: Promise<T>): Promise<SettledPart<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ timedOut: true }), REQUEST_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve({ value });
      },
      () => {
        clearTimeout(timer);
        resolve({});
      }
    );
  });
}

// The remote queries resolve here — server-side for SSR, and again during
// hydration/client navigation where kit dedupes against the serialized
// results, so nothing is fetched twice.
export const load: PageLoad = async ({ url }) => {
  const params = parseDashboardParams(url);

  const [map, line, stacked, side] = await Promise.all([
    settle(getMapData({ from: params.from, to: params.to })),
    settle(getLineSeries(params.geoid)),
    settle(getStackedSeries(params.geoid)),
    settle(getSideMetric(params.geoid)),
  ]);

  return { params, map, line, stacked, side };
};
