# Play Currency – Google Maps API Plan

This document lists which Google Maps Platform APIs we actually need to build a real‑world, playable Philippines map with avatars, plus optional APIs for later phases.

## Phase 0 – Keys & Setup (Web)

Environment variables (client-visible must be prefixed with VITE_):
- VITE_GOOGLE_MAPS_API_KEY — primary key for Maps JavaScript and web services
- VITE_GOOGLE_MAPS_LIBRARIES=places,geometry — libraries to load with Maps JS
- VITE_GOOGLE_MAP_ID — optional Cloud Map ID for vector basemap styling
- VITE_MAPTILER_KEY — optional satellite tiles fallback (already supported)

Key security:
- Restrict the key to your production and preview domains.
- Enable only the APIs listed below to reduce risk/cost.

Code cleanup to align with this plan:
- Replace any hardcoded Google keys in code (e.g., CityStreetView.jsx) with VITE_GOOGLE_MAPS_API_KEY.
- Load Maps JavaScript API with the libraries needed per feature (places, geometry).

## Phase 1 – Required APIs (MVP)

These deliver a playable world with navigation, POIs, and basic realism:

1) Maps JavaScript API (WebGL, vector basemap)
- Basemap rendering, camera, events, overlays
- Use WebGL OverlayView or a simple overlay to render the avatar/markers
- Configure with Map ID (optional) for custom styling

2) Map Tiles API (vector tiles)
- Ensures high-performance vector basemaps with the Maps JS API
- Keep for performance; remove if not needed later

3) Places API (New)
- Search and Details for POIs (names, types, opening hours, photos)
- Use “fields” parameter to request only needed attributes (billing control)

4) Geocoding API
- Convert user-entered text to coordinates (e.g., jump to a city/barangay)

5) Geolocation API
- Get approximate player location from IP/HTML5 (with permission)

6) Routes API (Directions + Distance Matrix)
- Pathfinding and travel times between points
- For simple directions: Directions; for multiple NPCs or comparisons: Distance Matrix

7) Roads API
- Snap avatar/NPC paths to real roads for realism

8) Elevation API
- Terrain-aware gameplay (hills, movement penalties/bonuses)

9) Time Zone API
- Display local time, time-based events per region

10) Street View Static API
- Quick thumbnails/preview of available street-level imagery
- Use Street View Service within Maps JS to open interactive panoramas when available

Notes
- Street View Publish API is ONLY required if we plan to upload our own imagery. Otherwise, don’t enable it.
- Maps Embed/Static APIs aren’t needed for the interactive canvas; keep Static only for simple thumbnails.

## Phase 2 – Optional Enhancements

- Air Quality API — dynamic status effects, visibility, or challenges
- Weather API — rain/typhoon modifiers, seasonal events, NPC schedules
- Solar API — energy/solar-mini-game features, day/night lighting tweaks
- Aerial View API — cinematic 3D flythroughs (coverage-dependent)
- Maps Datasets API — host custom region boundaries or gameplay zones
- Places Photos (via Places API) — richer POI visuals
- Places UI Kit — ready-made UI widgets (optional; we likely build custom UI)
- Places Aggregate API — analytics across POIs (usually not needed for gameplay)
- Route Optimization API — only if we add fleet/multi-stop logistics gameplay

## Mobile Native vs Web

- Web (current): Maps JavaScript API + the web services above.
- Native Android/iOS (later): Maps SDK for Android / iOS and Navigation SDK. Only enable these if/when we ship native apps.
- Maps 3D SDK for Android is native-only; not needed for web.

## Billing & Performance

- Always limit requested fields (Places Details), cache server-side where possible.
- Use Distance Matrix sparingly (batch requests, debounce UI actions).
- Snap-to-road only when the avatar is near roads; avoid frequent calls while idle.
- Consider prefetching POIs for the current viewport and cache in Supabase.

## Security & Governance

- Key restrictions: HTTP referrers (web), IPs (server), and API enablement.
- Rotate keys if exposure is suspected; never commit real keys to git.
- Track monthly quotas and set budget alerts in Google Cloud.

## Implementation Notes

- Replace Leaflet base layer with Google Maps JS for full API access and performance, or keep Leaflet solely for satellite fallback while we migrate.
- Render the avatar with WebGL OverlayView (or a lightweight overlay) synchronized to map camera.
- Use Street View Service to check pano availability before opening viewer; fallback to satellite.

## Next Steps (MVP Track)

1) Add env vars (VITE_GOOGLE_MAPS_API_KEY, VITE_GOOGLE_MAPS_LIBRARIES, VITE_GOOGLE_MAP_ID).
2) Swap the base map in the Play view to Google Maps JS.
3) Implement avatar overlay and camera follow.
4) Add Places search + minimal POI details (name, location, open_now, photo).
5) Integrate Routes API for simple directions; add Distance Matrix if needed.
6) Add Roads snap and Elevation rules for movement realism.
7) Add Street View preview and interactive viewer where available.

This plan keeps us focused on a realistic, performant MVP while leaving room for deeper simulation later.
