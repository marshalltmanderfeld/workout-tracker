# Pixel Gym foundation

Open Pixel Gym in the training navigation to inspect a room or step through a completed session. The admin practice workspace passes its own temporary sessions to the same page.

The React page owns selection and controls. The Canvas 2D renderer takes a room and an actor position without fetching data or using React. A 640 × 640 backing surface draws 40 × 40 tiles at 16 pixels each. The room scales to the available space with pixelated sampling. Phaser's scene management, physics and asset pipeline may be useful for a larger game. The current single room needs explicit tile collisions and recorded movement rather than a physics simulation, so it uses the browser canvas with no added runtime dependency.

- **Equipment** defines the footprint, collision rectangles, optional sprite slot, generic exercise aliases, animation key and local approach and exercise positions. Both cable towers and all five stations belong to one crossover definition.
- **Layout** places named equipment types by instance ID and tile coordinates. Multiple benches reuse the same definition. Room selection is independent of the physical gym. Phase 1 supports the default orientation.
- **Rendering** paints the floor and walls, then equipment and the character in depth order. Inspection outlines the selected placement and shades collision regions.
- **Replay input** adapts the existing ordered exercises and completed sets. Load basis and uncertainty flags travel with each preview entry. A missing station uses an open-floor pose. Mapping never changes physical equipment identities, stored workouts or their analytics.

Phase 2 should store one versioned layout per authenticated user in a dedicated Supabase table with owner-only access and revision checks. The editor will validate bounds, occupied cells and reachable approach tiles before saving. Phase 3 adds movement through free tiles and animation states. Phase 4 adds a simulated playback clock, condensed timing, speed, scrubbing and looping. Keep simulated timestamps outside the workout schema.
