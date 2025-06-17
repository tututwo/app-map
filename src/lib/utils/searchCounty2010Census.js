import counties_geoid from "$data/counties_geoid.csv";

// searchCounty2010Census.js
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";

// Keep track of the current request
let currentAbortController = null;

const REGION_TO_2010_COUNTY = {
  // Connecticut planning regions to historical county names mapping
  // The geocoding API returns planning region names, but we display historical county names
  "South Central Connecticut Planning Region": "New Haven County",
  "Western Connecticut Planning Region": "Fairfield County",
  "Lower Connecticut River Valley Planning Region": "Middlesex County",
  "Southeastern Connecticut Planning Region": "New London County",
  "Capitol Planning Region": "Hartford County",
  "Northeastern Connecticut Planning Region": "Windham County",
  "Northwest Hills Planning Region": "Litchfield County",
  "Central Connecticut Planning Region": "Hartford County",
};

// Parse CSV and create a Map for efficient lookups
const GEOID_MAP = new Map();

// Initialize the GEOID map from CSV data

counties_geoid.forEach((row, index) => {
  // Handle different CSV formats - could be array or object
  let countyState, geoid;

  if (Array.isArray(row)) {
    countyState = row[0];
    geoid = row[1];
  } else if (typeof row === "object") {
    // Object format (if using d3-dsv or similar parser)
    const keys = Object.keys(row);
    countyState = row[keys[0]];
    geoid = row[keys[1]];
  }

  if (countyState && geoid) {
    // Remove quotes if present
    const cleanKey = countyState.replace(/^"|"$/g, "").trim();
    const cleanGeoid = geoid.toString().trim();

    // Store the cleaned key
    GEOID_MAP.set(cleanKey, cleanGeoid);

    // Debug: log CT entries
    // if (cleanKey.includes("Connecticut") && index < 20) {
    //   console.log(`Stored: "${cleanKey}" -> "${cleanGeoid}"`);
    // }
  }
});

// Helper function to get state abbreviation
function getStateAbbreviation(stateName) {
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

    const locations = await searchResponse.json();
    const countyResults = [];

    for (const location of locations) {
      let countyName = null;
      let state = null;

      if (location.address) {
        countyName =
          location.address.county ||
          location.address.administrative_area_level_2 ||
          location.address.state_district;
        state = location.address.state || location.address.administrative_area_level_1;
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

        const reverseData = await reverseResponse.json();
        if (reverseData.address) {
          countyName =
            reverseData.address.county || reverseData.address.administrative_area_level_2;
          state = reverseData.address.state;
        }
      }

      if (countyName) {
        // IMPORTANT: Look up GEOID using the ORIGINAL county/region name from the API
        // For CT, this will be the planning region name (e.g., "South Central Connecticut Planning Region")
        const geoid = lookupGeoid(countyName, state);

        // Map to display name (for CT planning regions, this converts to historical county names)
        const mapped2010County = REGION_TO_2010_COUNTY[countyName] || countyName;

        const displayName = state ? `${mapped2010County}, ${state}` : mapped2010County;
        const key = `${mapped2010County}_${state}`;

        if (!countyResults.find((r) => r.key === key)) {
          countyResults.push({
            key,
            county: mapped2010County, // Display name (e.g., "New Haven County")
            state,
            displayName,
            geoid: geoid, // GEOID from original region name (e.g., "09170")
            originalCountyName: countyName, // Keep original for debugging
            originalLocation: location.display_name,
          });
        }
      }
    }

    return countyResults;
  } catch (error) {
    // Don't log cancelled requests as errors
    if (error.name === "AbortError" || error.message === "Request cancelled") {
      return [];
    }
    console.error("Geocoding error:", error);
    return [];
  }
}

// Add this new function for reverse geocoding a specific coordinate
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

    const reverseData = await reverseResponse.json();

    if (reverseData.address) {
      const countyName =
        reverseData.address.county ||
        reverseData.address.administrative_area_level_2 ||
        reverseData.address.state_district;
      const state = reverseData.address.state || reverseData.address.administrative_area_level_1;

      if (countyName && state) {
        // Look up GEOID using the original county name
        const geoid = lookupGeoid(countyName, state);

        // Map to display name (handles CT planning regions)
        const mapped2010County = REGION_TO_2010_COUNTY[countyName] || countyName;
        const displayName = `${mapped2010County}, ${state}`;

        return {
          geoid: geoid || null,
          displayName,
          county: mapped2010County,
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
