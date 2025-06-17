/// file: src/routes/+page.server.js

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
