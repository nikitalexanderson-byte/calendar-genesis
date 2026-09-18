export const SACRED_PRACTICE_SECTOR_IDS = [
  "north",
  "northeast",
  "east",
  "southeast",
  "south",
  "southwest",
  "west",
  "northwest",
  "center",
] as const;

export type SacredPracticeSectorId = (typeof SACRED_PRACTICE_SECTOR_IDS)[number];

export type SacredPracticeLocalizedText = {
  ru: string;
  en: string;
};

export type SacredPractice = {
  id: string;
  sectorId: SacredPracticeSectorId;
  emoji: string;
  title: SacredPracticeLocalizedText;
  description: SacredPracticeLocalizedText;
  myth: SacredPracticeLocalizedText;
  suggestedTime: string;
  priority: number;
  color: string;
};

export type SacredSectorGuidance = {
  sectorId: SacredPracticeSectorId;
  upright: SacredPracticeLocalizedText;
  reversed: SacredPracticeLocalizedText;
};

export const SACRED_SECTOR_GUIDANCE: readonly SacredSectorGuidance[] = [
  {
    sectorId: "north",
    upright: { ru: "Сила Афины проявлена: превратите ясную мысль в один выполнимый замысел.", en: "Athena's power is present: turn clear thought into one executable intention." },
    reversed: { ru: "Мудрость заслонена шумом: остановитесь, отделите факт от страха и выберите один следующий шаг.", en: "Wisdom is obscured by noise: pause, separate fact from fear, and choose one next step." },
  },
  {
    sectorId: "northeast",
    upright: { ru: "Артемида поддерживает самостоятельность: сохраните пространство для тела, природы и личных границ.", en: "Artemis supports self-reliance: protect space for your body, nature, and personal boundaries." },
    reversed: { ru: "Инстинкт потерял направление: вернитесь к телу и восстановите одну нарушенную границу.", en: "Instinct has lost direction: return to the body and restore one crossed boundary." },
  },
  {
    sectorId: "east",
    upright: { ru: "Гермес и Пейто открывают путь слову: назовите намерение и передайте его ясно.", en: "Hermes and Peitho open the way for speech: name your intention and communicate it clearly." },
    reversed: { ru: "Слова рассеивают силу: сократите послание до правды, которую можно подтвердить действием.", en: "Words are scattering power: reduce the message to a truth you can support with action." },
  },
  {
    sectorId: "southeast",
    upright: { ru: "Гефест и Аглая благословляют ремесло: улучшите одну вещь точным и красивым движением.", en: "Hephaestus and Aglaea bless craft: improve one thing through a precise and beautiful action." },
    reversed: { ru: "Огонь мастерской расходуется впустую: очистите рабочее место и завершите малую починку.", en: "The workshop fire is being wasted: clear the work surface and finish one small repair." },
  },
  {
    sectorId: "south",
    upright: { ru: "Арес и Афродита соединяют волю и притяжение: направьте энергию в тело и заботливое действие.", en: "Ares and Aphrodite unite will and attraction: direct energy into the body and a caring act." },
    reversed: { ru: "Напор стал конфликтом или усталостью: верните меру через движение без борьбы и бережный уход.", en: "Drive has become conflict or fatigue: restore proportion through non-combative movement and gentle care." },
  },
  {
    sectorId: "southwest",
    upright: { ru: "Деметра напоминает о плодородии повторения: накормите тело или позаботьтесь о живом.", en: "Demeter recalls the fertility of repetition: nourish the body or tend something living." },
    reversed: { ru: "Почва истощена: сначала восстановите запас еды, воды или домашнего порядка.", en: "The soil is depleted: first restore food, water, or order in the home." },
  },
  {
    sectorId: "west",
    upright: { ru: "Посейдон и Амфитрита дают глубину: признайте чувство и позвольте ему пройти, не управляя вами.", en: "Poseidon and Amphitrite bring depth: acknowledge a feeling and let it pass without steering you." },
    reversed: { ru: "Внутреннее море неспокойно: верните текучесть водой, дыханием и короткой записью чувства.", en: "The inner sea is unsettled: restore flow with water, breath, and a brief written feeling." },
  },
  {
    sectorId: "northwest",
    upright: { ru: "Аполлон освещает меру: вынесите главное на свет и настройте день по ясному ритму.", en: "Apollo illuminates measure: bring what matters into the light and tune the day to a clear rhythm." },
    reversed: { ru: "Ясность превратилась в жёсткость: верните гармонию через свет, музыку или спокойное чтение.", en: "Clarity has hardened into rigidity: restore harmony through light, music, or quiet reading." },
  },
  {
    sectorId: "center",
    upright: { ru: "Дионис и Ариадна удерживают живую нить целого: отметьте жизнь творчеством и благодарностью.", en: "Dionysus and Ariadne hold the living thread of the whole: affirm life through creativity and gratitude." },
    reversed: { ru: "Нить центра потеряна: остановитесь, назовите своё состояние и сделайте одно свободное творческое действие.", en: "The thread to the center is lost: pause, name your state, and make one free creative gesture." },
  },
] as const;

