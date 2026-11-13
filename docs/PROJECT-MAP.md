# Краткая карта проекта

Указатель для точечного чтения. Не требует открытия всех перечисленных файлов при каждой задаче. Рабочие правила — [AGENTS.md](../AGENTS.md).

## Вход и границы

- `index.html` → `phaser/main.js`: единственная игра, BootScene, загрузка PNG и выбор героя, конфигурация Phaser. `phaser.html` перенаправляет сюда с сохранением параметров/якоря.
- Цвета героев: `game/hero-colors.js` — палитры и нормализация; `state.heroColors` личный. `phaser/hero-customizer.js` — стартовые панели, `phaser/hero-color-art.js` — общая отрисовка, `phaser/people-assets.js` — выбранные кадры в атласе. Маски — `scripts/prepare_hero_masks.py`; [HERO-COLORS.md](HERO-COLORS.md).
- Полнооконный вид: `phaser/viewport.js` — логическое разрешение/лимиты и раскрытие действий, `phaser/viewport.css` — DOM-панель, `phaser/hud-scene.js` — отступ подсказок над панелью; [VIEWPORT.md](VIEWPORT.md). Проверки: `tests/viewport.test.mjs`, `tests/viewport_smoke.py`.
- Земля №4: `scripts/prepare_ground.py` → восемь PNG `src/assets/biomes/`; края тропинок — `phaser/art/ground-art.js`, биомы — `game/biome-terrain.js`. Источник и проверки: [TERRAIN-STYLE4.md](TERRAIN-STYLE4.md).
- `phaser/world-scene.js`: WorldScene, связывание модели с вводом и представлениями; `phaser/hud-scene.js` — HUD.
- `game/simulation.js`: `createSimulation()`, игровые команды и координация независимых систем. Начальное состояние/баланс — `game/config.js`.
- Локальная игра вдвоём: `game/local-coop.js` координирует две личные симуляции с общим мировым тактом; `game/coop-state.js` задаёт общие поля, `game/local-party.js` — цели врагов и личный урон. Камеры и панели — `phaser/coop-camera.js`, `phaser/coop-views.js`. [Управление и проверки](LOCAL-COOP.md).
- Топливо, склад и комната дома — `game/camp-services.js`; камень — `game/mining.js`. Ближайшие взаимодействия, клавиатура меню и личные лавки — `phaser/keyboard-interactions.js`; комната и добываемые валуны — `phaser/camp-services-view.js`. [Баланс и проверки обновления](CAMP-PROGRESSION.md).
- Свободный выбор построек, оплата после повторного входа, независимые эффекты — `game/camp-projects.js`; меню проектов — `phaser/build-ui.js`, общая верхняя шкала топлива — `phaser/day-hud.js`. `campLevel` означает число построек, а не их последовательность.
- Старая Canvas-игра и режим сравнения графики удалены. Корневые модули экономики, рубки, геометрии и генерации растров используются Phaser; перед очисткой проверять граф импортов.

## Где искать изменение

