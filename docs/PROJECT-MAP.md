# Краткая карта проекта

Указатель для точечного чтения. Не требует открытия всех перечисленных файлов при каждой задаче. Рабочие правила — [AGENTS.md](../AGENTS.md).

## Вход и границы

- `phaser.html` → `phaser/main.js`: основная игра, BootScene, загрузка и выбор героя, конфигурация Phaser.
- `phaser/world-scene.js`: WorldScene, связывание модели с вводом и представлениями; `phaser/hud-scene.js` — HUD.
- `game/simulation.js`: `createSimulation()`, игровые команды и координация независимых систем. Начальное состояние/баланс — `game/config.js`.
- `index.html`: старая Canvas-версия для сравнения. Код в корне частично общий, поэтому перед правкой проверять импорты нужного модуля.

## Где искать изменение

| Задача | Модель / данные | Представление / интеграция |
| --- | --- | --- |
| Ходьба, столкновения, команды | `game/navigation.js`, `game/simulation.js` | `phaser/world-scene.js`, `phaser/hero-view.js` |
| Рубка, брёвна, стопка, покупки | `forestry.js`, `economy.js`, `game/stack-layout.js`, `game/buyers.js` | `phaser/stack-view.js`, `phaser/chopping-feedback.js`, `phaser/buyer-view.js`, `shop.js` |
| Сутки, Смотритель, региональные враги | `game/cycle.js`, `game/survival.js`, `game/watcher.js`, `game/biome-enemies.js`, `game/minions.js`, `game/raiders.js` | `phaser/enemy-view.js`, `phaser/watcher-hud.js`, `phaser/night-lighting.js`, `phaser/atmosphere.js` |
| Лагерь, ограда, ремонт | `construction.js`, `game/defenses.js`, `game/defense-repair.js` | `phaser/construction-view.js`, `phaser/camp-view.js`, `phaser/defense-view.js`, `phaser/defense-ui.js`, `phaser/repair-control.js` |
| Итоги налёта | `game/raid-report.js`, `state.lastRaidReport` | `phaser/raid-summary.js`, меню обороны и дневник |
| Регионы и биомы | `game/regions.js`, `game/region-world.js`, `game/biomes.js` | `phaser/region-view.js`, `phaser/region-map.js`, `phaser/terrain-layer.js` |
| Крепость, лесопилка, находки | `game/locations.js`, `game/exploration.js`, `game/clearing.js` | `phaser/location-view.js`, `phaser/exploration-view.js`, `phaser/clearing-view.js` |
| Сюжет и дневник | `game/story.js`, `game/lore.js`, `game/discovery-dialogue.js` | `phaser/story-journal.js`, `phaser/exploration-ui.js` |
| Работники | `game/workers.js` | `phaser/worker-view.js`, `phaser/worker-ui.js` |
| PNG, кадры, звук | `src/assets/`, `scripts/prepare_*.py` — только по задаче | `phaser/*-assets.js`, `phaser/atlas.js`, `phaser/forest-audio.js` |

Подробные правила систем: [REGIONAL-HUNT.md](REGIONAL-HUNT.md), [WATCHER.md](WATCHER.md), [REGIONS.md](REGIONS.md), [DEFENSE.md](DEFENSE.md), [STORY.md](STORY.md). Читать нужный документ, а не весь набор.

## Команды по необходимости

- `npm run serve`, затем `http://localhost:8000/phaser.html` — локальный запуск. Открывать через HTTP, не `file://`.
- `npm run build` — автономная статическая сборка в игнорируемой папке `dist/`; Phaser включён локально.
- `node --test tests/watcher.test.mjs tests/night_horror.test.mjs tests/minions.test.mjs` — ночная опасность и малые враги.
- `node --test tests/defense-preparation.test.mjs tests/defenses.test.mjs tests/first_days.test.mjs` — удержание ремонта, предупреждения и отчёт; UI — `python tests/defense_preparation_smoke.py`.
- `node --test tests/economy_logic.test.mjs tests/simulation.test.mjs` — экономика и команды симуляции.
- `node --test tests/regions.test.mjs tests/biomes.test.mjs` — регионы и биомы.
- `node --test tests/story.test.mjs tests/discovery-dialogue.test.mjs` — сюжет и разговоры о находках.
- Браузерные сценарии — соответствующие `tests/*_smoke.py`; нужны Python Playwright и Chromium. `tests/watcher_smoke.py --scale-only` проверяет только масштаб и подписи врагов.
- `npm test` запускает все Node-тесты: применять для широких изменений или обоснованной регрессии, а не автоматически после каждой правки.
- `git diff --check` — проверка патча перед коммитом. Итоговый отчёт называет только действительно выполненные проверки.
