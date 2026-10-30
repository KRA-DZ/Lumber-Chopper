// Visual choices only. Prices, speed, damage and capacity never depend on an outfit.
export const HERO_APPEARANCES = Object.freeze({
  traveler: { role: "hero2", name: "Путешественник", variant: 2 },
  woodcutter: { role: "hero3", name: "Лесорубка", variant: 3 },
});
export const normalizeAppearance = (id) =>
  typeof id === "string" && Object.hasOwn(HERO_APPEARANCES, id)
    ? id
    : "traveler";
export const workerAppearance = (id) => (id % 2 === 0 ? "worker3" : "worker4");
// Four looks occur in the first four visits; their transport alternates over later visits.
export const buyerAppearance = (id) =>
  `buyer${((id + Math.floor(id / 4)) % 4) + 1}`;
