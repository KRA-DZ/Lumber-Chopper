# Low-poly 3D world

Run `python -m http.server 8000` from the repository root and open `preview-3d/`. No build, CDN or installation is needed. Both versions remain available: `/` is the 2D game, `/preview-3d/` is the 3D game. Each page links to the other.

The 3D camera is orthographic, tilted about 48° above the ground (the original prototype was about 39°). Its heading is fixed: a 3.5-unit dead zone keeps the camp view stationary for short movements, and only translation follows the player across a circular world with five accessible radii: 24, 29, 34, 39 and 44 world units. Camp construction costs 10/20/35/50 logs and adds a fire, tent, fence and hut. The gold pad sells wood to the current waiting customer; the turquoise pad builds. The giant tree is reserved for future workers. The mysterious merchant has no goods yet.

3D progress is stored under `lumber-chopper-3d-v1`. On the first visit only, coins, carried wood/value, backpack capacity and camp construction progress are copied from `lumber-chopper-v1` if present. The legacy record is never changed. Later sessions restore the independent 3D record, including position and damaged/cut 3D trees. The 3D map is newly generated; legacy tree IDs/positions are not imported. Switching versions does not continuously synchronize progress. Both versions must be served from the same origin for the one-time migration to find the old save. Storage denial is reported in the UI. Corrupt 3D records are backed up before replacement.

- `models.js`: meshes/materials and character parts.
- `scene.js`: deterministic landscape, lighting and camera.
- `camp-world.js`: camp stages, merchant, giant tree and collision footprints.
- `trade.js`: buyer queue, carts, waiting and departure.
- `time.js`: 20-minute clock and shop hours.
- `progress.js`: saved-state validation and one-time migration.
- `game.js`: movement, pathfinding, chopping, building, inventory and selling.
- `main.js`: input, page lifecycle and render loop.

Run persistence regression checks with `node --test preview-3d/progress.test.mjs preview-3d/trade.test.mjs`.

Three.js **0.180.0** is vendored with its MIT license. Rendering requires WebGL 2. DPR is capped at 1.5 and shadows use a single 1024² directional shadow map. Trees outside the current ring and beyond the local view distance are hidden. Test performance on target devices before production release.

Automatic days last 20 minutes. Trading is open 07:26–18:00. Up to five buyers queue, arrive 55 seconds apart, and wait at least 90 seconds before leaving with 40 logs. All remaining buyers leave in the evening. Cart loads are visualized, while sale prices still reflect carried wood value. Night trading is disabled. Clock time is saved; transient queue positions are reconstructed on a new visit. The moon button jumps between daytime and midnight.

The forest is selectively thinned to 156 active trees (the underlying deterministic tree IDs, including previously damaged/felled ones, are preserved). Tree visuals are 1.85× taller and 1.35× wider without increasing trunk collision radii. Stumps, leaves and stones are passable. Foreground foliage that covers the hero fades and lets pointer input through. Player/NPC scale is 1.75 rather than 1.35; faces blink, smile, look focused and react to a full backpack.

Animals, ambient audio and forest discoveries remain in the 2D version and have not yet been ported.
