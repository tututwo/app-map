import { VectorTile, type VectorTileFeature } from "@mapbox/vector-tile";
import Pbf from "pbf";
import { PMTiles, Protocol } from "pmtiles";
import { env } from "$env/dynamic/public";
import { TILES, type Level, type LngLat } from "./model";

/**
 * The Unit that contains a Focus (ADR-0003): one tile at the archive's highest zoom, read straight from
 * the PMTiles archive and tested point-in-polygon. The rendered map is never asked, so the answer does
 * not wait for the camera. Browser only: a shared link carries the derived Unit for the server.
 */

/** The map draws through this protocol too, so an archive's header and directories load once. */
export const protocol = new Protocol();

export const archiveUrl = (archive: string) =>
  String(new URL(`${env.PUBLIC_TILES_URL ?? "/tiles"}/${archive}`, location.href));

function archiveAt(url: string) {
  let archive = protocol.get(url);
  if (!archive) protocol.add((archive = new PMTiles(url)));
  return archive;
}

export type Bounds = [[west: number, south: number], [east: number, north: number]];

/** The slippy tile that holds a point, and the point's position inside it in tile units. */
export function tilePoint([lng, lat]: LngLat, z: number, extent: number) {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  const fx = ((lng + 180) / 360) * n;
  const fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const [x, y] = [Math.floor(fx), Math.floor(fy)];
  return { x, y, px: (fx - x) * extent, py: (fy - y) * extent };
}

/** The inverse: a position in tile units back to longitude and latitude. */
export function tileLngLat(
  x: number,
  y: number,
  z: number,
  px: number,
  py: number,
  extent: number
) {
  const n = 2 ** z;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / extent)) / n)));
  return [((x + px / extent) / n) * 360 - 180, (lat * 180) / Math.PI] as LngLat;
}

/** Even-odd over every ring, which handles holes and multipolygons alike. */
export function inRings(rings: { x: number; y: number }[][], x: number, y: number) {
  let inside = false;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x)
        inside = !inside;
    }
  return inside;
}

interface Reading {
  geoid: string;
  bounds: Bounds;
  /** The Unit runs past this tile, so `bounds` covers only part of it. */
  clipped: boolean;
}

/** The feature of one tile that `match` accepts: the one under the point, or the one with a GEOID. */
async function readTile(
  level: Exclude<Level, "state">,
  at: LngLat,
  z: number,
  match: (feature: VectorTileFeature, px: number, py: number) => boolean
): Promise<Reading | null> {
  const { archive, sourceLayer } = TILES[level];
  const { x, y } = tilePoint(at, z, 1);
  const tile = await archiveAt(archiveUrl(archive)).getZxy(z, x, y);
  const layer = tile && new VectorTile(new Pbf(new Uint8Array(tile.data))).layers[sourceLayer];
  if (!layer) return null;
  const { extent } = layer;
  const { px, py } = tilePoint(at, z, extent);
  for (let index = 0; index < layer.length; index++) {
    const feature = layer.feature(index);
    if (!match(feature, px, py)) continue;
    const [west, north, east, south] = feature.bbox();
    return {
      geoid: String(feature.properties.geoid),
      bounds: [tileLngLat(x, y, z, west, south, extent), tileLngLat(x, y, z, east, north, extent)],
      clipped: west <= 0 || north <= 0 || east >= extent || south >= extent,
    };
  }
  return null;
}

const readings = new Map<string, Promise<Reading | null>>();
function reading(level: Exclude<Level, "state">, at: LngLat) {
  const key = `${level}@${at}`;
  let hit = readings.get(key);
  if (!hit) {
    hit = archiveAt(archiveUrl(TILES[level].archive))
      .getHeader()
      .then(({ maxZoom }) =>
        readTile(level, at, maxZoom, (feature, px, py) => inRings(feature.loadGeometry(), px, py))
      );
    hit.catch(() => readings.delete(key)); // a failed request may be retried
    readings.set(key, hit);
  }
  return hit;
}

/** GEOID of the Unit of `level` that contains `at`, or null where no Unit does. */
export async function unitAt(level: Level, at: LngLat): Promise<string | null> {
  // States have no archive; a county's GEOID starts with its state's.
  if (level === "state") return (await unitAt("county", at))?.slice(0, 2) ?? null;
  return (await reading(level, at))?.geoid ?? null;
}

/**
 * What the camera frames to show that Unit whole. A city block group fits in its tile; a Unit that runs
 * past the tile is read again one zoom lower until a tile holds all of it. Null leaves the camera to a
 * fixed zoom.
 */
export async function frameOf(level: Level, at: LngLat): Promise<Bounds | null> {
  if (level === "state") return null;
  let found = await reading(level, at);
  if (!found?.clipped) return found?.bounds ?? null;
  const { geoid } = found;
  const { minZoom, maxZoom } = await archiveAt(archiveUrl(TILES[level].archive)).getHeader();
  for (let z = maxZoom - 1; z >= minZoom && found?.clipped; z--)
    found = await readTile(level, at, z, (feature) => feature.properties.geoid === geoid);
  return found && !found.clipped ? found.bounds : null;
}
