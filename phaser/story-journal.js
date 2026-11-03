import {
  locationJournalGroups,
  discoveryReply,
  discoveryConnection,
} from "../game/discovery-dialogue.js";
// Journal UI reads a snapshot; the model alone validates progress and pays rewards.
export function renderStoryJournal(scene, list, route) {
  const story = scene.core.story;
  if (!story) return;
  const current = story.overview(),
    section = document.createElement("section");
  section.dataset.storyChapter = "1";
  const h = document.createElement("h3");
  h.textContent = current.chapter;
  section.append(h);
  const title = document.createElement("h4");
  title.dataset.storyPhase = String(current.phase);
  title.textContent = `${current.phase >= 1 && current.phase <= 5 ? `${current.phase}/5 · ` : ""}${current.title}`;
  section.append(title);
  const p = document.createElement("p");
  p.textContent = current.text;
  section.append(p);
  for (const goal of current.goals) {
    const row = document.createElement("article");
    row.className = "activity-card";
    const text = document.createElement("p");
    text.textContent = `${goal.done ? "✓" : "○"} ${goal.name}`;
    row.append(text);
    if (!goal.done) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.storyRoute = goal.target.id || goal.target.kind;
      b.textContent = "К цели";
      b.addEventListener("click", () => route(goal.target));
      row.append(b);
    }
    section.append(row);
  }
  if (current.phase === 0) {
    const p = document.createElement("p");
    p.textContent =
      "Письмо придёт после первой пережитой ночи. Найденные заранее улики сохранятся в дневнике.";
    section.append(p);
  }
  const evidence = story.evidence.filter((e) => e.found);
  if (evidence.length) {
    const h = document.createElement("h4");
    h.textContent = "Личные улики";
    section.append(h);
    const ul = document.createElement("ul");
    for (const e of evidence) {
      const li = document.createElement("li");
      li.dataset.storyEvidence = e.id;
      li.textContent = `${e.name} · ${e.identified ? "изучена" : "прочитайте связанную записку"}`;
      ul.append(li);
    }
    section.append(ul);
  }
  for (const page of story.pages()) {
    const details = document.createElement("details"),
      summary = document.createElement("summary"),
      body = document.createElement("p");
    details.dataset.storyPage = page.id;
    summary.textContent = `${scene.core.state.story.readPages.includes(page.id) ? "" : "● "}${page.name}`;
    body.textContent = page.text;
    details.append(summary, body);
    details.addEventListener("toggle", () => {
      if (details.open) {
        story.readPage(page.id);
        summary.textContent = page.name;
        scene.survivalUi.refreshBadge();
      }
    });
    section.append(details);
  }
  list.append(section);
  renderLocationJournal(scene, list, route);
  const discoveries = scene.core.exploration?.discoveries() || [];
  if (discoveries.length) {
    const finds = document.createElement("section"),
      heading = document.createElement("h3");
    heading.textContent = "Личные находки леса";
    finds.append(heading);
    for (const item of discoveries) {
      const article = document.createElement("article"),
        title = document.createElement("h4"),
        body = document.createElement("p");
      article.dataset.discovery = item.id;
      const icon =
        item.id === "fortress-watch-token"
          ? scene.assets.fortress?.tokenIcon
          : item.id === "sawmill-shift-tag"
            ? scene.assets.sawmill?.tagIcon
            : null;
      if (icon) {
        const image = document.createElement("img");
        image.src = icon;
        image.alt = item.name;
        image.width = image.height = 64;
        image.style.imageRendering = "pixelated";
        article.append(image);
      }
      title.textContent = item.name;
      body.textContent = item.text;
      article.append(title, body);
      const reply = discoveryReply(scene.core.state, item.id);
      if (reply) {
        const details = document.createElement("details"),
          summary = document.createElement("summary"),
          text = document.createElement("p");
        details.dataset.discoveryTalk = item.id;
        summary.textContent = "Что сказал торговец";
        text.textContent = reply;
        details.append(summary, text);
        article.append(details);
      }
      finds.append(article);
    }
    const connection = discoveryConnection(scene.core.state);
    if (connection) {
      const article = document.createElement("article"),
        title = document.createElement("h4"),
        body = document.createElement("p");
      article.dataset.discoveryConnection = "true";
      title.textContent = "Крепость и лесопилка";
      body.textContent = connection;
      article.append(title, body);
      finds.append(article);
    }
    list.append(finds);
  }
}

function renderLocationJournal(scene, list, route) {
  const groups = locationJournalGroups(scene.core);
  if (!groups.length) return;
  const heading = document.createElement("h3");
  heading.textContent = "Места исследования";
  list.append(heading);
  for (const group of groups) {
    const article = document.createElement("article"),
      title = document.createElement("h4"),
      summary = document.createElement("p"),
      button = document.createElement("button");
    article.className = "activity-card";
    article.dataset.journalLocation = group.id;
    title.textContent = group.name;
    summary.textContent = `Записки: ${group.notes.length}/${group.totalNotes} · Находки: ${group.found}/${group.totalFinds}`;
    button.type = "button";
    button.dataset.locationRoute = group.id;
    button.textContent = "Ко входу";
    button.addEventListener("click", () => route(group.target));
    article.append(title, summary, button);
    for (const note of group.notes) {
      const details = document.createElement("details"),
        name = document.createElement("summary"),
        text = document.createElement("p");
      details.dataset.locationClue = note.id;
      name.textContent = note.name;
      text.textContent = note.text;
      details.append(name, text);
      article.append(details);
    }
    list.append(article);
  }
}
