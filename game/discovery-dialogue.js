export const DISCOVERY_DIALOGUES = Object.freeze([
  {
    id: "fortress-watch-token",
    name: "Жетон последнего дозора",
    text: "«Это не пропуск, — торговец переворачивает жетон и возвращает его. — Дозорные считали костры, у которых ещё оставались люди. Их отчёты уходили на юго-восток, к лесопилке. Спроси себя: зачем складу древесины знать число живых огней?»",
  },
  {
    id: "sawmill-shift-tag",
    name: "Бирка седьмой смены",
    text: "Торговец долго смотрит на спиленное имя. «Дерево покупали днём. Ночью приезжали за теми, кто стоял в ведомости. Седьмую смену вычеркнули до отправки. Кто-то в крепости заметил, что один огонь перестали считать». Он возвращает бирку: «Не давай никому дописать имя».",
  },
]);
const has = (state, id) => state.exploration.discoveries.includes(id);
export function discoveryOffers(state) {
  return DISCOVERY_DIALOGUES.filter((d) => has(state, d.id)).map((d) => ({
    action: `story:find:${d.id}`,
    name: `${state.exploration.discussedFinds.includes(d.id) ? "Вспомнить разговор" : "Обсудить находку"} · ${d.name}`,
    description:
      "Показать личную находку, не отдавая её торговцу. Без оплаты и награды.",
    enabled: true,
    reason: "",
  }));
}
export function discoveryReply(state, id) {
  return has(state, id) && state.exploration.discussedFinds.includes(id)
    ? DISCOVERY_DIALOGUES.find((d) => d.id === id)?.text || ""
    : "";
}
export function discoveryConnection(state) {
  return DISCOVERY_DIALOGUES.every((d) => discoveryReply(state, d.id))
    ? "Жетон и бирка связали два места. Дозорные отмечали живые огни, а лесопилка записывала людей в ночные отгрузки. Седьмая смена исчезла из ведомости до отправки. Кто-то разорвал эту цепочку — и оставил следы, чтобы их нашли."
    : "";
}
export function locationJournalGroups(core) {
  return (core.world.locations || [])
    .filter(
      (l) =>
        core.regions?.unlocked.has(l.regionId) ||
        (l.clues || []).some((n) => core.state.readClues.includes(n.id)) ||
        l.sites.some((s) => core.state.exploration.discoveries.includes(s.id)),
    )
    .map((l) => ({
      id: l.id,
      name: l.name,
      regionId: l.regionId,
      notes: (l.clues || [])
        .filter((n) => core.state.readClues.includes(n.id))
        .map((n) => ({ id: n.id, name: n.name, text: n.text })),
      totalNotes: (l.clues || []).length,
      found: l.sites.filter(
        (s) =>
          s.kind === "discovery" &&
          core.state.exploration.discoveries.includes(s.id),
      ).length,
      totalFinds: l.sites.filter((s) => s.kind === "discovery").length,
      target: { kind: "location", id: l.id },
    }));
}