| Задача | Модель / данные | Представление / интеграция |
| --- | --- | --- |
| Ходьба, столкновения, команды | `game/navigation.js`, `game/simulation.js` | `phaser/world-scene.js`, `phaser/hero-view.js` |
| Герой за кронами, приоритеты подписей | Геометрия/лимиты: `phaser/tree-occlusion.js`, `phaser/world-hints.js` | `phaser/atlas.js`, `phaser/world-scene.js`; [WORLD-READABILITY.md](WORLD-READABILITY.md) |
| Рубка, брёвна, стопка, покупки | `forestry.js`, `economy.js`, `game/stack-layout.js`, `game/buyers.js` | `phaser/stack-view.js`, `phaser/chopping-feedback.js`, `phaser/buyer-view.js`, `shop.js` |
| Сутки, Смотритель, региональные враги | `game/cycle.js`, `game/survival.js`, `game/watcher.js`, `game/biome-enemies.js`, `game/minions.js`, `game/raiders.js` | `phaser/enemy-view.js`, `phaser/watcher-hud.js`, `phaser/night-lighting.js`, `phaser/atmosphere.js` |
| Лагерь, ограда, ремонт | `construction.js`, `game/defenses.js`, `game/defense-repair.js` | `phaser/construction-view.js`, `phaser/camp-view.js`, `phaser/defense-view.js`, `phaser/defense-ui.js`, `phaser/repair-control.js` |
| Переработка, усиления, башни и фонари | `game/camp-industry-config.js` — баланс; `game/camp-industry.js` — общий запас/очередь/усиления; `game/camp-preparation.js` — ремнаборы, свет, стрельба | `phaser/camp-desk.js`, `phaser/camp-industry-view.js`; [CAMP-ECONOMY.md](CAMP-ECONOMY.md) |
| Ежедневные заказы покупателей | `game/buyer-orders.js`, общая `state.buyerOrders`; сдача на платформе — `game/simulation.js` | Вкладка заказов `phaser/camp-desk.js`, подпись у продажи и HUD |
| Итоги налёта | `game/raid-report.js`, `state.lastRaidReport` | `phaser/raid-summary.js`, меню обороны и дневник |
| Первые цели и готовность лагеря | `game/camp-milestones.js`, `game/raid-readiness.js`, `game/first-days.js` | `phaser/camp-progress-ui.js`, `phaser/day-hud.js`, J/B и хозяйство; [CAMP-LOOP.md](CAMP-LOOP.md) |
| Составы налётов и метатели | `game/raid-plans.js`, `game/raid-projectiles.js`, `game/raiders.js`, `game/survival.js` | `phaser/enemy-view.js`, прогноз в HUD/B/J, итоговый отчёт |
| Добыча с врагов и доступные покупки | `game/combat-loot.js`, `state.combatLoot` | `phaser/combat-loot-view.js`, `shop.js` |
| PNG предметов добычи/находок | `scripts/prepare_loot_items.py`, `src/assets/loot-items/` | `phaser/loot-item-assets.js`, `phaser/exploration-ui.js`, `phaser/exploration-view.js`; [LOOT-ITEM-ART.md](LOOT-ITEM-ART.md) |
| Пауза, настройки и справка | Прежняя система причин паузы сцены | `phaser/game-menu.js`, `index.html`; [GAME-MENU.md](GAME-MENU.md) |
| Регионы и биомы | `game/regions.js`, `game/region-world.js`, `game/biomes.js`, `game/region-trails.js`, `game/biome-terrain.js`, `game/biome-dressing.js` | `phaser/region-view.js`, `phaser/region-map.js`, `phaser/terrain-layer.js`; [FOREST-SWAMP.md](FOREST-SWAMP.md) |
| Рощи, поляны и подходы | `game/forest-composition.js`, применяется после исходного создания ресурсов в `game/region-world.js`; `forestLayouts` — только сгенерированные регионы | Ширина ответвлений — `phaser/art/ground-art.js`, локальное обновление земли — `phaser/terrain-layer.js`; [FOREST-COMPOSITION.md](FOREST-COMPOSITION.md) |
| Плотина, вода, мосты и ворота | `game/world-works-layout.js` — геометрия/цены; `game/world-works.js` — взносы/защита от затопления; общая `state.worldWorks`; навигация/генерация используют тот же макет | `phaser/world-works-view.js`, `phaser/world-works-journal.js`, осмотр через `game/exploration.js`; ограниченная инвалидация земли — `phaser/terrain-layer.js`, `phaser/art/ground-art.js`; [WORLD-WORKS.md](WORLD-WORKS.md) |
| Крепость, лесопилка, находки | `game/locations.js`, `game/exploration.js`, `game/clearing.js` | `phaser/location-view.js`, `phaser/exploration-view.js`, `phaser/clearing-view.js` |
| Перевалочный костёр крепости | `game/outposts.js`, `state.exploration.outpostFuel`; действия — `game/exploration.js` | `phaser/outpost-view.js`, `phaser/location-view.js`, `phaser/night-lighting.js`; [OUTPOSTS.md](OUTPOSTS.md) |
| Сюжет и дневник | `game/story.js`, `game/lore.js`, `game/discovery-dialogue.js` | `phaser/story-journal.js`, `phaser/exploration-ui.js` |
| Работники и профессии | `game/workers.js` — общий планировщик/команды; `game/worker-jobs.js` — каменщик/ремонтник/места; `game/mining.js` — общая прочность валунов | `phaser/worker-view.js`, `phaser/worker-ui.js`; [WORKER-JOBS.md](WORKER-JOBS.md) |
| PNG, кадры, звук | `src/assets/`, `scripts/prepare_*.py` — только по задаче; выбор фоновых сигналов — `game/biome-soundscape.js` | `phaser/*-assets.js`, `phaser/atlas.js`, `phaser/forest-audio.js` |

Подробные правила систем: [REGIONAL-HUNT.md](REGIONAL-HUNT.md), [WATCHER.md](WATCHER.md), [REGIONS.md](REGIONS.md), [DEFENSE.md](DEFENSE.md), [STORY.md](STORY.md). Читать нужный документ, а не весь набор.

