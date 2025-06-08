// utils.js
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";

// Mapping of modern administrative regions back to 2010 county names
const REGION_TO_2010_COUNTY = {
  // Connecticut planning regions to 2010 counties
  "South Central Connecticut Planning Region": "New Haven County",
  "Western Connecticut Planning Region": "Fairfield County",
  "Lower Connecticut River Valley Planning Region": "Middlesex County",
  "Southeastern Connecticut Planning Region": "New London County",
  "Capitol Planning Region": "Hartford County",
  "Northeastern Connecticut Planning Region": "Windham County",
  "Northwest Hills Planning Region": "Litchfield County",
  "Central Connecticut Planning Region": "Hartford County",

  // Add other state mappings as needed
  // You can expand this based on what you encounter
};

export async function searchCounties(query) {
  if (!query || query.length < 3) return [];

  try {
    // Use your existing Nominatim search logic
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
        // Convert modern regional names back to 2010 county names
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
    console.error("Geocoding error:", error);
    return [];
  }
}
