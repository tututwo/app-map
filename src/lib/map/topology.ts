import { feature } from "topojson-client";
import { geoBounds } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from "geojson";
import type { Topology } from "topojson-specification";

export type CountyFeatureCollection = FeatureCollection<Geometry, Record<string, unknown>>;

function asTopology(value: unknown): Topology {
  if (
    typeof value !== "object" ||
    value === null ||
    !("type" in value) ||
    value.type !== "Topology" ||
    !("objects" in value) ||
    typeof value.objects !== "object" ||
    value.objects === null ||
    !("arcs" in value) ||
    !Array.isArray(value.arcs)
  ) {
    throw new Error("Invalid TopoJSON: expected a topology with objects and arcs");
  }

  return value as Topology;
}

export function topologyToFeatureCollection(
  value: unknown,
  objectName?: string
): CountyFeatureCollection {
  const topology = asTopology(value);
  const object = objectName ? topology.objects[objectName] : Object.values(topology.objects)[0];
  if (!object) throw new Error(`Invalid TopoJSON: ${objectName ?? "geometry"} object not found`);

  const converted = feature(topology, object) as
    | Feature<Geometry, GeoJsonProperties>
    | FeatureCollection<Geometry, GeoJsonProperties>;
  const collection =
    converted.type === "FeatureCollection"
      ? converted
      : ({ type: "FeatureCollection", features: [converted] } as const);

  return collection as CountyFeatureCollection;
}

/** MapLibre needs an increasing longitude interval, including Alaska across the dateline. */
export function featureBounds(value: Feature<Geometry>): [[number, number], [number, number]] {
  const [[west, south], [east, north]] = geoBounds(value);
  return [
    [west > east ? west - 360 : west, south],
    [east, north],
  ];
}