Размер квадрата: `game/world-grid.js`; регионы/границы — `game/regions.js`, размещение — `game/region-world.js`. Фонарь: `mystery.js`, маска — `phaser/atmosphere.js`; общая шкала магазина — `phaser/shop-progress.js` (модальная и личные лавки).

Целевые проверки увеличенной карты/фонаря: `node --test tests/world-scale.test.mjs tests/regions.test.mjs tests/night_horror.test.mjs tests/economy_logic.test.mjs`; после сборки `python tests/world_scale_smoke.py` проверяет новые шкалы, личную прокачку и альфа-профиль света в WebGL/Canvas. Скриншоты — `docs/shop-progress-*.png`, `docs/lantern-soft-*.png`.

Площадка костра: `CAMP_SERVICE.fuelPad`, `updateFuelPad()` в `game/camp-services.js`; вызов для каждого героя — `game/simulation.js`; вид — `phaser/camp-services-view.js`. Проверки: [CAMP-PROGRESSION.md](CAMP-PROGRESSION.md). Масштаб Смотрителя — `phaser/enemy-view.js`, браузер — `tests/watcher_smoke.py --scale-only`.

Направленный фонарь: `game/light-shapes.js` — форма/проверка освещённости, `phaser/lantern-stamps.js` — пять заранее подготовленных масок; проверки — [NIGHT-HORROR.md](NIGHT-HORROR.md). Ручей/броды: `game/camp-stream.js`, общие контуры в `game/region-world.js` и `phaser/art/ground-art.js`. Состояние водного плана и целевые проверки: [FOREST-WATER-PLAN.md](FOREST-WATER-PLAN.md).

## Команды по необходимости

Ягоды/растения: `game/berries.js`, размещение в `game/region-world.js`, общие дни урожая — `game/coop-state.js`. PNG: `src/assets/plants/`, подготовка `scripts/prepare_plants.py` и `scripts/prepare_bushes.py`; загрузка/кадры — `phaser/plants-assets.js`, вид — `phaser/plants-view.js`. Кусты и деревья теперь в [стиле №4](VEGETATION-STYLE4.md); остальные растения из ряда 2 сохранены. Правила сбора: [PLANTS.md](PLANTS.md).

Лагерь со стражами и вышка: `game/forest-tasks-layout.js` — макет/баланс, `game/forest-tasks.js` — общий результат боя/сундук/разведка; охрана использует `game/minions.js`, ремонт — `game/world-works.js`. Прототип вида — `phaser/forest-tasks-view.js`, сведения карты — `phaser/region-map.js`. Контракты, оформление и целевые тесты: [FOREST-TASKS.md](FOREST-TASKS.md).

Украшения/рекорды: `game/camp-custom.js`, `game/record-book.js`, `phaser/camp-custom-view.js`; баланс/проверки — [CAMP-CUSTOM.md](CAMP-CUSTOM.md). Исключение из сброса прогресса: только местные рекорды и открытые украшения. Быстрый календарь — `state.cycleSpeed`, только `game/cycle.js`; обычный темп выбран по умолчанию.

Лесопилка: баланс — `game/sawmill-production-config.js`, ремонт/партии — `game/sawmill-production.js`, физические грузы — `game/sawmill-freight.js`, отображение — `phaser/sawmill-production-view.js`. Правила и целевые команды: [SAWMILL-PRODUCTION.md](SAWMILL-PRODUCTION.md).

