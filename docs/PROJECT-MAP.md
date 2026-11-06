# Краткая карта проекта

Указатель для точечного чтения. Не требует открытия всех перечисленных файлов при каждой задаче. Рабочие правила — [AGENTS.md](../AGENTS.md).

## Вход и границы

- `index.html` → `phaser/main.js`: единственная игра, BootScene, загрузка PNG и выбор героя, конфигурация Phaser. `phaser.html` перенаправляет сюда с сохранением параметров/якоря.
- `phaser/world-scene.js`: WorldScene, связывание модели с вводом и представлениями; `phaser/hud-scene.js` — HUD.
- `game/simulation.js`: `createSimulation()`, игровые команды и координация независимых систем. Начальное состояние/баланс — `game/config.js`.
- Локальная игра вдвоём: `game/local-coop.js` координирует две личные симуляции с общим мировым тактом; `game/coop-state.js` задаёт общие поля, `game/local-party.js` — цели врагов и личный урон. Камеры и панели — `phaser/coop-camera.js`, `phaser/coop-views.js`. [Управление и проверки](LOCAL-COOP.md).
- Топливо, склад и комната дома — `game/camp-services.js`; камень — `game/mining.js`. Ближайшие взаимодействия, клавиатура меню и личные лавки — `phaser/keyboard-interactions.js`; комната и добываемые валуны — `phaser/camp-services-view.js`. [Баланс и проверки обновления](CAMP-PROGRESSION.md).
- Старая Canvas-игра и режим сравнения графики удалены. Корневые модули экономики, рубки, геометрии и генерации растров используются Phaser; перед очисткой проверять граф импортов.

## Где искать изменение

| Задача | Модель / данные | Представление / интеграция |
| --- | --- | --- |
| Ходьба, столкновения, команды | `game/navigation.js`, `game/simulation.js` | `phaser/world-scene.js`, `phaser/hero-view.js` |
| Герой за кронами, приоритеты подписей | Геометрия/лимиты: `phaser/tree-occlusion.js`, `phaser/world-hints.js` | `phaser/atlas.js`, `phaser/world-scene.js`; [WORLD-READABILITY.md](WORLD-READABILITY.md) |
| Рубка, брёвна, стопка, покупки | `forestry.js`, `economy.js`, `game/stack-layout.js`, `game/buyers.js` | `phaser/stack-view.js`, `phaser/chopping-feedback.js`, `phaser/buyer-view.js`, `shop.js` |
| Сутки, Смотритель, региональные враги | `game/cycle.js`, `game/survival.js`, `game/watcher.js`, `game/biome-enemies.js`, `game/minions.js`, `game/raiders.js` | `phaser/enemy-view.js`, `phaser/watcher-hud.js`, `phaser/night-lighting.js`, `phaser/atmosphere.js` |
| Лагерь, ограда, ремонт | `construction.js`, `game/defenses.js`, `game/defense-repair.js` | `phaser/construction-view.js`, `phaser/camp-view.js`, `phaser/defense-view.js`, `phaser/defense-ui.js`, `phaser/repair-control.js` |
| Итоги налёта | `game/raid-report.js`, `state.lastRaidReport` | `phaser/raid-summary.js`, меню обороны и дневник |
| Добыча с врагов и доступные покупки | `game/combat-loot.js`, `state.combatLoot` | `phaser/combat-loot-view.js`, `shop.js` |
| PNG предметов добычи/находок | `scripts/prepare_loot_items.py`, `src/assets/loot-items/` | `phaser/loot-item-assets.js`, `phaser/exploration-ui.js`, `phaser/exploration-view.js`; [LOOT-ITEM-ART.md](LOOT-ITEM-ART.md) |
| Пауза, настройки и справка | Прежняя система причин паузы сцены | `phaser/game-menu.js`, `index.html`; [GAME-MENU.md](GAME-MENU.md) |
| Регионы и биомы | `game/regions.js`, `game/region-world.js`, `game/biomes.js`, `game/region-trails.js`, `game/biome-terrain.js`, `game/biome-dressing.js` | `phaser/region-view.js`, `phaser/region-map.js`, `phaser/terrain-layer.js`; [FOREST-SWAMP.md](FOREST-SWAMP.md) |
| Крепость, лесопилка, находки | `game/locations.js`, `game/exploration.js`, `game/clearing.js` | `phaser/location-view.js`, `phaser/exploration-view.js`, `phaser/clearing-view.js` |
| Перевалочный костёр крепости | `game/outposts.js`, `state.exploration.outpostFuel`; действия — `game/exploration.js` | `phaser/outpost-view.js`, `phaser/location-view.js`, `phaser/night-lighting.js`; [OUTPOSTS.md](OUTPOSTS.md) |
| Сюжет и дневник | `game/story.js`, `game/lore.js`, `game/discovery-dialogue.js` | `phaser/story-journal.js`, `phaser/exploration-ui.js` |
| Работники | `game/workers.js` | `phaser/worker-view.js`, `phaser/worker-ui.js` |
| PNG, кадры, звук | `src/assets/`, `scripts/prepare_*.py` — только по задаче; выбор фоновых сигналов — `game/biome-soundscape.js` | `phaser/*-assets.js`, `phaser/atlas.js`, `phaser/forest-audio.js` |

