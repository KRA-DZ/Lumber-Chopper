export const LETTERS = Object.freeze([
  {
    id: "first-dawn",
    night: 1,
    name: "Письмо под дверью",
    text: "«Ты пережил первую ночь. Свет у лагеря держит Рогатого Смотрителя на расстоянии. Топор его не ранит. Стволы скрывают тебя от прямого взгляда, но шум рубки слышен далеко. Из круга удара можно уйти, пока он замер. На пятый закат придут те, кто света не боится. Построй костёр до их прихода.»",
  },
  {
    id: "third-dawn",
    night: 3,
    name: "Записка смотрителя",
    text: "«Не уходи далеко на пятую ночь. Налётчики ищут огонь и припасы. Их можно остановить топором. Если повредят лагерь, принеси брёвна на строительную площадку.»",
  },
  {
    id: "fifth-dawn",
    night: 5,
    name: "Письмо с чёрной печатью",
    text: "«Они вернутся на десятую ночь. Но тот, кто ходит между деревьями, приходит каждую ночь. Он не один из них. На юге торговец хранит старые договоры.»",
  },
  {
    id: "tenth-dawn",
    night: 10,
    name: "Последнее предупреждение",
    text: "«Каждый пятый закат приводит больше незваных гостей. Смотритель не стареет. Мы пытались остановить его железом. Возвращайся к свету.»",
  },
]);
export const QUESTS = Object.freeze([
  {
    id: "warm-dawn",
    letter: "first-dawn",
    name: "Первый тёплый рассвет",
    description: "Пережить ночь и построить костёр.",
    reward: 20,
    ready: (s) => s.nightsSurvived >= 1 && s.campLevel >= 1,
  },
  {
    id: "shelter",
    letter: "third-dawn",
    name: "Укрытие до налёта",
    description: "Построить палатку и пережить три ночи.",
    reward: 50,
    ready: (s) => s.nightsSurvived >= 3 && s.campLevel >= 2,
  },
  {
    id: "fifth-night",
    letter: "fifth-dawn",
    name: "Выстоять",
    description: "Пережить пятую ночь.",
    reward: 80,
    ready: (s) => s.nightsSurvived >= 5,
  },
]);
export function createLore(state, emit = () => {}) {
  return {
    onDawn() {
      for (const letter of LETTERS)
        if (
          state.nightsSurvived >= letter.night &&
          !state.unlockedLetters.includes(letter.id)
        ) {
          state.unlockedLetters.push(letter.id);
          emit("letter-received", { id: letter.id, name: letter.name });
        }
    },
    read(clue) {
      if (!clue?.id) return false;
      if (!state.readClues.includes(clue.id)) {
        state.readClues.push(clue.id);
        emit("clue-read", { id: clue.id });
      }
      return true;
    },
    claim(id) {
      const q = QUESTS.find((q) => q.id === id);
      if (
        state.gameOver ||
        !q ||
        !state.unlockedLetters.includes(q.letter) ||
        !q.ready(state) ||
        state.claimedQuests.includes(id)
      )
        return false;
      state.claimedQuests.push(id);
      state.coins += q.reward;
      emit("quest-completed", { id, reward: q.reward });
      return true;
    },
  };
}
