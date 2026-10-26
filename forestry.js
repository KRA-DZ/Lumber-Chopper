export const growthStage = (tree, day) =>
  tree.hp > 0
    ? 3
    : tree.cutDay == null
      ? 0
      : Math.min(3, Math.max(0, day - tree.cutDay));
export const treeYield = (tree) => (tree.size === 2 ? 3 : 2);

// Один числовой запас на место рубки, а не новый физический объект на каждое бревно.
// Поваленное дерево не исчезает из экономики: остаток ждёт на земле до подбора.
export function createForestry(state, { onPickup = () => {} } = {}) {
  const piles = new Map();
  let pickupTimer = 0,
    lastDay = -1;
  function addCargo(value) {
    if (state.cargo.length >= state.maxWood) return false;
    state.cargo.push(value);
    state.wood = state.cargo.length;
    state.cargoValue += value;
    return true;
  }
  function takeCargo() {
    if (!state.cargo.length) return null;
    const value = state.cargo.pop();
    state.wood = state.cargo.length;
    state.cargoValue -= value;
    return value;
  }
  function fell(tree, day) {
    if (tree.workerOnly || tree.hp > 0 || tree.cutDay != null) return 0;
    tree.cutDay = day;
    const count = treeYield(tree),
      prior = piles.get(tree.id);
    if (prior) prior.count += count;
    else
      piles.set(tree.id, {
        id: tree.id,
        x: tree.x,
        y: tree.y + 22,
        count,
        value: tree.value,
      });
    return count;
  }
  function collect(dt, player) {
    if (dt <= 0) return false;
    pickupTimer = Math.max(0, pickupTimer - dt);
    if (pickupTimer > 0 || state.wood >= state.maxWood) return false;
    let nearest = null,
      distance = state.pickupRadius;
    for (const pile of piles.values()) {
      const d = Math.hypot(pile.x - player.x, pile.y - player.y);
      if (d <= distance) {
        nearest = pile;
        distance = d;
      }
    }
    if (!nearest || !addCargo(nearest.value)) return false;
    nearest.count--;
    onPickup(nearest, state.wood - 1);
    pickupTimer = 0.14;
    if (nearest.count === 0) piles.delete(nearest.id);
    return true;
  }
  function updateGrowth(trees, day) {
    if (day === lastDay) return false;
    lastDay = day;
    let changed = false;
    for (const tree of trees)
      if (
        !tree.workerOnly &&
        tree.hp <= 0 &&
        tree.cutDay != null &&
        growthStage(tree, day) === 3
      ) {
        tree.hp = tree.maxHp;
        tree.cutDay = null;
        tree.shake = 0;
        changed = true;
      }
    return changed;
  }
  return { piles, addCargo, takeCargo, fell, collect, updateGrowth };
}
