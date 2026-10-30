// Activity and biome are independent: the same forest may contain an arch or a chest.
export const BIOMES = Object.freeze({
  forest: {
    name: "Обычный лес",
    enemy: "wood",
    creature: "Корневик",
    color: 0x718b4b,
  },
  field: {
    name: "Заросшие поля",
    enemy: "doll",
    creature: "Соломенная кукла",
    color: 0xbba555,
  },
  swamp: {
    name: "Чужое болото",
    enemy: "cosmic",
    creature: "Болотная аномалия",
    color: 0x557f77,
  },
  shore: {
    name: "Тихие берега",
    enemy: "drowned",
    creature: "Утопленник",
    color: 0x9eaf82,
  },
  web: {
    name: "Паутинная чаща",
    enemy: "spider",
    creature: "Теневой паук",
    color: 0x685872,
  },
  ruins: {
    name: "Старые развалины",
    enemy: "masked",
    creature: "Безликий",
    color: 0x8e9584,
  },
});
const overrides = {
  "-1:0": "shore",
  "-2:0": "shore",
  "-2:1": "shore",
  "-1:1": "field",
  "-1:2": "field",
  "1:1": "field",
  "1:-2": "field",
  "0:1": "swamp",
  "0:2": "swamp",
  "2:0": "swamp",
  "2:-2": "web",
  "2:-1": "web",
  "2:1": "web",
  "2:2": "web",
};
export function biomeFor(id, activity) {
  return (
    overrides[id] ||
    (activity === "ruins" || activity === "arch" ? "ruins" : "forest")
  );
}
// Coherent global coordinates keep transitions identical across independently baked chunks.
export function transitionNoise(x, y) {
  return (
    Math.sin(x / 113) * 19 +
    Math.sin(y / 137) * 17 +
    Math.sin((x + y) / 71) * 11
  );
}