Подробные правила систем: [REGIONAL-HUNT.md](REGIONAL-HUNT.md), [WATCHER.md](WATCHER.md), [REGIONS.md](REGIONS.md), [DEFENSE.md](DEFENSE.md), [STORY.md](STORY.md). Читать нужный документ, а не весь набор.

## Команды по необходимости

- `npm run serve`, затем `http://localhost:8000/` — локальный запуск. Открывать через HTTP, не `file://`.
- `npm run build` — автономная статическая сборка в игнорируемой папке `dist/`; Phaser включён локально.
- `node --test tests/camp-expansion.test.mjs` и `python tests/camp_expansion_smoke.py` — оплата регионов двумя материалами, топливо, склад, калитки, независимые лавки, E/Enter, комната дома, мышь/тач и перезапуск.
- `node --test tests/local-coop.test.mjs` и `python tests/local_coop_smoke.py` — личные счета и общий мир, два комплекта ввода, разделение/слияние камер, фонари, спасение, перезапуск и ограниченный совмещённый замер нагрузки.
- `node --test tests/watcher.test.mjs tests/night_horror.test.mjs tests/minions.test.mjs` — ночная опасность и малые враги.
- `node --test tests/defense-preparation.test.mjs tests/defenses.test.mjs tests/first_days.test.mjs` — удержание ремонта, предупреждения и отчёт; UI — `python tests/defense_preparation_smoke.py`.
- `node --test tests/economy_logic.test.mjs tests/simulation.test.mjs` — экономика и команды симуляции.
- `node --test tests/combat-loot.test.mjs tests/runtime-entry.test.mjs` — добыча, ранний цикл и единственный вход; UI/старая ссылка — `python tests/combat_loot_smoke.py`. Баланс: [COMBAT-LOOT.md](COMBAT-LOOT.md).
- `node --test tests/regions.test.mjs tests/biomes.test.mjs` — регионы и биомы.
- `node --test tests/biome-atmosphere.test.mjs` и `python tests/biome_atmosphere_smoke.py` — проходы леса/болота, детерминированный декор, стык грунта, PNG, стереозвук/пауза и ограниченные кеши.
- `node --test tests/story.test.mjs tests/discovery-dialogue.test.mjs` — сюжет и разговоры о находках.
- `node --test tests/outposts.test.mjs` и `python tests/outpost_smoke.py` — розжиг/подброс/готовка, топливо/пауза, временная защита от Смотрителя и угроза пятой ночи, свет/ввод/перезапуск.
- Браузерные сценарии — соответствующие `tests/*_smoke.py`; нужны Python Playwright и Chromium. `tests/watcher_smoke.py --scale-only` проверяет только масштаб и подписи врагов.
- `python tests/game_menu_smoke.py` — компактные действия, ручная пауза/звук/настройки, соседние диалоги, перезапуск и портретные экраны. Для настроек в прежних сценариях использовать `click_setting()` из `tests/helpers/browser_start.py`.
- `python tests/loot_item_assets_test.py` — alpha/размеры новых предметов; `python tests/loot_item_art_smoke.py` — PNG, свет/маркеры, эффекты, сумка, торговля и снасти. `--mobile-only` повторяет только мобильную часть.
- `node --test tests/world-readability.test.mjs` и `python tests/world_readability_smoke.py` — кроны/основания, ввод, восстановление и приоритеты подписей. `python tests/phaser_performance.py --combined-only` — только дождь + ночь + 82 бревна + налёт, полные/лёгкие эффекты.
- `npm test` запускает все Node-тесты: применять для широких изменений или обоснованной регрессии, а не автоматически после каждой правки.
- `git diff --check` — проверка патча перед коммитом. Итоговый отчёт называет только действительно выполненные проверки.
