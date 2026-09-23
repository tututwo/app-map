import { VectorTile, type VectorTileFeature, type VectorTileLayer } from "@mapbox/vector-tile";
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
type Fine = Exclude<Level, "state">;

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

/** One tile's part of a Unit. */
export interface Piece {
  geoid: string;
  bounds: Bounds;
  /** Neighbouring tiles, as offsets, that the Unit runs into past this tile's edges. */
  beyond: [dx: number, dy: number][];
}

// A click reads the same tile for its Unit and for the camera, and the next click nearby reads it again.
const layers = new Map<string, Promise<VectorTileLayer | null>>();
function layerAt(level: Fine, z: number, x: number, y: number) {
  const { archive, sourceLayer } = TILES[level];
  const key = `${archive}/${z}/${x}/${y}`;
  let hit = layers.get(key);
  if (!hit) {
    const read = archiveAt(archiveUrl(archive))
      .getZxy(z, x, y)
      .then((tile) =>
        tile
          ? (new VectorTile(new Pbf(new Uint8Array(tile.data))).layers[sourceLayer] ?? null)
          : null
      );
    read.catch(() => {
      if (layers.get(key) === read) layers.delete(key); // a failed request may be retried
    });
    layers.set(key, (hit = read));
    // ponytail: first in, first out; tiles near max zoom are a few dozen kilobytes each.
    if (layers.size > 64) layers.delete(layers.keys().next().value!);
  }
  return hit;
}

type Match = (feature: VectorTileFeature, extent: number) => boolean;
const named =
  (geoid: string): Match =>
  (feature) =>
    String(feature.properties.geoid) === geoid;
function containing(at: LngLat, z: number): Match {
  let point: { px: number; py: number } | undefined;
  return (feature, extent) => {
    point ??= tilePoint(at, z, extent);
    return inRings(feature.loadGeometry(), point.px, point.py);
  };
}

async function pieceAt(level: Fine, z: number, x: number, y: number, match: Match) {
  const layer = await layerAt(level, z, x, y);
  if (!layer) return null;
  const { extent } = layer;
  for (let index = 0; index < layer.length; index++) {
    const feature = layer.feature(index);
    if (!match(feature, extent)) continue;
    const [west, north, east, south] = feature.bbox();
    const beyond: Piece["beyond"] = [];
    if (west <= 0) beyond.push([-1, 0]);
    if (east >= extent) beyond.push([1, 0]);
    if (north <= 0) beyond.push([0, -1]);
    if (south >= extent) beyond.push([0, 1]);
    return {
      geoid: String(feature.properties.geoid),
      bounds: [tileLngLat(x, y, z, west, south, extent), tileLngLat(x, y, z, east, north, extent)],
      beyond,
    } satisfies Piece;
  }
  return null;
}

const header = (level: Fine) => archiveAt(archiveUrl(TILES[level].archive)).getHeader();

const readings = new Map<string, Promise<Piece | null>>();
function reading(level: Fine, at: LngLat) {
  const key = `${level}@${at}`;
  let hit = readings.get(key);
  if (!hit) {
    hit = header(level).then(({ maxZoom }) => {
      const { x, y } = tilePoint(at, maxZoom, 1);
      return pieceAt(level, maxZoom, x, y, containing(at, maxZoom));
    });
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
 * A Unit's bounds over every tile it runs into, starting from the tile at (x, y). Tiles are read a ring
 * at a time; past `budget` tiles the answer is null, and a lower zoom, where the Unit spans fewer, is
 * the better place to look.
 */
export async function spanOf(
  read: (x: number, y: number) => Promise<Piece | null>,
  x: number,
  y: number,
  budget = 4
): Promise<Bounds | null> {
  const seen = new Set<string>();
  let ring: [number, number][] = [[x, y]];
  let bounds: Bounds | null = null;
  while (ring.length) {
    for (const [tx, ty] of ring) seen.add(`${tx}/${ty}`);
    if (seen.size > budget) return null;
    const pieces = await Promise.all(ring.map(([tx, ty]) => read(tx, ty)));
    const next = new Map<string, [number, number]>();
    for (let index = 0; index < ring.length; index++) {
      const piece = pieces[index];
      if (!piece) continue;
      const [[west, south], [east, north]] = piece.bounds;
      bounds = bounds
        ? [
            [Math.min(bounds[0][0], west), Math.min(bounds[0][1], south)],
            [Math.max(bounds[1][0], east), Math.max(bounds[1][1], north)],
          ]
        : piece.bounds;
      const [tx, ty] = ring[index];
      for (const [dx, dy] of piece.beyond)
        if (!seen.has(`${tx + dx}/${ty + dy}`))
          next.set(`${tx + dx}/${ty + dy}`, [tx + dx, ty + dy]);
    }
    ring = [...next.values()];
  }
  return bounds;
}

/**
 * What the camera frames to show that Unit whole: its bounds at the highest zoom where it spans at most
 * four tiles. A city block group usually fits its own tile; a county that crosses a tile edge (Memphis
 * sits on 90°W, an edge at every zoom) is pieced together from its neighbours. `geoid` names the Unit
 * when a click already did. Null leaves the camera to a fixed zoom.
 */
export async function frameOf(level: Level, at: LngLat, geoid?: string): Promise<Bounds | null> {
  if (level === "state") return null;
  const id = geoid ?? (await reading(level, at))?.geoid;
  if (!id) return null;
  const { minZoom, maxZoom } = await header(level);
  for (let z = maxZoom; z >= minZoom; z--) {
    const { x, y } = tilePoint(at, z, 1);
    const bounds = await spanOf((tx, ty) => pieceAt(level, z, tx, ty, named(id)), x, y);
    if (bounds) return bounds;
  }
  return null;
}
