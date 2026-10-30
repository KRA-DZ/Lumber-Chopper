import { DAY_SECONDS } from "./config.js";

export const STORY = Object.freeze({
  title: "Глава I · Чужой огонь",
  reward: 120,
});
export const STORY_EVIDENCE = Object.freeze([
  {
    id: "seal",
    name: "Обломок чёрной печати",
    note: "ruins-note",
    site: "chest:0:-1:0",
    hint: "Прочитайте дневник в северных руинах и откройте любой сундук.",
  },
  {
    id: "scale",
    name: "Зеркальная чешуя",
    note: "pond-note",
    site: "fishing",
    hint: "Прочитайте письмо у западного пруда и поймайте хотя бы одну рыбу.",
  },
  {
    id: "imprint",
    name: "Смоляной оттиск",
    note: "oak-note",
    site: "ancient-roots",
    hint: "Изучите зарубки у восточного дуба и оставьте дар у корней.",
  },
]);
const PAGES = Object.freeze({
  invitation: {
    name: "Лист без адреса",
    text: "«Огонь виден не только тебе. До тебя здесь стояли другие лагеря. Найди записку к северо-западу от костра. Если буквы ещё читаются — у тебя осталось время.» На бумаге отпечатался круг с тремя разрывами.",
  },
  seal: {
    name: "На обороте печати",
    text: "В пустой ячейке сундука лежал обломок чёрной печати. На обороте — незамкнутый круг с тремя разрывами. Это не замок. Кто-то отмечал им вещи, которые хотел найти снова.",
  },
  scale: {
    name: "Отражение неба",
    text: "На досках причала осталась необычная чешуя. В ней отражается вечернее небо, хотя сейчас день. Когда прячешь её в сумку, отражение гаснет. Рыба при этом самая обыкновенная.",
  },
  imprint: {
    name: "То, что помнят корни",
    text: "Смола растеклась по старым зарубкам. Под обычными следами топора проступили незамкнутый круг и три короткие черты. Ты сохранил оттиск. Сам дуб остался невредим.",
  },
  interview: {
    name: "Три свидетеля",
    text: "Торговец не назвал цену за ответ. «Камень помнит вещи. Вода — лица. Дерево — обещания. Принеси следы всех троих и прочитай то, что оставили прежние жильцы. Тогда я смогу показать страницу, на которой нет твоего имени».",
  },
  contract: {
    name: "Страница договора",
    text: "«Смотритель не подчиняется лагерю. Он узнаёт границу старого договора и ищет тех, кто вышел за неё. Свет держит границу, пока у очага остаётся живой свидетель. На пятый рассвет закрепи эту страницу у костра. Имя вписывать не обязательно». Ниже стоят десятки незнакомых подписей.",
  },
  ending: {
    name: "Чужой огонь",
    text: "На бумаге проступила тропа к другому лагерю. У его костра отмечено время: завтрашний рассвет. Ты ещё не бывал там, но рядом уже стоит твоё имя. В эту ночь Смотритель снова придёт. Первая глава завершена.",
  },
});
// Story follows durable gameplay facts; economic items are never reserved or consumed by it.
export function createStory({ state, exploration, emit = () => {} }) {
  const data = state.story;
  let revision = 0;
  const read = (id) => state.readClues.includes(id);
  const identified = (e) => data.evidence[e.id] && read(e.note);
  function page(id) {
    if (data.pages.includes(id)) return;
    data.pages.push(id);
    emit("story-page", { id, name: PAGES[id].name });
  }
  function sync() {
    if (state.gameOver) return;
    const before = JSON.stringify(data);
    const facts = {
      seal: state.exploration.openedChests.length > 0,
      scale: state.exploration.totalFishCaught > 0,
      imprint: state.exploration.offeringDay >= 0,
    };
    for (const e of STORY_EVIDENCE)
      if (facts[e.id] && !data.evidence[e.id]) {
        data.evidence[e.id] = true;
        page(e.id);
        emit("story-evidence", { id: e.id, name: e.name });
      }
    const previous = data.phase;
    if (data.phase === 0 && state.nightsSurvived >= 1) {
      data.phase = 1;
      page("invitation");
    }
    if (data.phase === 1 && state.campLevel >= 1 && read("note"))
      data.phase = 2;
    if (data.phase === 2 && data.traderTopic) data.phase = 3;
    if (data.phase === 3 && STORY_EVIDENCE.every(identified)) data.phase = 4;
    if (data.phase === 4 && data.contract) data.phase = 5;
    if (before !== JSON.stringify(data)) revision++;
    if (data.phase !== previous)
      emit("story-progress", { phase: data.phase, title: overview().title });
  }
  function offers(site) {
    const rows = [];
    if (!site || exploration.get(site.id) !== site) return rows;
    const add = (action, name, description, reason = "") =>
      rows.push({ action, name, description, enabled: !reason, reason });
    if (site.kind === "merchant" && data.phase === 2) {
      const reason = read("merchant-note")
        ? ""
        : "Сначала прочитайте обрывок договора рядом с торговцем";
      add(
        "story:ask-watcher",
        "Спросить, кого ищет Смотритель",
        "Сюжетный разговор. Торговец запомнит ваш вопрос.",
        reason,
      );
      add(
        "story:ask-contract",
        "Спросить, кто подписал договор",
        "Сюжетный разговор. Торговец запомнит ваш вопрос.",
        reason,
      );
    }
    if (site.kind === "merchant" && data.phase === 4)
      add(
        "story:show-evidence",
        "Показать три находки",
        "Получить страницу договора. Рыба, смола и реликвии останутся у вас.",
        state.nightsSurvived < 3
          ? "Торговец просит вернуться после третьей пережитой ночи"
          : "",
      );
    if (site.kind === "kitchen" && data.phase === 5) {
      const reason =
        state.nightsSurvived < 5
          ? "Сначала переживите пятую ночь"
          : state.campLevel < 2
            ? "Нужно построить палатку"
            : state.worldTime >= DAY_SECONDS / 2
              ? "Закрепите страницу при дневном свете"
              : "";
      add(
        "story:sign-name",
        "Закрепить страницу · вписать имя",
        `Завершить главу и получить ${STORY.reward} монет. Выбор сохранится в дневнике.`,
        reason,
      );
      add(
        "story:leave-mark",
        "Закрепить страницу · оставить знак",
        `Завершить главу и получить ${STORY.reward} монет. Выбор сохранится в дневнике.`,
        reason,
      );
    }
    return rows;
  }
  function performAt(site, action) {
    const option = offers(site).find((o) => o.action === action);
    if (
      state.gameOver ||
      !option?.enabled ||
      exploration.context !== site.id ||
      !exploration.near(site)
    )
      return false;
    if (action === "story:ask-watcher" || action === "story:ask-contract") {
      data.traderTopic = action.endsWith("watcher") ? "watcher" : "contract";
      page("interview");
    } else if (action === "story:show-evidence") {
      data.contract = true;
      page("contract");
    } else if (action === "story:sign-name" || action === "story:leave-mark") {
      if (data.completed || data.rewardClaimed) return false;
      data.ending = action === "story:sign-name" ? "named" : "marked";
      data.completed = true;
      data.rewardClaimed = true;
      data.phase = 6;
      state.coins += STORY.reward;
      page("ending");
      revision++;
      emit("story-completed", { ending: data.ending, reward: STORY.reward });
    } else return false;
    revision++;
    sync();
    emit("story-dialogue", { siteId: site.id, text: conversation(site.id) });
    return true;
  }
  function conversation(id) {
    if (id === "camp-kitchen" && data.completed)
      return data.ending === "named"
        ? "Вы вписали своё имя. Рядом с подписью проступил второй почерк: «Мы помним». Свет лагеря остался прежним."
        : "Вы оставили знак вместо имени. Утром рядом появилась незнакомая подпись. Свет лагеря остался прежним.";
    if (id !== "mysterious-merchant" || data.phase < 2) return "";
    if (data.contract)
      return "«Страница твоя. Закрепи её у костра после пятого рассвета. Свет не сделает тебя бессмертным. Из круга его удара всё ещё придётся выходить».";
    if (data.traderTopic)
      return data.traderTopic === "watcher"
        ? "«Он ищет тех, кого не было в списке. Лица он видит плохо, но шум помнит долго. Найди трёх свидетелей: камень, воду и дерево»."
        : "«Подписи были здесь раньше домов. Принеси три свидетельства и переживи три ночи. Только тогда бумага перестанет быть пустой».";
    return "Торговец смотрит на обрывок договора: «Ты пришёл за товаром или за ответом?»";
  }
  function overview() {
    const phase = data.phase;
    let title = "Первый рассвет",
      text = "Переживите первую ночь. В лагере появится письмо без адреса.",
      target = { kind: "camp" },
      goals = [];
    const goal = (name, done, route) => ({ name, done: !!done, target: route });
    if (phase === 1) {
      title = "След у костра";
      text = "Сохраните огонь и прочитайте записку к северо-западу от лагеря.";
      goals = [
        goal("Построить костёр", state.campLevel >= 1, { kind: "build" }),
        goal("Прочитать записку у лагеря", read("note"), {
          kind: "clue",
          id: "note",
        }),
      ];
    } else if (phase === 2) {
      title = "Слова без подписи";
      text =
        "Откройте южную чащу, найдите обрывок договора и задайте торговцу вопрос.";
      goals = [
        goal("Прочитать обрывок договора", read("merchant-note"), {
          kind: "clue",
          id: "merchant-note",
        }),
        goal("Поговорить с торговцем о договоре", !!data.traderTopic, {
          kind: "site",
          id: "mysterious-merchant",
        }),
      ];
    } else if (phase === 3) {
      title = "Три свидетеля";
      text =
        "Прочитайте записки и найдите следы камня, воды и дерева. Находки можно собирать в любом порядке.";
      goals = STORY_EVIDENCE.map((e) =>
        goal(
          e.name,
          identified(e),
          read(e.note)
            ? { kind: "site", id: e.site }
            : { kind: "clue", id: e.note },
        ),
      );
    } else if (phase === 4) {
      title = "Цена ответа";
      text = "После третьей пережитой ночи покажите торговцу все три находки.";
      goals = [
        goal("Пережить три ночи", state.nightsSurvived >= 3, { kind: "camp" }),
        goal("Получить страницу договора", data.contract, {
          kind: "site",
          id: "mysterious-merchant",
        }),
      ];
    } else if (phase === 5) {
      title = "Пятый рассвет";
      text =
        "Переживите пятую ночь, постройте палатку и при дневном свете закрепите страницу у костра.";
      goals = [
        goal("Построить палатку", state.campLevel >= 2, { kind: "build" }),
        goal("Пережить пять ночей", state.nightsSurvived >= 5, {
          kind: "camp",
        }),
        goal("Закрепить страницу у костра", data.completed, {
          kind: "site",
          id: "camp-kitchen",
        }),
      ];
    } else if (phase === 6) {
      title = "Чужой огонь · глава завершена";
      text = `Вы ${data.ending === "named" ? "вписали своё имя" : "оставили знак вместо имени"}. Получено ${STORY.reward} монет. История продолжится у другого костра.`;
    }
    target = goals.find((g) => !g.done)?.target || target;
    return {
      phase,
      title,
      text,
      goals,
      target,
      completed: data.completed,
      chapter: STORY.title,
    };
  }
  function readPage(id) {
    if (state.gameOver || !data.pages.includes(id)) return false;
    if (!data.readPages.includes(id)) {
      data.readPages.push(id);
      revision++;
      emit("story-read", { id });
    }
    return true;
  }
  const pages = () => data.pages.map((id) => ({ id, ...PAGES[id] }));
  return {
    sync,
    offers,
    performAt,
    conversation,
    overview,
    readPage,
    pages,
    get evidence() {
      return STORY_EVIDENCE.map((e) => ({
        ...e,
        found: !!data.evidence[e.id],
        identified: !!identified(e),
      }));
    },
    get unread() {
      return data.pages.filter((id) => !data.readPages.includes(id)).length;
    },
    get revision() {
      return revision;
    },
  };
}
