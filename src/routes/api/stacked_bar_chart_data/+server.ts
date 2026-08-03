import { readStackedSeries } from "$lib/server/data/by-geoid";
import { createByGeoidEndpoint } from "$lib/server/geoid-endpoint";

export const GET = createByGeoidEndpoint(readStackedSeries);
