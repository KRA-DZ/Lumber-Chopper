import { applyUpgrades } from "../economy.js";
import { STAGE_COSTS } from "../construction.js";
export const DAY_SECONDS = 600;
export const RAID_INTERVAL = 5; // Общий интервал налётов для календаря, директора и интерфейса.
export const WORLD = Object.freeze({ width: 3200, height: 3200 });
export const CENTER = Object.freeze({ x: 1600, y: 1600 });
export const RADII = Object.freeze([900, 1040, 1180, 1320, 1450]);
export const STAGES = Object.freeze(
  ["Костёр", "Палатка", "Забор", "Хижина"].map((name, i) => ({
    name,
    cost: STAGE_COSTS[i],
  })),
);
export function createInitialState() {
  const state = {
    health: 100, // Три ошибки рядом со Смотрителем смертельны; рассвет восстанавливает здоровье.
    maxHealth: 100,
    campHealth: 200, // Налётчики повреждают лагерь; одно бревно на стройке чинит 20 HP.
    maxCampHealth: 200,
    defenseHP: {}, // HP секций: забор 60, баррикада 60; одно бревно чинит 20 HP.
    defenseWood: {}, // Вложения в фиксированные места: баррикада 3 бревна, одноразовая ловушка 2.
    raidsWon: 0, // Только полностью уничтоженные волны; награда начисляется один раз.
    gameOver: false,
    defeatReason: "",
    nightsSurvived: 0, // Увеличивается только на рассвете после прожитой ночи.
    calendarDay: 0,
    readClues: [],
    unlockedLetters: [],
    claimedQuests: [],
    wood: 0,
    maxWood: 2, // На старте две руки; сила переноски добавляет по два бревна.
    coins: 0,
    axePower: 1, // Урон одного автоматического или активного удара.
    autoInterval: 0.85, // Задержка автоматической рубки.
    clickInterval: 0.18, // Ограничение частоты активных ударов.
    carryLevel: 0, // До 40 улучшений: цена 20 × 1.55^уровень, вместимость 2 + 2×уровень.
    axeLevel: 0, // Редкость меняет цвет, урон и интервал взмаха топора.
    bootsLevel: 0, // +8% скорости за уровень, до пяти покупок.
    pickupLevel: 0, // +12 к радиусу подбора за уровень, до пяти покупок.
    lanternLevel: 0, // +24 к ночному радиусу света за уровень, до четырёх покупок.
    pickupRadius: 68,
    runSpeed: 200,
    campLevel: 0, // Построенные этапы лагеря: костёр, палатка, забор, хижина.
    buildWood: 0, // Уже вложенные брёвна в текущий этап (не монеты).
    worldTime: 120, // Начинаем в 10:48; цикл — 600 с, цены и интервалы торговли прежние.
    cargoValue: 0, // Сумма цен переносимых брёвен; добыча возвращается после роста дерева.
    cargo: [], // Цена каждого переносимого бревна: продажа снимает верхнее без округлений.
  };
  applyUpgrades(state);
  return state;
}
