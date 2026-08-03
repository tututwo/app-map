import { NATIONAL_GEOID } from "$lib/domain/countyGeoid";
import { readSideMetric } from "$lib/server/data/by-geoid";
import { createByGeoidEndpoint } from "$lib/server/geoid-endpoint";

// The side-metric dataset publishes no national values; the sentinel gets an
// explicit empty response instead of a county row.
export const GET = createByGeoidEndpoint(readSideMetric, {
  national: () => ({ geoid: NATIONAL_GEOID }),
});
