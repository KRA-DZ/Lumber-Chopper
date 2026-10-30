// A scripted player uses real paths, automatic chopping, pickup and transfer timers.
// No teleporting, injected logs, money or damage; menu time is paused in the game.
export function playFirstDay(g) {
  const samples = {};
  function tickUntil(condition, seconds = 90) {
    for (let i = 0; i < seconds * 20 && !condition() && !g.state.gameOver; i++)
      g.update(0.05);
    if (!condition())
      throw new Error(
        `First-day route timed out at ${g.elapsed.toFixed(1)}s; guide=${g.guide.id}`,
      );
  }
  function travel(action) {
    if (!g.navigateGuide(action)) throw new Error(`Missing route: ${action}`);
    tickUntil(() => !g.player.path.length);
  }
  function gather() {
    while (g.state.wood < g.state.maxWood) {
      const before = g.state.wood;
      travel("trees");
      tickUntil(() => g.state.wood > before, 15);
    }
  }
  function sell() {
    travel("sell");
    tickUntil(() => g.state.wood === 0);
  }
  gather();
  sell();
  if (!g.purchaseUpgrade("carry"))
    throw new Error("First sale did not afford carry");
  samples.carrySeconds = g.elapsed;
  while (g.state.campLevel < 1) {
    gather();
    travel("build");
    tickUntil(() => g.state.wood === 0 || g.state.campLevel >= 1);
  }
  samples.fireSeconds = g.elapsed;
  while (g.state.coins < 75) {
    gather();
    sell();
  }
  if (!g.purchaseUpgrade("axe")) throw new Error("First axe not affordable");
  samples.axeSeconds = g.elapsed;
  travel("camp");
  samples.returnSeconds = g.elapsed;
  return samples;
}
