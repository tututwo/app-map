/// file: src/routes/+page.server.js
import fs from "fs/promises";
import path from "path";

// --- OPTIMIZATION: In-memory cache for the parsed GeoJSON ---
/** @type {object | null} */
let cachedGeojson = null;

// Your updated filter function
function filterGeojsonByPropertySuffix(
  geojson,
  suffix,
  alwaysInclude = ["geoid"],
  filterFn = (feature) => feature.properties.decennial_census === 2010.0
) {
  if (!geojson || !Array.isArray(geojson.features) || geojson.features.length === 0) {
    // Return a valid empty GeoJSON structure instead of throwing
    return { type: "FeatureCollection", features: [] };
  }

  const allKeys = Object.keys(geojson.features[0].properties);
  const suffixKeys = allKeys.filter((key) => key.endsWith(suffix));
  const finalKeys = Array.from(new Set([...suffixKeys, ...alwaysInclude]));

  const filteredFeatures = geojson.features
    .filter((feature) => (typeof filterFn === "function" ? filterFn(feature) : true))
    .map(({ type, geometry, properties }) => {
      const filteredProps = {};
      finalKeys.forEach((key) => {
        if (key in properties) {
          filteredProps[key] = properties[key];
        }
      });

      return {
        type: "Feature",
        geometry,
        properties: filteredProps,
      };
    });

  return {
    type: "FeatureCollection",
    features: filteredFeatures,
  };
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
  // Read from cache or load from disk if cache is empty
  if (!cachedGeojson) {
    console.log("Reading and parsing GeoJSON file for the first time...");
    const geojsonPath = path.resolve(process.cwd(), "src/data/allMetricsByCounty_06042025.geojson");
    const geojsonData = await fs.readFile(geojsonPath, "utf8");
    cachedGeojson = JSON.parse(geojsonData);
    console.log("GeoJSON data cached in memory.");
  }

  // Get the suffix from the URL. Fallback to a default if not provided.
  const suffix = url.searchParams.get("suffix") || "2002-2014";

  // Perform the filtering on the cached data
  const filteredGeojson = filterGeojsonByPropertySuffix(cachedGeojson, suffix);

  // Return only the necessary data to the client
  return {
    geojson: filteredGeojson,
    currentSuffix: suffix,
  };
}
