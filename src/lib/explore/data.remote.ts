import { error } from "@sveltejs/kit";
import { prerender } from "$app/server";
import blockGroupManifest from "$lib/generated/blockgroup-manifest.json";
import manifest from "$lib/generated/state-manifest.json";
import blockGroupShards from "$lib/server/data/generated-blockgroup/blockgroup-metrics.json";
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

type BlockGroupSlice = {
  release: string;
  level: "blockgroup";
  boundaryYear: number;
  window: string;
  religion: string;
  /** State GEOID: block-group metrics ship one state Shard at a time. */
  shard: string;
};

const blockGroupSliceSchema = schema<BlockGroupSlice>((input) => {
  const value = (input ?? {}) as Partial<BlockGroupSlice>;
  if (
    value.release !== blockGroupManifest.release ||
    value.level !== "blockgroup" ||
    value.boundaryYear !== blockGroupManifest.boundaryYear ||
    typeof value.window !== "string" ||
    !blockGroupManifest.windows.includes(value.window) ||
    typeof value.religion !== "string" ||
    !blockGroupManifest.religions.includes(value.religion) ||
    typeof value.shard !== "string" ||
    !blockGroupManifest.states.includes(value.shard)
  ) {
    return { issues: [{ message: "Unsupported block-group data slice" }] };
  }
  return { value: value as BlockGroupSlice };
});

/** GEOID → reported closures. A block group without a key has no observation in the window. */
export const getBlockGroupMetrics = prerender(
  blockGroupSliceSchema,
  ({ window, shard }): Record<string, number> =>
    (blockGroupShards as Record<string, Record<string, Record<string, number>>>)[window][shard],
  {
    dynamic: true,
    inputs: () =>
      blockGroupManifest.windows.flatMap((window) =>
        blockGroupManifest.states.map((shard) => ({
          release: blockGroupManifest.release,
          level: "blockgroup" as const,
          boundaryYear: blockGroupManifest.boundaryYear,
          window,
          religion: blockGroupManifest.religions[0],
          shard,
        }))
      ),
  }
);
