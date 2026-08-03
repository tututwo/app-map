import counties_geoid from "$data/countyID/counties_geoid.csv";
import { normalizeCountyGeoid, resolveCountyDisplay } from "$lib/domain/countyGeoid";

/**
 * @typedef {{
 *   county?: string;
 *   state?: string;
 * }} NominatimAddress
 */

/**
 * @typedef {{
 *   lat?: string;
 *   lon?: string;
 *   display_name?: string;
 *   address?: NominatimAddress;
 * }} NominatimLocation
 */

/**
 * @typedef {{
 *   key: string;
 *   county: string;
 *   state: string | null;
 *   displayName: string;
 *   geoid: string;
 *   originalCountyName: string;
 *   originalLocation: string;
 * }} CountySearchResult
 */

// searchCounty2010Census.js
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";

// Keep track of the current request
/** @type {AbortController | null} */
let currentAbortController = null;

// Parse CSV and create a Map for efficient lookups
/** @type {Map<string, string>} */
const GEOID_MAP = new Map();

// Initialize the GEOID map from CSV data (dsv plugin yields one object per row,
// first column is "County, State", second is the GEOID)
counties_geoid.forEach((row) => {
  const keys = Object.keys(row);
  const countyState = row[keys[0]];
  const geoid = row[keys[1]];

  if (countyState && geoid) {
    GEOID_MAP.set(countyState.replace(/^"|"$/g, "").trim(), geoid.toString().trim());
  }
});

// Helper function to get state abbreviation
/** @param {string} stateName */
function getStateAbbreviation(stateName) {
  /** @type {Record<string, string>} */
  const stateAbbreviations = {
    Alabama: "AL",
    Alaska: "AK",
    Arizona: "AZ",
    Arkansas: "AR",
    California: "CA",
    Colorado: "CO",
    Connecticut: "CT",
    Delaware: "DE",
    Florida: "FL",
    Georgia: "GA",
    Hawaii: "HI",
    Idaho: "ID",
    Illinois: "IL",
    Indiana: "IN",
    Iowa: "IA",
    Kansas: "KS",
    Kentucky: "KY",
    Louisiana: "LA",
    Maine: "ME",
    Maryland: "MD",
    Massachusetts: "MA",
    Michigan: "MI",
    Minnesota: "MN",
    Mississippi: "MS",
    Missouri: "MO",
    Montana: "MT",
    Nebraska: "NE",
    Nevada: "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    Ohio: "OH",
    Oklahoma: "OK",
    Oregon: "OR",
    Pennsylvania: "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    Tennessee: "TN",
    Texas: "TX",
    Utah: "UT",
    Vermont: "VT",
    Virginia: "VA",
    Washington: "WA",
    "West Virginia": "WV",
    Wisconsin: "WI",
    Wyoming: "WY",
  };

  return stateAbbreviations[stateName] || stateName;
}

// Helper function to lookup GEOID
/**
 * @param {string} countyName
 * @param {string | null} state
 */
function lookupGeoid(countyName, state) {
  if (!countyName) return null;

  // Get state abbreviation if we have full state name
  const stateAbbr = state ? getStateAbbreviation(state) : null;

  // Try different key formats
  const keysToTry = [];

  // Add keys with state abbreviation first (most specific)
  if (stateAbbr) {
    keysToTry.push(`${countyName}, ${stateAbbr}`);
  }

  // Add keys with full state name
  if (state) {
    keysToTry.push(`${countyName}, ${state}`);
  }

  // Add just the county name
  keysToTry.push(countyName);

  for (const key of keysToTry) {
    if (GEOID_MAP.has(key)) {
      return GEOID_MAP.get(key);
    }
  }

  return null;
}

/** @param {string} query */
export async function searchCounties(query) {
  if (!query || query.length < 3) return [];

  // Cancel any existing request
  if (currentAbortController) {
    currentAbortController.abort();
  }

  // Create new abort controller for this request
  currentAbortController = new AbortController();

  try {
    const searchResponse = await fetch(
      `${NOMINATIM_BASE_URL}/search?` +
        new URLSearchParams({
          q: query,
          format: "json",
          addressdetails: "1",
          limit: "5",
          "accept-language": "en",
        }),
      {
        headers: {
          "User-Agent": "CountySearchApp/1.0 (gordontu2@gmail.com)",
        },
        signal: currentAbortController.signal,
      }
    );

    const locations = /** @type {NominatimLocation[]} */ (await searchResponse.json());
    /** @type {CountySearchResult[]} */
    const countyResults = [];

    for (const location of locations) {
      let countyName = null;
      let state = null;

      if (location.address) {
        countyName = location.address.county;
        state = location.address.state || null;
      }

      // If we don't have county info, try reverse geocoding
      if (!countyName && location.lat && location.lon) {
        // Check if request was cancelled before making another request
        if (currentAbortController.signal.aborted) {
          throw new Error("Request cancelled");
        }

        const reverseResponse = await fetch(
          `${NOMINATIM_BASE_URL}/reverse?` +
            new URLSearchParams({
              lat: location.lat,
              lon: location.lon,
              format: "json",
              zoom: "8",
              addressdetails: "1",
            }),
          {
            headers: {
              "User-Agent": "CountySearchApp/1.0 (gordontu2@gmail.com)",
            },
            signal: currentAbortController.signal,
          }
        );

        const reverseData = /** @type {NominatimLocation} */ (await reverseResponse.json());
        if (reverseData.address) {
          countyName = reverseData.address.county;
          state = reverseData.address.state || null;
        }
      }

      if (countyName) {
        // IMPORTANT: Look up GEOID using the ORIGINAL county/region name from the API
        // For CT, this will be the planning region name (e.g., "South Central Connecticut Planning Region")

        const sourceGeoid = lookupGeoid(countyName, state);
        if (!sourceGeoid) continue;

        const geoid = normalizeCountyGeoid(sourceGeoid);
        const { county, displayName } = resolveCountyDisplay(countyName, state);
        const key = `${county}_${state}`;

        if (!countyResults.find((r) => r.key === key)) {
          countyResults.push({
            key,
            county,
            state,
            displayName,
            geoid,
            originalCountyName: countyName, // Keep original for debugging
            originalLocation: location.display_name ?? displayName,
          });
        }
      }
    }

    return countyResults;
  } catch (error) {
    // Don't log cancelled requests as errors
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.message === "Request cancelled")
    ) {
      return [];
    }
    console.error("Geocoding error:", error);
    return [];
  }
}

// Add this new function for reverse geocoding a specific coordinate
/**
 * @param {number} lat
 * @param {number} lon
 */
export async function reverseGeocodeCounty(lat, lon) {
  try {
    const reverseResponse = await fetch(
      `${NOMINATIM_BASE_URL}/reverse?` +
        new URLSearchParams({
          lat: lat.toString(),
          lon: lon.toString(),
          format: "json",
          zoom: "8",
          addressdetails: "1",
        }),
      {
        headers: {
          "User-Agent": "CountySearchApp/1.0 (gordontu2@gmail.com)",
        },
      }
    );

    const reverseData = /** @type {NominatimLocation} */ (await reverseResponse.json());

    if (reverseData.address) {
      const countyName = reverseData.address.county;
      const state = reverseData.address.state;

      if (countyName && state) {
        // Look up GEOID using the original county name
        const sourceGeoid = lookupGeoid(countyName, state);
        const geoid = sourceGeoid ? normalizeCountyGeoid(sourceGeoid) : null;
        const { county, displayName } = resolveCountyDisplay(countyName, state);

        return {
          geoid,
          displayName,
          county,
          state,
          originalCountyName: countyName,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return null;
  }
}
