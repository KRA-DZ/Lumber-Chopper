// Two personal accounts share only world progress. Inventory and equipment stay private.
const WORLD_KEYS = new Set([
  "campHealth", "maxCampHealth", "defenseHP", "defenseWood", "raidsWon", "lastRaidReport",
  "gameOver", "defeatReason", "nightsSurvived", "calendarDay", "campLevel", "buildWood",
  "worldTime", "workforce", "readClues", "unlockedLetters", "claimedQuests", "story",
  "unlockedRegions", "regionWood",
  "campFuel", "logStore", "regionStone", "gateOpen", "boulderHP",
  "campBuildings", "buildProject", "buildBlockedPlayers",
  "campIndustry", "buyerOrders", "campMilestones", "worldWorks",
]);
const EXPLORATION_KEYS = new Set([
  "openedChests", "openedPassages", "discoveries", "discussedFinds", "debrisHP", "outpostFuel",
]);
function overlay(personal, shared, keys) {
  return new Proxy(personal, {
    get: (own, key) => keys.has(key) ? shared[key] : own[key],
    set(own, key, value) { (keys.has(key) ? shared : own)[key] = value; return true; },
  });
}
export function shareWorldState(personal, shared) {
  personal.exploration = overlay(personal.exploration, shared.exploration, EXPLORATION_KEYS);
  personal.combatLoot = overlay(personal.combatLoot, shared.combatLoot, new Set(["smallCoins", "smallResin"]));
  return overlay(personal, shared, WORLD_KEYS);
}
