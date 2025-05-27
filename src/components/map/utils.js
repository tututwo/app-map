// lib/geocoding.js
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";

export async function searchCounties(query) {
  if (!query || query.length < 3) return [];

  try {
    // First, get locations matching the query
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
          "User-Agent": "YourApp/1.0 (your-email@example.com)",
        },
      }
    );

    const locations = await searchResponse.json();
    const countyResults = [];

    // For each location, extract county information
    for (const location of locations) {
      let countyName = null;
      let state = null;

      // Extract county from address components
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
              zoom: "8", // County level
              addressdetails: "1",
            }),
          {
            headers: {
              "User-Agent": "YourApp/1.0 (your-email@example.com)",
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
        const displayName = state ? `${countyName}, ${state}` : countyName;
        const key = `${countyName}_${state}`;

        // Avoid duplicates
        if (!countyResults.find((r) => r.key === key)) {
          countyResults.push({
            key,
            county: countyName,
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
