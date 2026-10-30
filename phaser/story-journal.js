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
}
