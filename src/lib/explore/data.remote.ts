import { error } from "@sveltejs/kit";
import { prerender } from "$app/server";
import manifest from "$lib/generated/state-manifest.json";
import rows from "$lib/server/data/generated-state/state-metrics.json";
import { schema } from "$lib/server/schema";
import type { StateMetric } from "./model";

type StateSlice = {
  release: string;
  level: "state";
  boundaryYear: number;
  window: string;
  religion: string;
};

const stateSliceSchema = schema<StateSlice>((input) => {
  const value = (input ?? {}) as Partial<StateSlice>;
  const window = manifest.windows.find((window) => window.key === value.window);
  if (
    value.release !== manifest.release ||
    value.level !== "state" ||
    !window ||
    value.boundaryYear !== window.boundaryYear ||
    typeof value.religion !== "string" ||
    !manifest.religions.includes(value.religion)
  ) {
    return { issues: [{ message: "Unsupported state data slice" }] };
  }
  return { value: value as StateSlice };
});

export const getStateMetrics = prerender(
  stateSliceSchema,
  ({ window, religion }): StateMetric[] => {
    const slice = rows.filter((row) => row.window === window && row.religion === religion);
    if (!slice.length) error(404, "State metrics are unavailable for this selection");
    return slice;
  },
  {
    dynamic: true,
    inputs: () =>
      manifest.windows.flatMap((window) =>
        manifest.religions.map((religion) => ({
          release: manifest.release,
          level: "state" as const,
          boundaryYear: window.boundaryYear,
          window: window.key,
          religion,
        }))
      ),
  }
);
