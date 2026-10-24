# Low-poly clearing — visual prototype

Open `preview-3d/` using the existing static HTTP server (`python -m http.server 8000` from the repository root). No build, CDN or installation is needed. The original game remains at `/`.

This is the first art-direction slice, rather than a replacement for the full 2D game. It includes an orthographic camera, handmade low-poly models, shadows, a pool and bridge, keyboard/touch navigation, harvesting, a swaying log tower and a selling pad. Currency, inventory and cut trees in this demonstration last only for the page session. Existing saved progress is never read or modified. Workers, monsters, camp upgrades, queues, sound and the full world have not been ported.

- `models.js`: meshes/materials and character parts.
- `scene.js`: landscape, lights, camera and renderer.
- `game.js`: movement, pathfinding, chopping, inventory and selling.
- `main.js`: input and render loop.

Three.js **0.180.0** is vendored in `vendor/` from the official npm package, including its MIT license. Rendering requires WebGL 2. DPR is capped at 1.5; shadows use one directional light with a 1024² shadow map. The moon button switches between daylight and dusk. Shadow quality, mesh count and camera framing can be adjusted after testing on target devices.
