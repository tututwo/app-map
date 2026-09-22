// Throwaway: what Explore pays for its state outlines, from the county file (before) and the states file.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { feature } from "topojson-client";
import { geoBounds } from "d3-geo";
const median = (fn, n = 9) => {
  const runs = [];
  let out;
  for (let i = 0; i < n; i++) {
    const s = performance.now();
    out = fn();
    runs.push(performance.now() - s);
  }
  return [runs.sort((a, b) => a - b)[n >> 1], out];
};
for (const name of ["counties-10m", "states-10m"]) {
  const raw = readFileSync(`src/data/${name}.json`);
  const [parse, topology] = median(() => JSON.parse(raw));
  const [convert, states] = median(() => feature(topology, topology.objects.states));
  const [bounds] = median(() => states.features.map((f) => geoBounds(f)));
  console.log(
    `${name.padEnd(13)} gzip ${(gzipSync(raw, { level: 9 }).length / 1024).toFixed(0).padStart(4)} KB   parse ${parse.toFixed(1)} ms   to GeoJSON ${convert.toFixed(1)} ms   bounds of ${states.features.length} states ${bounds.toFixed(1)} ms (was per map move, now once)`
  );
}