- `npm run serve`, затем `http://localhost:8000/` — локальный запуск. Открывать через HTTP, не `file://`.
- `npm run build` — автономная статическая сборка в игнорируемой папке `dist/`; Phaser включён локально.
- `node --test tests/camp-expansion.test.mjs` и `python tests/camp_expansion_smoke.py` — оплата регионов двумя материалами, топливо, склад, калитки, независимые лавки, E/Enter, комната дома, мышь/тач и перезапуск.
- `node --test tests/build-projects.test.mjs` и `python tests/build_choice_smoke.py` — любая первая постройка, выбор без списания, обязательный повторный вход, холодный костёр, E днём/ночью, верхняя шкала и W/S для доступных и недоступных покупок.
- `node --test tests/camp-industry.test.mjs tests/build-projects.test.mjs` — очередь, списания, зависимости построек, улучшения, топливо, ремонт, отдых, заказы/возврат и начисления вдвоём. После сборки `python tests/camp_industry_smoke.py` проверяет только новый цикл: WebGL вдвоём и мобильный Canvas из `dist/`, клавиатуру/тач, реальную башню в пятую ночь и очистку при перезапуске.
- `node --test tests/local-coop.test.mjs` и `python tests/local_coop_smoke.py` — личные счета и общий мир, два комплекта ввода, разделение/слияние камер, фонари, спасение, перезапуск и ограниченный совмещённый замер нагрузки.
- `node --test tests/worker-jobs.test.mjs tests/workers.test.mjs tests/camp-industry.test.mjs tests/local-coop.test.mjs` — профессии/места, реальные добыча/ремонт/склад, последний удар по валуну, резерв, смена профессии с грузом, общий бюджет поиска и кооператив. После сборки `python tests/worker_jobs_smoke.py` проверяет только новые назначения, H и клавиатуру/тач, два улучшения дома, четыре NPC, разгрузку/ремонт, паузу и сброс: WebGL вдвоём и мобильный Canvas из `dist/`.
- `node --test tests/watcher.test.mjs tests/night_horror.test.mjs tests/minions.test.mjs` — ночная опасность и малые враги.
- `node --test tests/defense-preparation.test.mjs tests/defenses.test.mjs tests/first_days.test.mjs` — удержание ремонта, предупреждения и отчёт; UI — `python tests/defense_preparation_smoke.py`.
- `node --test tests/camp-loop.test.mjs tests/first_days.test.mjs tests/defenses.test.mjs tests/defense-preparation.test.mjs tests/night_horror.test.mjs tests/camp-industry.test.mjs tests/local-coop.test.mjs tests/minions.test.mjs` — цели/реальные действия, топливо/ограда/боезапас, прогноз и ротация волн, броски/уклонение, кооперативный урон и совместимость прежнего боя. После сборки `python tests/camp_loop_smoke.py` проверяет только новые цели, сводку, прогноз, настоящий налёт и метателя, паузу, отчёт и перезапуск: WebGL вдвоём и мобильный Canvas из `dist/`.
- `node --test tests/economy_logic.test.mjs tests/simulation.test.mjs` — экономика и команды симуляции.
- `node --test tests/combat-loot.test.mjs tests/runtime-entry.test.mjs` — добыча, ранний цикл и единственный вход; UI/старая ссылка — `python tests/combat_loot_smoke.py`. Баланс: [COMBAT-LOOT.md](COMBAT-LOOT.md).
- `node --test tests/regions.test.mjs tests/biomes.test.mjs` — регионы и биомы.
- `node --test tests/world-works.test.mjs tests/regions.test.mjs tests/exploration.test.mjs tests/local-coop.test.mjs tests/worker-jobs.test.mjs` — реальные переходы/взносы/затопление/сундук/регенерация окружения и совместимость кооператива/помощников; `tests/fortress.test.mjs tests/biome-atmosphere.test.mjs tests/first_days.test.mjs` — затронутые подходы/земля/ранний цикл. После сборки `python tests/world_works_smoke.py` проверяет только плотину, воду/кеш, мост/настил, ворота, сундук/архив, управление и сброс: WebGL вдвоём и мобильный Canvas из `dist/`. `--mobile-only` повторяет только мобильную часть.
- `node --test tests/biome-atmosphere.test.mjs` и `python tests/biome_atmosphere_smoke.py` — проходы леса/болота, детерминированный декор, стык грунта, PNG, стереозвук/пауза и ограниченные кеши.
- `node --test tests/story.test.mjs tests/discovery-dialogue.test.mjs` — сюжет и разговоры о находках.
- `node --test tests/outposts.test.mjs` и `python tests/outpost_smoke.py` — розжиг/подброс/готовка, топливо/пауза, временная защита от Смотрителя и угроза пятой ночи, свет/ввод/перезапуск.
- Браузерные сценарии — соответствующие `tests/*_smoke.py`; нужны Python Playwright и Chromium. `tests/watcher_smoke.py --scale-only` проверяет только масштаб и подписи врагов.
- `python tests/game_menu_smoke.py` — компактные действия, ручная пауза/звук/настройки, соседние диалоги, перезапуск и портретные экраны. Для настроек в прежних сценариях использовать `click_setting()` из `tests/helpers/browser_start.py`.
- `python tests/loot_item_assets_test.py` — alpha/размеры новых предметов; `python tests/loot_item_art_smoke.py` — PNG, свет/маркеры, эффекты, сумка, торговля и снасти. `--mobile-only` повторяет только мобильную часть.
- `node --test tests/world-readability.test.mjs` и `python tests/world_readability_smoke.py` — кроны/основания, ввод, восстановление и приоритеты подписей. `python tests/phaser_performance.py --combined-only` — только дождь + ночь + 82 бревна + налёт, полные/лёгкие эффекты.
- `npm test` запускает все Node-тесты: применять для широких изменений или обоснованной регрессии, а не автоматически после каждой правки.
- `git diff --check` — проверка патча перед коммитом. Итоговый отчёт называет только действительно выполненные проверки.
