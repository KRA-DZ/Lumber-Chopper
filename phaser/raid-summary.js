// The report is a snapshot; opening this card never pays a reward or repairs anything.
export function appendRaidSummary(container, report) {
  if (!report) return;
  const article = document.createElement("article"),
    title = document.createElement("h3"),
    text = document.createElement("p");
  article.dataset.raidReport = String(report.night);
  title.textContent = `Итоги ночи ${report.night} · ${report.survived ? "пережита" : "поражение"}`;
  text.style.whiteSpace = "pre-line";
  text.textContent = [
    `Налётчики: ${report.killed}/${report.spawned} побеждено · сбежало ${report.escaped}.`,
    `Местные враги: ${report.minions} · региональные боссы: ${report.bosses}.`,
    `Награда основной волны: ${report.reward} монет (уже начислена).`,
    `Урон лагерю: ${report.campDamage} HP · ограде и баррикадам: ${report.defenseDamage} HP.`,
    `Разрушено участков за ночь: ${report.brokenSections}.`,
    `${report.survived ? "На рассвете" : "В конце боя"}: база ${report.campHealth}/${report.maxCampHealth} HP · повреждённых укреплений ${report.damaged.length}.`,
    `На восстановление в тот момент требовалось ${report.repairLogs} брёвен. Текущее состояние — в меню обороны.`,
  ].join("\n");
  article.append(title, text);
  container.append(article);
}
