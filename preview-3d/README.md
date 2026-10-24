# Low-poly 3D world

Run `python -m http.server 8000` from the repository root and open `preview-3d/`. No build, CDN or installation is needed. Both versions remain available: `/` is the 2D game, `/preview-3d/` is the 3D game. Each page links to the other.

The 3D camera is orthographic, tilted about 48° above the ground (the original prototype was about 39°). It follows the player across a circular world with five accessible radii: 24, 29, 34, 39 and 44 world units. Camp construction costs 10/20/35/50 logs and adds a fire, tent, fence and hut. The gold pad sells wood; the turquoise pad builds. The giant tree is reserved for future workers. The mysterious merchant has no goods yet.

3D progress is stored under `lumber-chopper-3d-v1`. On the first visit only, coins, carried wood/value, backpack capacity and camp construction progress are copied from `lumber-chopper-v1` if present. The legacy record is never changed. Later sessions restore the independent 3D record, including position and damaged/cut 3D trees. The 3D map is newly generated; legacy tree IDs/positions are not imported. Switching versions does not continuously synchronize progress. Both versions must be served from the same origin for the one-time migration to find the old save. Storage denial is reported in the UI. Corrupt 3D records are backed up before replacement.

- `models.js`: meshes/materials and character parts.
- `scene.js`: deterministic landscape, lighting and camera.
- `camp-world.js`: camp stages, merchant, giant tree and collision footprints.
- `progress.js`: saved-state validation and one-time migration.
- `game.js`: movement, pathfinding, chopping, building, inventory and selling.
- `main.js`: input, page lifecycle and render loop.

Run persistence regression checks with `node --test preview-3d/progress.test.mjs`.

Three.js **0.180.0** is vendored with its MIT license. Rendering requires WebGL 2. DPR is capped at 1.5 and shadows use a single 1024² directional shadow map. Trees outside the current ring and beyond the local view distance are hidden. Test performance on target devices before production release.

This completes the first world/progression transfer. Buyer queues, animals, automatic day/night, ambient audio and forest discoveries remain in the 2D version and have not yet been ported. The moon button provides a manual lighting comparison.