export const SACRED_PRACTICES: readonly SacredPractice[] = [
  {
    id: "athena-three-intentions",
    sectorId: "north",
    emoji: "🦉",
    title: { ru: "Три намерения Афины", en: "Athena's three intentions" },
    description: { ru: "Каждое утро записывать три главных дела и первым выбирать самое важное.", en: "Write down three essential tasks each morning and begin with the most important." },
    myth: { ru: "Афина рождается из мысли Зевса уже вооружённой: ясный замысел предшествует точному действию.", en: "Athena is born fully armed from Zeus's thought: clear intention precedes precise action." },
    suggestedTime: "08:00",
    priority: 8,
    color: "#497d9c",
  },
  {
    id: "athena-evening-counsel",
    sectorId: "north",
    emoji: "🏛️",
    title: { ru: "Вечерний совет Афины", en: "Athena's evening counsel" },
    description: { ru: "Вечером коротко записать одно удачное решение и один урок дня.", en: "At night, briefly record one sound decision and one lesson from the day." },
    myth: { ru: "Как покровительница полиса, Афина превращает опыт в рассудительность и общее благо.", en: "As guardian of the polis, Athena turns experience into judgment and common good." },
    suggestedTime: "21:00",
    priority: 6,
    color: "#5b89a5",
  },
  {
    id: "artemis-wild-walk",
    sectorId: "northeast",
    emoji: "🌿",
    title: { ru: "Тропа Артемиды", en: "Artemis's path" },
    description: { ru: "Гулять не менее 20 минут без телефона, замечая тело, воздух и живую природу.", en: "Walk for at least 20 phone-free minutes, noticing body, air, and living nature." },
    myth: { ru: "Артемида хранит дикую природу и свободу движения вне городского шума.", en: "Artemis protects wild nature and freedom of movement beyond the city's noise." },
    suggestedTime: "18:00",
    priority: 7,
    color: "#487f4b",
  },
  {
    id: "artemis-boundary",
    sectorId: "northeast",
    emoji: "🏹",
    title: { ru: "Граница Артемиды", en: "Artemis's boundary" },
    description: { ru: "Каждый день осознанно отказаться от одного лишнего требования или отвлечения.", en: "Consciously decline one unnecessary demand or distraction each day." },
    myth: { ru: "Независимая богиня сохраняет неприкосновенным своё пространство и выбранный путь.", en: "The independent goddess keeps her space and chosen path inviolate." },
    suggestedTime: "12:00",
    priority: 7,
    color: "#5d9360",
  },
  {
    id: "hermes-clear-message",
    sectorId: "east",
    emoji: "🪽",
    title: { ru: "Ясное послание Гермеса", en: "Hermes's clear message" },
    description: { ru: "Отправить одно давно откладываемое короткое и ясное сообщение.", en: "Send one brief, clear message you have been postponing." },
    myth: { ru: "Гермес свободно пересекает границы миров и доставляет слово точно адресату.", en: "Hermes crosses the boundaries of worlds and delivers the word to its true recipient." },
    suggestedTime: "10:00",
    priority: 6,
    color: "#b48825",
  },
  {
    id: "peitho-listening",
    sectorId: "east",
    emoji: "👂",
    title: { ru: "Слушание Пейто", en: "Peitho's listening" },
    description: { ru: "В одном разговоре сначала задать вопрос и дослушать ответ без перебивания.", en: "In one conversation, ask a question first and hear the answer without interrupting." },
    myth: { ru: "Пейто олицетворяет убеждение без принуждения: влияние начинается с внимания к другому.", en: "Peitho embodies persuasion without force: influence begins with attention to another." },
    suggestedTime: "14:00",
    priority: 6,
    color: "#c39a35",
  },
  {
    id: "hephaestus-small-repair",
    sectorId: "southeast",
    emoji: "🔨",
    title: { ru: "Малая починка Гефеста", en: "Hephaestus's small repair" },
    description: { ru: "Починить, улучшить или довести до порядка одну бытовую вещь.", en: "Repair, improve, or put one household object in working order." },
    myth: { ru: "Гефест превращает огонь и несовершенство материи в полезную форму.", en: "Hephaestus turns fire and imperfect matter into useful form." },
    suggestedTime: "19:00",
    priority: 7,
    color: "#bd6828",
  },
  {
    id: "aglaea-beautiful-workspace",
    sectorId: "southeast",
    emoji: "✨",
    title: { ru: "Мастерская Аглаи", en: "Aglaea's workshop" },
    description: { ru: "Десять минут приводить рабочую поверхность в чистый и красивый вид.", en: "Spend ten minutes making the work surface clean and beautiful." },
    myth: { ru: "Аглая соединяет сияние Харит с мастерством Гефеста: польза завершается красотой.", en: "Aglaea joins the radiance of the Charites to Hephaestus's craft: utility is completed by beauty." },
    suggestedTime: "17:30",
    priority: 5,
    color: "#cf7b3d",
  },
  {
    id: "ares-deliberate-movement",
    sectorId: "south",
    emoji: "🛡️",
    title: { ru: "Движение Ареса", en: "Ares's movement" },
    description: { ru: "Не менее 20 минут двигаться с усилием: тренировка, быстрая ходьба или растяжка.", en: "Move with effort for at least 20 minutes: training, brisk walking, or mobility work." },
    myth: { ru: "Сила Ареса становится добродетелью, когда получает меру, направление и дисциплину.", en: "Ares's force becomes a virtue when it receives measure, direction, and discipline." },
    suggestedTime: "18:30",
    priority: 8,
    color: "#a93f39",
  },
  {
    id: "aphrodite-care",
    sectorId: "south",
    emoji: "🌹",
    title: { ru: "Забота Афродиты", en: "Aphrodite's care" },
    description: { ru: "Совершить один внимательный жест ухода за телом, одеждой или близким человеком.", en: "Make one attentive gesture of care for your body, clothing, or someone close." },
    myth: { ru: "Афродита пробуждает притяжение через внимание к красоте, телесности и связи.", en: "Aphrodite awakens attraction through attention to beauty, embodiment, and connection." },
    suggestedTime: "20:00",
    priority: 6,
    color: "#bd5a55",
  },
  {
    id: "demeter-nourishing-meal",
    sectorId: "southwest",
    emoji: "🌾",
    title: { ru: "Трапеза Деметры", en: "Demeter's meal" },
    description: { ru: "Приготовить или выбрать одну полноценную трапезу и съесть её без спешки.", en: "Prepare or choose one nourishing meal and eat it without rushing." },
    myth: { ru: "Дар Деметры — возделанное зерно: ежедневная пища становится продолжением заботы о земле.", en: "Demeter's gift is cultivated grain: daily food continues the care given to the earth." },
    suggestedTime: "13:00",
    priority: 8,
    color: "#8b6533",
  },
  {
    id: "demeter-living-care",
    sectorId: "southwest",
    emoji: "🪴",
    title: { ru: "Живой сад Деметры", en: "Demeter's living garden" },
    description: { ru: "Полить растение, пополнить запас продуктов или убрать одну зону кухни.", en: "Water a plant, replenish food stores, or clean one part of the kitchen." },
    myth: { ru: "Цикл Деметры учит поддерживать жизнь малыми повторяющимися действиями.", en: "Demeter's cycle teaches that life is sustained by small repeated acts." },
    suggestedTime: "19:30",
    priority: 5,
    color: "#9c7843",
  },
  {
    id: "poseidon-water-pause",
    sectorId: "west",
    emoji: "🌊",
    title: { ru: "Водная пауза Посейдона", en: "Poseidon's water pause" },
    description: { ru: "Выпить стакан воды и сделать десять спокойных вдохов перед реакцией на напряжение.", en: "Drink a glass of water and take ten calm breaths before reacting to tension." },
    myth: { ru: "Посейдон поднимает и усмиряет море: пауза возвращает власть над внутренней волной.", en: "Poseidon raises and calms the sea: a pause restores command over the inner wave." },
    suggestedTime: "15:00",
    priority: 7,
    color: "#347a96",
  },
  {
    id: "amphitrite-emotion-log",
    sectorId: "west",
    emoji: "🐚",
    title: { ru: "Раковина Амфитриты", en: "Amphitrite's shell" },
    description: { ru: "Пять минут записывать главное чувство дня и потребность, стоящую за ним.", en: "Spend five minutes recording the day's main feeling and the need beneath it." },
    myth: { ru: "Амфитрита придаёт морской глубине царственный порядок и способность вместить бурю.", en: "Amphitrite gives sovereign order to the sea's depth and the capacity to contain a storm." },
    suggestedTime: "21:30",
    priority: 6,
    color: "#4c8da5",
  },
  {
    id: "apollo-morning-light",
    sectorId: "northwest",
    emoji: "☀️",
    title: { ru: "Свет Аполлона", en: "Apollo's light" },
    description: { ru: "Провести не менее десяти минут при дневном свете в первой половине дня.", en: "Spend at least ten minutes in daylight during the first half of the day." },
    myth: { ru: "Аполлон открывает меру и ясность светом, который делает формы различимыми.", en: "Apollo reveals measure and clarity through light that makes forms distinct." },
    suggestedTime: "09:00",
    priority: 8,
    color: "#aa841d",
  },
  {
    id: "apollo-harmonic-study",
    sectorId: "northwest",
    emoji: "🎵",
    title: { ru: "Гармония Аполлона", en: "Apollo's harmony" },
    description: { ru: "Пятнадцать минут читать, учиться или внимательно слушать музыку без многозадачности.", en: "Read, study, or listen closely to music for fifteen minutes without multitasking." },
    myth: { ru: "Лира Аполлона согласует разные струны в один строй — так внимание собирает разум.", en: "Apollo's lyre tunes different strings into one mode, as attention gathers the mind." },
    suggestedTime: "11:00",
    priority: 6,
    color: "#b89737",
  },
  {
    id: "ariadne-thread-journal",
    sectorId: "center",
    emoji: "🧵",
    title: { ru: "Нить Ариадны", en: "Ariadne's thread" },
    description: { ru: "Записать одной строкой, что сегодня возвращает вас к себе и своему пути.", en: "Write one line about what returns you to yourself and your path today." },
    myth: { ru: "Нить Ариадны выводит из лабиринта: короткая запись удерживает связь с центром.", en: "Ariadne's thread leads out of the labyrinth: a brief note preserves the link to the center." },
    suggestedTime: "21:00",
    priority: 7,
    color: "#9b393b",
  },
  {
    id: "dionysus-living-gesture",
    sectorId: "center",
    emoji: "🍇",
    title: { ru: "Живой жест Диониса", en: "Dionysus's living gesture" },
    description: { ru: "Десять минут свободно танцевать, петь, рисовать или благодарить за прожитый день.", en: "Spend ten minutes freely dancing, singing, drawing, or giving thanks for the lived day." },
    myth: { ru: "Дионис возвращает целостность через экстаз — выход из застывшей роли к живому переживанию.", en: "Dionysus restores wholeness through ecstasy: stepping beyond a fixed role into living experience." },
    suggestedTime: "20:30",
    priority: 6,
    color: "#ad4c50",
  },
] as const;

const sacredPracticeIds = new Set(SACRED_PRACTICES.map((practice) => practice.id));
const sacredSectorIds = new Set<string>(SACRED_PRACTICE_SECTOR_IDS);

export function isSacredPracticeId(value: unknown): value is string {
  return typeof value === "string" && sacredPracticeIds.has(value);
}

export function isSacredPracticeSectorId(value: unknown): value is SacredPracticeSectorId {
  return typeof value === "string" && sacredSectorIds.has(value);
}

export function sacredPracticesForSector(sectorId: SacredPracticeSectorId) {
  return SACRED_PRACTICES.filter((practice) => practice.sectorId === sectorId);
}

export function sacredSectorGuidance(sectorId: SacredPracticeSectorId) {
  return SACRED_SECTOR_GUIDANCE.find((guidance) => guidance.sectorId === sectorId)!;
}
