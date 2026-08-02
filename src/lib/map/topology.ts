import { feature } from "topojson-client";
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

export function topologyToFeatureCollection(value: unknown): CountyFeatureCollection {
  const topology = asTopology(value);
  const object = Object.values(topology.objects)[0];
  if (!object) throw new Error("Invalid TopoJSON: no geometry objects found");

  const converted = feature(topology, object) as
    | Feature<Geometry, GeoJsonProperties>
    | FeatureCollection<Geometry, GeoJsonProperties>;
  const collection =
    converted.type === "FeatureCollection"
      ? converted
      : ({ type: "FeatureCollection", features: [converted] } as const);

  return collection as CountyFeatureCollection;
}
