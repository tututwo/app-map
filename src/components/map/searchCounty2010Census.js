// searchCounty2010Census.js
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";

// Keep track of the current request
let currentAbortController = null;

const REGION_TO_2010_COUNTY = {
  "South Central Connecticut Planning Region": "New Haven County",
  "Western Connecticut Planning Region": "Fairfield County",
  "Lower Connecticut River Valley Planning Region": "Middlesex County",
  "Southeastern Connecticut Planning Region": "New London County",
  "Capitol Planning Region": "Hartford County",
  "Northeastern Connecticut Planning Region": "Windham County",
  "Northwest Hills Planning Region": "Litchfield County",
  "Central Connecticut Planning Region": "Hartford County",
};

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
        const mapped2010County = REGION_TO_2010_COUNTY[countyName] || countyName;
        const displayName = state ? `${mapped2010County}, ${state}` : mapped2010County;
        const key = `${mapped2010County}_${state}`;

        if (!countyResults.find((r) => r.key === key)) {
          countyResults.push({
            key,
            county: mapped2010County,
            state,
            displayName,
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
