/// file: src/routes/+page.server.js
import { error } from "@sveltejs/kit";

/** * @type {object | null}
 * --- In-memory cache for the fetched GeoJSON data ---
 */
let cachedGeojson = null;

/**
 * Filters a GeoJSON FeatureCollection based on a property suffix.
 * @param {any} geojson The GeoJSON object to filter.
 * @param {string} suffix The suffix to filter properties by.
 * @param {string[]} alwaysInclude An array of property keys to always include.
 * @returns {any} A new, filtered GeoJSON FeatureCollection.
 */
function filterGeojsonByPropertySuffix(geojson, suffix, alwaysInclude = ["geoid"]) {
  if (!geojson || !Array.isArray(geojson.features)) {
    return { type: "FeatureCollection", features: [] };
  }

  // Memoize the keys for performance
  const propertyKeys = Object.keys(geojson.features[0]?.properties || {});
  const suffixKeys = propertyKeys.filter((key) => key.endsWith(suffix));
  const finalKeys = Array.from(new Set([...suffixKeys, ...alwaysInclude]));

  const filteredFeatures = geojson.features.map(({ type, geometry, properties }) => {
    const filteredProps = {};
    for (const key of finalKeys) {
      if (key in properties) {
        filteredProps[key] = properties[key];
      }
    }

    return {
      type, // "Feature"
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
export async function load({ fetch, url }) {
  const csvData = await fetch("/api/map_data?from=2001&to=2021&geoid");
  const data = await csvData.json();

  return {
    data,
  };
  // // --- Use SvelteKit's fetch to get the remote data and cache it ---
  // if (!cachedGeojson) {

  //   const geojsonUrl =
  //     "https://github.com/tututwo/app-map/raw/002766600dab4fe12acb4aae0646af17b74d5454/src/data/allMetricsByCounty_06042025.geojson";

  //   try {
  //     const response = await fetch(geojsonUrl);
  //     if (!response.ok) {
  //       // Throw a server-side error if the fetch fails
  //       error(response.status, `Failed to fetch GeoJSON: ${response.statusText}`);
  //     }
  //     cachedGeojson = await response.json();
  //     console.log("GeoJSON data has been cached in memory.");
  //   } catch (err) {
  //     console.error(err);
  //     error(500, "There was an issue fetching or parsing the GeoJSON data.");
  //   }
  // }

  // // Get the suffix from the URL search parameters
  // const suffix = url.searchParams.get("suffix") || "2002-2014";

  // // Perform the filtering on the cached data
  // const filteredGeojson = filterGeojsonByPropertySuffix(cachedGeojson, suffix);

  // return {
  //   geojson: filteredGeojson,
  //   currentSuffix: suffix,
  // };
}
