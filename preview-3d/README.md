# Low-poly 3D world

Run `python -m http.server 8000` from the repository root and open `preview-3d/`. No build, CDN or installation is needed. Both versions remain available: `/` is the 2D game, `/preview-3d/` is the 3D game. Each page links to the other.

The 3D camera is orthographic, about 50° above the ground, facing the camp entrances directly along +Z with no diagonal azimuth. Its default view height is 19 rather than 25 world units (about 32% larger on-screen); zoom ranges from 14 to 36. Portrait view height is multiplied by 1.18 to leave walking room. A 3.5-unit dead zone keeps the camp view stationary for short movements, and only translation follows the player. The focus is three units ahead of the hero so the camp is visible above them. The circular world has five accessible radii: 24, 29, 34, 39 and 44 world units. Camp construction costs 10/20/35/50 logs and adds a fire, tent, fence and hut. The gold pad sells wood to the current waiting customer; the turquoise pad builds. The giant tree is reserved for future workers. The mysterious merchant has no goods yet.

Camp buildings are also larger independently of zoom: the tent is scaled 1.2×, hut 1.12×, fire 1.15× and wood stall 1.18×. The merchant tent is 1.12× rather than 0.8×, and sits on its own clearing at (9.5, 0.5). Rounded building footprints follow their larger sizes, while the entrance and both pads remain accessible. Small crates, benches, logs, mushrooms and ferns are passable; the ruin's two substantial pillars are solid, with an open passage between them.

3D progress is stored under `lumber-chopper-3d-v1`. On the first visit only, coins, carried wood/value, backpack capacity and camp construction progress are copied from `lumber-chopper-v1` if present. The legacy record is never changed. Later sessions restore the independent 3D record, including position and damaged/cut 3D trees. The 3D map is newly generated; legacy tree IDs/positions are not imported. Switching versions does not continuously synchronize progress. Both versions must be served from the same origin for the one-time migration to find the old save. Storage denial is reported in the UI. Corrupt 3D records are backed up before replacement.

- `models.js`: meshes/materials and character parts.
- `scene.js`: deterministic landscape, lighting and camera.
- `camp-world.js`: camp stages, merchant, giant tree and collision footprints.
- `camp-life.js`: stage-dependent camp props, cloth movement, smoke, sparks and window glow.
- `scenery.js`: instanced ground cover, trails, ferns, mushrooms, fallen logs, ruined arch and night fireflies.
- `wood-effects.js`: temporary falling-tree copies, bounded debris, flying pickup logs and damage/resource labels. Effects do not award resources or alter saved HP.
- `trade.js`: buyer queue, carts, waiting and departure.
- `time.js`: 20-minute clock and shop hours.
- `progress.js`: saved-state validation and one-time migration.
- `game.js`: movement, pathfinding, chopping, building, inventory and selling.
- `main.js`: input, page lifecycle and render loop.

Run regression checks with `node --test preview-3d/*.test.mjs` (persistence, buyer schedule and effect cleanup/shared geometry). In a browser, verify WASD/tap movement, harvesting and reloading during a falling-tree animation, all four construction stages and their entrance routes, and desktop/portrait zoom. Both version-switch links remain available.

Three.js **0.180.0** is vendored with its MIT license. Rendering requires WebGL 2. DPR is capped at 1.5 and shadows use a single 1024² directional shadow map. Trees outside the current ring and beyond the local view distance are hidden. Test performance on target devices before production release.

Automatic days last 20 minutes. Trading is open 07:26–18:00. Up to five buyers queue, arrive 55 seconds apart, and wait at least 90 seconds before leaving with 40 logs. All remaining buyers leave in the evening. Cart loads are visualized, while sale prices still reflect carried wood value. Night trading is disabled. Clock time is saved; transient queue positions are reconstructed on a new visit. The moon button jumps between daytime and midnight.

The forest is selectively thinned to roughly 150 active trees, with clearings around the merchant and ruined arch (the underlying deterministic tree IDs, including previously damaged/felled ones, are preserved). Tree visuals are 1.85× taller and 1.35× wider without increasing trunk collision radii. Stumps, leaves and stones are passable. Foreground foliage that covers the hero fades and lets pointer input through. Player/NPC scale is 1.75 rather than 1.35. The hero leans under a heavy load, celebrates sales/construction and rests near the fire after standing idle. Buyers look around, wave to the hero/each other, and occasionally yawn. Faces blink and reflect these moods.

Each strike produces chips and a damage label. A felled tree falls away from the hero and fades while a log hops into the swaying stack. The wood and stump are committed immediately, so reloading during the animation neither loses nor duplicates wood. Debris and falling copies are capped and temporary geometry/materials are cleaned up; original shared tree geometry stays alive. Static foliage uses instanced batches. The ruined arch glows faintly and fireflies appear near it and the pond at night; these are atmospheric hints without monsters or rewards.

Animals and ambient audio remain in the 2D version and have not yet been ported.
