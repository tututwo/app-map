#!/usr/bin/env node
// Explore draws states only, so it should not download every county boundary to get them. This keeps the
// `states` object of src/data/counties-10m.json and the arcs it uses, renumbered; the geometry is identical.
//     node scripts/build-states-topology.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";

const source = new URL("../src/data/counties-10m.json", import.meta.url);
const target = new URL("../src/data/states-10m.json", import.meta.url);
const topology = JSON.parse(readFileSync(source, "utf8"));

const arcs = [];
const renumbered = new Map();
// An arc walked backwards is written ~index.
const renumber = (index) => {
  const forward = index < 0 ? ~index : index;
  if (!renumbered.has(forward)) renumbered.set(forward, arcs.push(topology.arcs[forward]) - 1);
  return index < 0 ? ~renumbered.get(forward) : renumbered.get(forward);
};
const walk = (value) => (Array.isArray(value) ? value.map(walk) : renumber(value));
const states = {
  ...topology.objects.states,
  geometries: topology.objects.states.geometries.map((geometry) => ({
    ...geometry,
    arcs: walk(geometry.arcs),
  })),
};
const slim = { ...topology, objects: { states }, arcs };

// The check that matters: every state comes out with exactly the coordinates it had.
const before = JSON.stringify(feature(topology, topology.objects.states));
if (before !== JSON.stringify(feature(slim, slim.objects.states)))
  throw new Error("state geometry changed");
writeFileSync(target, JSON.stringify(slim));
console.log(
  `${states.geometries.length} states, ${arcs.length} of ${topology.arcs.length} arcs, ${(JSON.stringify(slim).length / 1024).toFixed(0)} KB`
);
