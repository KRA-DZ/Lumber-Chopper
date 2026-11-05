import { SHOP_IDS, upgradeOffer, buyUpgrade, AXE_TIERS } from "./economy.js";
import { affordableCombatUpgrades, COMBAT_LOOT } from "./game/combat-loot.js";

export function createShop(
  state,
  {
    onChange,
    onOpen,
    purchase = (id) => buyUpgrade(state, id),
    recommendation = () => null,
    iconFor = () => null,
    currencyIcon = null,
  },
) {
  const dialog = document.querySelector("#shopDialog"),
    balance = dialog.querySelector("[data-balance]"),
    items = dialog.querySelector("[data-items]"),
    message = dialog.querySelector("[data-message]");
  const lootInfo = document.createElement("p");
  const moneyIcon = currencyIcon ? document.createElement("img") : null;
  if (moneyIcon) {
    moneyIcon.src = currencyIcon;
    moneyIcon.alt = "";
    moneyIcon.width = moneyIcon.height = 24;
    moneyIcon.className = "loot-item-icon";
  }
  lootInfo.dataset.combatProgress = "";
  items.before(lootInfo);
  items.replaceChildren();
  const cards = new Map();
  for (const id of SHOP_IDS) {
    const card = document.createElement("article");
    card.className = "shop-item";
    const icon = document.createElement("span");
    icon.className = "shop-icon";
    icon.textContent = {
      carry: "▤",
      axe: "⚒",
      boots: "➟",
      pickup: "✦",
      lantern: "☼",
    }[id];
    icon.setAttribute("aria-hidden", "true");
    const info = document.createElement("div"),
      title = document.createElement("h3"),
      description = document.createElement("p"),
      detail = document.createElement("small"),
      button = document.createElement("button");
    button.type = "button";
    button.dataset.buy = id;
    info.append(title, description, detail);
    card.append(icon, info, button);
    items.append(card);
    button.addEventListener("click", () => {
      const offer = upgradeOffer(state, id);
      if (!purchase(id)) {
        refresh();
        return;
      }
      message.textContent = `Куплено: ${offer.name}.`;
      onChange(id);
      refresh();
    });
    cards.set(id, { card, title, description, detail, button, icon });
  }
  function refresh() {
    balance.textContent = `Монеты: ${state.coins}`;
    if (moneyIcon) balance.prepend(moneyIcon);
    const loot = state.combatLoot,
      affordable = affordableCombatUpgrades(state);
    lootInfo.hidden = !loot || !(loot.coinsCollected || loot.resinCollected);
    if (!lootInfo.hidden)
      lootInfo.textContent = `С врагов собрано: ${loot.coinsCollected} монет и ${loot.resinCollected} смолы. ${affordable.length ? `Сейчас доступны: ${affordable.map((o) => o.name).join(", ")}.` : "Копите на следующее улучшение."} Малые враги: до ${COMBAT_LOOT.minionDailyCoins} монет и ${COMBAT_LOOT.minionDailyResin} смолы в сутки. Смола нужна загадочному торговцу для лесной мази.`;
    const advice = recommendation();
    for (const [id, c] of cards) {
      const offer = upgradeOffer(state, id);
      c.card.dataset.recommended = String(advice?.id === id);
      c.title.textContent = offer.name;
      c.description.textContent = offer.description;
      c.icon.style.color = offer.color;
      const src = iconFor(id, offer);
      if (src && c.icon.dataset.src !== src) {
        const image = document.createElement("img");
        image.src = src;
        image.alt = "";
        image.width = image.height = 32;
        c.icon.replaceChildren(image);
        c.icon.dataset.src = src;
      }
      c.detail.textContent =
        id === "axe" && !offer.maxed
          ? `Урон ${state.axePower} → ${AXE_TIERS[offer.level + 1].power}; замах ${state.autoInterval.toFixed(2)} → ${AXE_TIERS[offer.level + 1].interval.toFixed(2)} с`
          : id === "carry"
            ? "Цена растёт на 55% за покупку"
            : `Уровень ${offer.level}`;
      if (advice?.id === id)
        c.detail.textContent = `Совет: ${advice.text}${offer.canBuy ? "" : ` Не хватает ${offer.price - state.coins} монет.`}`;
      c.button.textContent = offer.maxed ? "Куплено" : `${offer.price} монет`;
      c.button.disabled = !offer.canBuy;
      c.button.setAttribute(
        "aria-label",
        offer.maxed
          ? `${offer.name}: куплено`
          : `Купить ${offer.name} за ${offer.price} монет`,
      );
    }
  }
  function open() {
    onOpen();
    message.textContent = "";
    refresh();
    if (!dialog.open) dialog.showModal();
  }
  const close = () => dialog.close();
  dialog.querySelector("[data-close]").addEventListener("click", close);
  return {
    open,
    refresh,
    destroy() {
      lootInfo.remove();
      dialog.querySelector("[data-close]").removeEventListener("click", close);
      items.replaceChildren();
    },
    get isOpen() {
      return dialog.open;
    },
  };
}
