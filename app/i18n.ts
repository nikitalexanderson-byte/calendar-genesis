"use client";

import { useEffect, useSyncExternalStore } from "react";
import englishTranslations from "./translations.en.json";
import greekTranslationsA from "./translations.el.a.json";
import greekTranslationsB from "./translations.el.b.json";
import germanTranslations from "./translations.de.json";
import frenchTranslations from "./translations.fr.json";
import spanishTranslations from "./translations.es.json";
import italianTranslations from "./translations.it.json";
import portugueseTranslations from "./translations.pt.json";
import polishTranslations from "./translations.pl.json";
import serbianTranslationsA from "./translations.sr.a.json";
import serbianTranslationsB from "./translations.sr.b.json";
import ukrainianTranslationsA from "./translations.uk.a.json";
import ukrainianTranslationsB from "./translations.uk.b.json";
import chineseTranslations from "./translations.zh.json";
import turkishTranslations from "./translations.tr.json";
import japaneseTranslations from "./translations.ja.json";
import japaneseYandexTranslations from "./translations.ja.b.json";
import englishYear from "./year-translations/en.json";
import greekYear from "./year-translations/el.json";
import germanYear from "./year-translations/de.json";
import frenchYear from "./year-translations/fr.json";
import spanishYear from "./year-translations/es.json";
import italianYear from "./year-translations/it.json";
import portugueseYear from "./year-translations/pt.json";
import polishYear from "./year-translations/pl.json";
import serbianYear from "./year-translations/sr.json";
import ukrainianYear from "./year-translations/uk.json";
import chineseYear from "./year-translations/zh.json";
import turkishYear from "./year-translations/tr.json";
import japaneseYear from "./year-translations/ja.json";
import { languageForRegion, REGION_LANGUAGES, type RegionLanguage } from "./region-language";

export const LANGUAGES = REGION_LANGUAGES;
export type Language = RegionLanguage;
export const LANGUAGE_LABELS: Record<Language, { name: string; flag: string }> = {
  ru: { name: "Русский", flag: "🇷🇺" }, en: { name: "English", flag: "🇬🇧" },
  el: { name: "Ελληνικά", flag: "🇬🇷" }, de: { name: "Deutsch", flag: "🇩🇪" },
  fr: { name: "Français", flag: "🇫🇷" }, es: { name: "Español", flag: "🇪🇸" },
  it: { name: "Italiano", flag: "🇮🇹" }, pt: { name: "Português", flag: "🇵🇹" },
  pl: { name: "Polski", flag: "🇵🇱" }, sr: { name: "Српски", flag: "🇷🇸" },
  uk: { name: "Українська", flag: "🇺🇦" },
  zh: { name: "简体中文", flag: "🇨🇳" }, tr: { name: "Türkçe", flag: "🇹🇷" },
  ja: { name: "日本語", flag: "🇯🇵" },
};

export const LANGUAGE_STORAGE_KEY = "genesis-language-v1";
export const LANGUAGE_LOGIN_PENDING_KEY = "genesis-language-login-pending-v1";

const CYRILLIC = /[А-Яа-яЁё]/;
const TRANSLATABLE_ATTRIBUTES = ["aria-label", "placeholder", "title", "alt", "data-tooltip"] as const;
const ENGLISH_DESCRIPTION = "GENESIS is a task calendar and project manager with daily planning, reminders, and optional Google Calendar and Google Tasks synchronization.";
const PAGE_TITLES: Record<Language, string> = {
  ru: "GENESIS — календарь задач и менеджер проектов",
  en: "GENESIS — Task Calendar and Project Manager",
  el: "GENESIS — Ημερολόγιο εργασιών και διαχείριση έργων",
  de: "GENESIS — Aufgabenkalender und Projektverwaltung",
  fr: "GENESIS — Calendrier des tâches et gestion de projets",
  es: "GENESIS — Calendario de tareas y gestión de proyectos",
  it: "GENESIS — Calendario delle attività e gestione progetti",
  pt: "GENESIS — Calendário de tarefas e gestão de projetos",
  pl: "GENESIS — Kalendarz zadań i zarządzanie projektami",
  sr: "GENESIS — Календар задатака и управљање пројектима",
  uk: "GENESIS — Календар завдань і керування проєктами",
  zh: "GENESIS — 任务日历与项目管理",
  tr: "GENESIS — Görev Takvimi ve Proje Yönetimi",
  ja: "GENESIS — タスクカレンダーとプロジェクト管理",
};
const APP_BASE = (process.env.NEXT_PUBLIC_GENESIS_BASE_PATH?.trim() || "").replace(/\/$/, "");

const curatedTranslations: Record<string, string> = {
  "Григорианская": "Gregorian",
  "Григорианский": "Gregorian",
  "Григорианский календарь": "Gregorian calendar",
  "Сакральный": "Sacred",
  "Сакральный календарь": "Sacred calendar",
  "Лунный": "Lunar",
  "Лунный календарь": "Lunar calendar",
  "Круг года": "Year Wheel",
  "Пята": "Quinta",
  "Пяты": "Quintas",
  "пята": "quinta",
  "пяты": "quintas",
  "Апейрон": "Apeiron",
  "Стойхейон": "Stoicheion",
  "Теокиклос": "Theokyklos",
  "Север": "North",
  "Северо-Восток": "Northeast",
  "Восток": "East",
  "Юго-Восток": "Southeast",
  "Юг": "South",
  "Юго-Запад": "Southwest",
  "Запад": "West",
  "Северо-Запад": "Northwest",
  "Личный кабинет": "Account",
  "Дата по сакральному календарю": "Sacred calendar date",
  "Дата по лунному календарю": "Lunar calendar date",
  "День": "Day",
  "Месяц": "Month",
  "Лунный день": "Lunar day",
  "Прокручивайте карточки свободно. Для переноса удерживайте ручку ⋮⋮ и переместите задачу или список в нужный проект. Обратно в хаос-бокс элемент переносится так же.": "Scroll through the cards freely. To move an item, press and hold the ⋮⋮ handle, then drag the task or list to the required project. Move it back to the chaos box in the same way.",
  "Удерживайте ручку ⋮⋮ для переноса": "Press and hold the ⋮⋮ handle to move",
  "Кронос с косой и золотой сигиллой Сатурна": "Cronus with a scythe and the golden sigil of Saturn",
  "Фаза": "Phase",
  "Луна": "Moon",
  "Русский": "Russian",
  "Английский": "English",
  "Язык": "Language",
  "Светлая": "Light",
  "Тёмная": "Dark",
  "Цветовая схема сайта": "Website color scheme",
  "Текущая тема": "Current theme",
  "Интерфейс и справочные тексты": "Interface and reference texts",
  "Формат времени": "Time format",
  "Начало недели": "Start of week",
  "Выберите, с какого дня строить недели в разделах «Месяц» и «Круг года».": "Choose which day starts the week in the Month and Year Wheel views.",
  "Пн — Вс": "Mon — Sun",
  "Вс — Сб": "Sun — Sat",
  "Григорианская неделя начинается с понедельника.": "The Gregorian week now starts on Monday.",
  "Григорианская неделя начинается с воскресенья.": "The Gregorian week now starts on Sunday.",
  "Не удалось изменить начало недели.": "Could not change the start of the week.",
  "Григорианский календарный месяц с неделями с понедельника по воскресенье. В каждом дне дополнительно показаны покровители дня, сакральная дата, лунные сутки, рассвет и закат.": "A Gregorian calendar month with weeks from Monday through Sunday. Each day also shows its divine patrons, sacred date, lunar day, sunrise, and sunset.",
  "Отображение часов": "Clock display",
  "Настройка применяется к часам раздела «Сегодня», выбору времени задач и точным напоминаниям.": "This setting applies to the Today clock, task time selection, and exact reminders.",
  "24 часа": "24-hour",
  "Половина дня": "Half of the day",
  "Включён формат времени AM / PM.": "AM / PM time format enabled.",
  "Включён 24-часовой формат времени.": "24-hour time format enabled.",
  "Не удалось переключить формат времени.": "Could not change the time format.",
  "Основной календарь": "Primary calendar",
  "Полное отображение и система дат": "Full display and date system",
  "Выбор полностью переключает разделы «Месяц» и «Круг года», постановку задач, повторения и подписи дат. Сакральный календарь используется по умолчанию.": "Your choice fully switches the Month and Year Wheel views, task scheduling, recurrences, and date labels. The sacred calendar is used by default.",
  "Выбор полностью переключает разделы «Месяц» и «Круг года». Сакральный календарь используется по умолчанию; систему постановки задач можно выбрать отдельно для любого режима.": "Your choice fully switches the Month and Year Wheel views. The sacred calendar is the default; the task date system can be selected separately in every mode.",
  "Календарь задач": "Task calendar",
  "По какой системе выставлять даты": "Which date system to use",
  "Календарь постановки задач": "Task scheduling calendar",
  "Основной календарь не изменится; выбор дат, повторений и календарные подписи новых задач будут работать по выбранной системе.": "The primary calendar will not change; date selection, recurrences, and calendar labels for new tasks will use the selected system.",
  "Создать задачу": "Create task",
  "Новая задача на выбранный день": "New task for the selected day",
  "Дата задачи": "Task date",
  "Дата уже выбрана. При необходимости её можно изменить в форме.": "The date is already selected. You can change it in the form if needed.",
  "Закрыть создание задачи": "Close task creation",
  "Обычные даты, недели и 12 месяцев": "Standard dates, weeks, and 12 months",
  "Григорианская дата": "Gregorian date",
  "Сакральная дата": "Sacred date",
  "Лунные сутки": "Lunar day",
  "Григорианский месяц": "Gregorian month",
  "Григорианский год": "Gregorian year",
  "Лунный год": "Lunar year",
  "лунный месяц": "lunar month",
  "лунных суток": "lunar days",
  "системы дат в каждом дне": "date systems in every day",
  "солнечные точки": "solar points",
  "Лунный год после равноденствия": "Lunar year after the equinox",
  "Генезион": "Genesion",
  "Агонион": "Agonion",
  "Эвризион": "Euresion",
  "Кинонион": "Koinonion",
  "Акмеон": "Akmeon",
  "Критион": "Krition",
  "Практион": "Praktion",
  "Софион": "Sophion",
  "Катартион": "Kathartion",
  "Мнемонион": "Mnemonion",
  "Эремион": "Eremion",
  "Телейон": "Teleion",
  "Апорион": "Aporion",
  "Месяц Рождения и Замысла": "Month of Birth and Intention",
  "Месяц Преодоления": "Month of Overcoming",
  "Месяц Открытий": "Month of Discovery",
  "Месяц Связей": "Month of Connection",
  "Месяц Вершины": "Month of the Peak",
  "Месяц Переоценки": "Month of Reassessment",
  "Месяц Усердия": "Month of Diligence",
  "Месяц Мудрости": "Month of Wisdom",
  "Месяц Очищения": "Month of Purification",
  "Месяц Памяти": "Month of Memory",
  "Месяц Тишины": "Month of Silence",
  "Месяц Завершения": "Month of Completion",
  "Вставочный месяц · Вне Времени": "Intercalary Month · Outside Time",
  "Декада Роста": "Decade of Growth",
  "Декада Полноты": "Decade of Fullness",
  "Декада Исхода": "Decade of Outflow",
  "Рубеж": "Threshold",
  "1–10 сутки": "Days 1–10",
  "11–20 сутки": "Days 11–20",
  "21 сутки — Рубеж": "Day 21 — Threshold",
  "Время формулировать цели на год. Энергия чистого потенциала: начинания ещё невидимы, но их внутренний импульс уже задан.": "A time to set intentions for the year. The energy is pure potential: beginnings are still unseen, yet their inner impulse is already present.",
  "Первые трудности на пути реализации замысла. Время приложения усилий, здоровой конкуренции и тренировки воли.": "The first difficulties on the path to realizing an intention. A time for effort, healthy competition, and training the will.",
  "Время инсайтов и первых результатов работы. Пройдя сопротивление, система обнаруживает новые решения и возможности.": "A time of insight and the first results of work. Having passed through resistance, the system discovers new solutions and possibilities.",
  "Время социальной активности, укрепления отношений, переговоров и союзов. Фокус естественно смещается с «Я» на «Мы».": "A time for social activity, stronger relationships, negotiation, and alliances. The focus naturally moves from “I” to “We”.",
  "Точка максимальной продуктивности и раскрытия потенциала. Время воплощать намерение и принимать плоды собственных действий.": "The point of greatest productivity and fulfilled potential. A time to embody intention and receive the fruits of one's actions.",
  "Экватор года и время трезвого взгляда на достигнутое: распознать ошибки, сохранить существенное и отсечь лишнее.": "The midpoint of the year and a clear-eyed review of what has been achieved: recognize mistakes, preserve what matters, and cut away the excess.",
  "После переоценки приходит время упорной, рутинной, но осмысленной работы и внедрения новых правил в повседневность.": "After reassessment comes persistent, routine, but meaningful work and the integration of new rules into daily life.",
  "Время передачи опыта, обучения и философского размышления. Накопленное знание становится действующей силой.": "A time for sharing experience, learning, and philosophical reflection. Accumulated knowledge becomes an active force.",
  "Подготовка к завершению цикла: освобождение от долгов, старых обид и ненужных вещей, духовная и физическая уборка.": "Preparation for the cycle's completion: release debts, old grievances, and unnecessary possessions through spiritual and physical cleansing.",
  "Обращение к прошлому. Время вспоминать предков и наставников, благодарить их и подводить исторические итоги года.": "A return to the past. A time to remember ancestors and mentors, thank them, and draw the year's historical conclusions.",
  "Время уединения, медитации и глубокого внутреннего покоя, когда внешняя активность уступает место вниманию к себе.": "A time of solitude, meditation, and deep inner stillness, when outward activity gives way to inward attention.",
  "Окончательная точка цикла: завершение начатого, подведение итогов и освобождение пространства перед новым рождением.": "The final point of the cycle: complete what was begun, take stock, and clear space before a new birth.",
  "Сакральная пауза перед новым циклом. Период неопределённости и творческого хаоса, когда старые правила уже не действуют, а новые ещё не проявились.": "A sacred pause before the next cycle. A period of uncertainty and creative chaos, when old rules no longer work and new ones have not yet appeared.",
  "В системе GENESIS это магический «женский» год: его внутренняя ткань определяется не месяцами и неделями солнечного года, а ростом, полнотой и исходом Луны. Весеннее равноденствие служит только ежегодной точкой настройки; условия для практик рождаются внутри самих лунных месяцев и потому не привязаны к григорианскому делению года.": "In GENESIS this is a magical ‘feminine’ year: its inner fabric is defined not by the months and weeks of the solar year, but by the Moon's growth, fullness, and outflow. The spring equinox serves only as an annual anchor; conditions for practices arise within the lunar months themselves and are not tied to the Gregorian division of the year.",
  "Это современная символическая система GENESIS, а не реконструкция единого древнегреческого календаря. Её античная опора — образ Селены как небесного знака для людей и полнота Луны в середине месяца в Гомеровом гимне; греческие лунно-солнечные календари действительно удерживали месяцы рядом с сезонами при помощи вставочного месяца.": "This is a modern symbolic GENESIS system, not a reconstruction of one universal ancient Greek calendar. Its ancient grounding is Selene as a heavenly sign for mortals and the Moon's mid-month fullness in the Homeric Hymn; Greek lunisolar calendars did keep lunar months aligned with the seasons by intercalating a month.",
  "Григорианский календарь (профанский)": "Gregorian calendar (profane)",
  "Григорианский календарный месяц с неделями с воскресенья по субботу. В каждом дне дополнительно показаны покровители дня, сакральная дата, лунные сутки, рассвет и закат.": "A Gregorian calendar month with weeks from Sunday through Saturday. Each day also shows its divine patrons, sacred date, lunar day, sunrise, and sunset.",
  "Лунный месяц начинается новолунием. Основной ритм образуют лунные сутки; рядом остаются видимыми григорианская и сакральная даты. Лунный год начинается с первого новолуния после весеннего равноденствия.": "A lunar month begins at the new moon. Lunar days form its primary rhythm, while Gregorian and sacred dates remain visible. The lunar year begins with the first new moon after the spring equinox.",
  "Современный григорианский календарь — профанская гражданская система с многослойной историей. Его месяцы и счёт года унаследованы от Рима. Предпосылки семидневной недели восходят к Древнему Вавилону: вавилонская астрология придала особое значение семи видимым небесным светилам. В Рим семидневный ритм пришёл по двум линиям — иудейской субботней и греко-римской планетарной. В античном мире дни недели получили небесных покровителей — Солнце, Луну, Марс, Меркурий, Юпитер, Венеру и Сатурн, — и так ещё в древности сложился сакральный образ каждого дня. Традиция отмечать Новый год 1 января тоже пришла из Рима и не была изобретена одним человеком. Январь связывали с Янусом, богом дверей, переходов и начал. В 153 году до н. э. вступление консулов в должность перенесли на этот день, чтобы они раньше отправились на войну в Испании; поскольку годы называли именами консулов, 1 января стало гражданским началом года, а реформа Юлия Цезаря закрепила эту традицию. В 1582 году папа Григорий XIII ввёл названную его именем реформу, чтобы исправить накопившееся смещение юлианского календаря и вернуть весеннее равноденствие к церковному расчёту Пасхи. Поэтому современный календарь соединяет вавилонско-иудейское, греко-римское, римское гражданское и христианско-церковное наследие. В символической системе GENESIS покровителем этого летоисчисления выступает Кронос — образ времени, меры, предела и неумолимого хода циклов. Суббота здесь понимается как сакральный день обязательного покоя: время прекращать обычный труд, восстанавливать тело и возвращаться к внутренней тишине. Эта практика созвучна иудейскому Шаббату — седьмому дню, когда предписано воздерживаться от работы и посвящать день Богу.": "The modern Gregorian calendar is a profane civil system with a layered history. Its months and reckoning of the year were inherited from Rome. The roots of the seven-day week reach back to ancient Babylon: Babylonian astrology gave special significance to the seven visible celestial bodies. The seven-day rhythm reached Rome through two traditions: the Jewish Sabbath week and the Greco-Roman planetary week. In the ancient world, weekdays acquired celestial patrons—the Sun, Moon, Mars, Mercury, Jupiter, Venus, and Saturn—and the sacred character of each day began to take shape. The tradition of celebrating New Year on January 1 also came from Rome and was not invented by one person. January was associated with Janus, the god of doorways, transitions, and beginnings. In 153 BCE, the consuls' accession to office was moved to that date so they could depart earlier for the war in Hispania; because years were named after consuls, January 1 became the beginning of the civil year, and Julius Caesar's reform established the tradition. In 1582, Pope Gregory XIII introduced the reform named after him to correct the accumulated drift of the Julian calendar and restore the vernal equinox for the ecclesiastical calculation of Easter. The modern calendar therefore unites Babylonian-Jewish, Greco-Roman, Roman civil, and Christian ecclesiastical heritage. In the symbolic system of GENESIS, Cronus serves as the patron of this chronology—the image of time, measure, limits, and the inexorable course of cycles. Saturday is understood here as a sacred day of obligatory rest: a time to cease ordinary work, restore the body, and return to inner stillness. This practice resonates with the Jewish Shabbat—the seventh day on which work is set aside and the day is devoted to God.",
  "День Аполлона": "Day of Apollo",
  "День Луны — Селены, Гекаты и Артемиды": "Day of the Moon — Selene, Hecate, and Artemis",
  "День Ареса": "Day of Ares",
  "День Гермеса": "Day of Hermes",
  "День Зевса и Геры": "Day of Zeus and Hera",
  "День Афродиты, Гестии и Диониса": "Day of Aphrodite, Hestia, and Dionysus",
  "День Кроноса, Аида и Посейдона": "Day of Cronus, Hades, and Poseidon",
  "Аполлон": "Apollo",
  "Артемида и Геката": "Artemis and Hecate",
  "Арес": "Ares",
  "Гермес": "Hermes",
  "Зевс и Гера": "Zeus and Hera",
  "Гестия, Афродита и Дионис": "Hestia, Aphrodite, and Dionysus",
  "Аид, Посейдон и Кронос": "Hades, Poseidon, and Cronus",
  "День Света и Прозрения": "Day of Light and Insight",
  "Начало цикла. Чистое видение цели и стратегии на неделю.": "The beginning of the cycle. Clear vision of the goal and the week's strategy.",
  "Фа-ос. Лю-кей-ос": "Pha-os. Ly-kei-os",
  "Свет и Светозарный.": "Light and the Radiant One.",
  "День Границы и Перекрёстка": "Day of the Boundary and Crossroads",
  "Защита пространства и инстинктивная мудрость выбора пути.": "Protecting one's space and the instinctive wisdom to choose a path.",
  "Аг-не. Три-о-дос": "Hag-ne. Tri-o-dos",
  "Или — Э-ка-тэ.": "Or — He-ka-te.",
  "Чистая и Богиня Трёх Дорог.": "The Pure One and the Goddess of Three Roads.",
  "День Натиска и Воли": "Day of Drive and Will",
  "День активной реализации, жёсткого тайм-менеджмента, мощных тренировок и битвы.": "A day of active execution, rigorous time management, powerful training, and battle.",
  "Ор-ме. Кра-тай-а": "Hor-me. Kra-tai-a",
  "Стремительный натиск и Несокрушимая мощь.": "Swift drive and Unbreakable might.",
  "День путешествий и переговоров": "Day of Travel and Negotiation",
  "Работа с коммуникациями, деловые встречи, переговоры и торги.": "Communication work, business meetings, negotiations, and trade.",
  "Ло-гос. Эн-ной-а": "Lo-gos. En-noi-a",
  "Слово и Чёткий замысел.": "Word and Clear intention.",
  "День Власти и Суверенитета": "Day of Power and Sovereignty",
  "День расширения влияния и утверждения своего авторитета. Также — переговоры.": "A day for expanding influence and asserting authority. Also a day for negotiations.",
  "Так-сис. Ба-си-лей-а": "Tak-sis. Ba-si-lei-a",
  "Порядок и Абсолютное царствование.": "Order and Absolute sovereignty.",
  "День любви и очага": "Day of Love and the Hearth",
  "День семьи, эстетики и выхода за пределы ума. Для одних Гестия и Афродита — близость и любовь. Для других — Дионис, экстаз, страсть и опьянение.": "A day of family, aesthetics, and moving beyond the mind. For some, Hestia and Aphrodite mean intimacy and love. For others, Dionysus means ecstasy, passion, and intoxication.",
  "Э-дра. Мюс-те-ри-он": "He-dra. Mys-te-ri-on",
  "Основание и Сакральная тайна.": "Foundation and Sacred mystery.",
  "День Памяти, Времени и Денег": "Day of Memory, Time, and Money",
  "День тишины, покоя и связи с предками. Работа с энергией Сатурна — временем и материальными ресурсами.": "A day of silence, rest, and connection with the ancestors. Work with Saturn's energy — time and material resources.",
  "Ба-тос. Ай-о-ни-а": "Ba-thos. Ai-o-ni-a",
  "Бездна и Вечная.": "Abyss and the Eternal.",
  "Покровители дня": "Patrons of the day",
  "Воскресенье": "Sunday",
  "Понедельник": "Monday",
  "Вторник": "Tuesday",
  "Среда": "Wednesday",
  "Четверг": "Thursday",
  "Пятница": "Friday",
  "Суббота": "Saturday",
  "Клик по дню открывает задачи, сакральное значение, фазу Луны, точное время рассвета и заката для региона устройства.": "Select a day to open its tasks, sacred meaning, Moon phase, and regional sunrise and sunset times.",
  "Выбор языка": "Choose a language",
  "Админ-панель": "Admin panel",
  "Закрыть админ-панель": "Close admin panel",
  "Не удалось загрузить данные": "Could not load data",
  "Пользователей:": "Users:",
  "Задач:": "Tasks:",
  "Проектов:": "Projects:",
  "Загрузок Android:": "Android downloads:",
  "Устройств с отчётом:": "Reporting devices:",
  "Скачиваний:": "Downloads:",
  "Устройств:": "Devices:",
  "Удалить пользователя": "Delete user",
  "Удалить пользователя?": "Delete user?",
  "Данные пользователя будут удалены без возможности восстановления.": "The user's data will be deleted permanently.",
  "Заблокировать повторный вход": "Block future sign-in",
  "Не удалось удалить пользователя": "Could not delete user",
  "Место для восхода и заката": "Sunrise and sunset location",
  "Страна и город определяют координаты и местное время": "Country and city determine coordinates and local time",
  "Город не выбран. Время с символом ≈ рассчитано приблизительно по часовому поясу.": "No city selected. Times marked ≈ are approximate estimates based on the time zone.",
  "Город, страна": "City, country",
  "Город не найден. Уточните название и страну.": "City not found. Specify the city and country.",
  "Не удалось найти город. Проверьте подключение.": "Could not find the city. Check your connection.",
  "Ищем…": "Searching…",
  "Найти город": "Find city",
  "Сбросить выбор города": "Reset city selection",
  "Рассвет и закат ·": "Sunrise and sunset ·",
  "время выбранного города": "selected city's local time",
  "время устройства": "device time",
  "Координаты выбранного города": "Selected city's coordinates",
  "координаты выбранного города": "selected city's coordinates",
  "Приблизительный расчёт по часовому поясу устройства": "Approximate estimate based on the device time zone",
  "приблизительный расчёт для региона устройства": "approximate estimate for the device region",
  "Восход и закат": "Sunrise and sunset",
  "Местоположение": "Location",
  "Выберите страну и город. Время будет рассчитано для его координат и местного часового пояса.": "Choose a country and city. Times are calculated for its coordinates and local time zone.",
  "Выбрано:": "Selected:",
  "Город не выбран: время с символом ≈ приблизительно.": "No city selected: times marked ≈ are approximate.",
  "Найденные города": "Found cities",
  "Сбросить город": "Reset city",
  "Календар задатака и пројеката": "Task and project calendar",
  "Календар завдань і проєктів": "Task and project calendar",
};

const englishCatalog: Record<string, string> = {
  ...(englishTranslations as Record<string, string>),
  ...curatedTranslations,
  ...englishYear,
};

const catalogs: Record<Exclude<Language, "ru">, Record<string, string>> = {
  en: englishCatalog, el: { ...greekTranslationsA, ...greekTranslationsB, ...greekYear }, de: { ...germanTranslations, ...germanYear },
  fr: { ...frenchTranslations, ...frenchYear }, es: { ...spanishTranslations, ...spanishYear }, it: { ...italianTranslations, ...italianYear }, pt: { ...portugueseTranslations, ...portugueseYear },
  pl: { ...polishTranslations, ...polishYear }, sr: { ...serbianTranslationsA, ...serbianTranslationsB, ...serbianYear },
  uk: { ...ukrainianTranslationsA, ...ukrainianTranslationsB, ...ukrainianYear },
  zh: { ...chineseTranslations, ...chineseYear }, tr: { ...turkishTranslations, ...turkishYear }, ja: { ...japaneseTranslations, ...japaneseYandexTranslations, ...japaneseYear },
};
const yearCatalogs: Record<Exclude<Language, "ru">, Record<string, string>> = {
  en: englishYear, el: greekYear, de: germanYear, fr: frenchYear, es: spanishYear,
  it: italianYear, pt: portugueseYear, pl: polishYear, sr: serbianYear,
  uk: ukrainianYear, zh: chineseYear, tr: turkishYear, ja: japaneseYear,
};

export function lunarYearStartText(date: string, months: number, language: Language): string {
  const template = language === "ru"
    ? "Год начинается {date} — в день первого точного новолуния после весеннего равноденствия — и включает {months} лунных месяцев по 29 или 30 суток."
    : yearCatalogs[language].__lunarStartTemplate;
  return template.replace("{date}", date).replace("{months}", String(months));
}
const englishToRussian = new Map(Object.entries(englishCatalog).map(([ru, en]) => [en, ru]));
const partialTranslations = Object.fromEntries(Object.entries(catalogs).map(([language, catalog]) => [
  language,
  Object.entries(catalog)
    .filter(([source, translated]) => source.length >= 4 && source.length <= 180 && source !== translated)
    .sort(([left], [right]) => right.length - left.length),
])) as Record<Exclude<Language, "ru">, [string, string][]>;

let runtimeLanguage: Language = "ru";
const subscribeHydration = () => () => undefined;

const BUILT_IN_CATEGORY_NAMES: Record<string, { ru: string; en: string }> = {
  personal: { ru: "Личное", en: "Personal" },
  work: { ru: "Работа", en: "Work" },
  health: { ru: "Тело и здоровье", en: "Body and health" },
};

type RenderRecord = { source: string; rendered: string };
const textRecords = new WeakMap<Text, RenderRecord>();
const attributeRecords = new WeakMap<Element, Map<string, RenderRecord>>();

function normalizedText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function preserveOuterWhitespace(source: string, translated: string) {
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

export function normalizeLanguage(value: unknown): Language {
  return isLanguage(value) ? value : "ru";
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

export function browserLanguage(): Language {
  if (typeof window === "undefined") return "ru";
  const requested = new URLSearchParams(window.location.search).get("lang");
  if (requested && (LANGUAGES as readonly string[]).includes(requested)) return requested as Language;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && (LANGUAGES as readonly string[]).includes(stored)) return stored as Language;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const country = window.navigator.languages
    .map((locale) => locale.split("-").at(-1))
    .find((region) => region?.length === 2);
  return languageForRegion(timeZone, country);
}

export function storeLanguage(language: Language) {
  if (typeof window !== "undefined") window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export function setRuntimeLanguage(language: Language) {
  runtimeLanguage = language;
}

export function getRuntimeLanguage() {
  return runtimeLanguage;
}

export function localizeCategoryName(category: { id: string; name: string }, language: Language = runtimeLanguage) {
  const builtInNames = BUILT_IN_CATEGORY_NAMES[category.id];
  if (!builtInNames || !Object.values(builtInNames).includes(category.name)) return category.name;
  return language === "ru" ? builtInNames.ru : catalogs[language][builtInNames.ru] ?? builtInNames.en;
}

export function runtimeLocale() {
  return ({ ru: "ru-RU", en: "en-US", el: "el-GR", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT", pt: "pt-PT", pl: "pl-PL", sr: "sr-RS", uk: "uk-UA", zh: "zh-CN", tr: "tr-TR", ja: "ja-JP" })[runtimeLanguage];
}

export function translateText(source: string, language: Language = runtimeLanguage, allowPartial = false) {
  if (language === "ru") return source;
  const normalized = normalizedText(source);
  const catalog = catalogs[language];
  const russianSource = CYRILLIC.test(normalized) ? normalized : englishToRussian.get(normalized);
  const exact = russianSource ? catalog[russianSource] : undefined;
  if (exact) return preserveOuterWhitespace(source, exact);
  if (!allowPartial || !CYRILLIC.test(normalized)) return source;

  let translated = normalized;
  let changed = false;
  for (const [fragment, replacement] of partialTranslations[language]) {
    if (!translated.includes(fragment)) continue;
    translated = translated.replaceAll(fragment, replacement);
    changed = true;
  }
  // A partial match must never leave a half-translated Russian phrase behind.
  // This is especially important for sacred-day names: until a complete entry
  // exists in the catalogue, keep the original wording intact.
  return changed && !CYRILLIC.test(translated) ? preserveOuterWhitespace(source, translated) : source;
}

function localizeTextNode(node: Text, language: Language) {
  const current = node.data;
  let record = textRecords.get(node);
  if (!record || current !== record.rendered) {
    record = { source: current, rendered: current };
    textRecords.set(node, record);
  }
  const rendered = translateText(record.source, language, true);
  record.rendered = rendered;
  if (node.data !== rendered) node.data = rendered;
}

function localizeAttribute(element: Element, attribute: string, language: Language) {
  const current = element.getAttribute(attribute);
  if (current === null) return;
  let records = attributeRecords.get(element);
  if (!records) {
    records = new Map();
    attributeRecords.set(element, records);
  }
  let record = records.get(attribute);
  if (!record || current !== record.rendered) {
    record = { source: current, rendered: current };
    records.set(attribute, record);
  }
  const rendered = translateText(record.source, language, true);
  record.rendered = rendered;
  if (current !== rendered) element.setAttribute(attribute, rendered);
}

function localizeTree(root: Node, language: Language) {
  if (root.nodeType === Node.TEXT_NODE) {
    localizeTextNode(root as Text, language);
    return;
  }
  if (!(root instanceof Element)) return;
  if (root.matches("script, style, [data-no-translate]")) return;
  TRANSLATABLE_ATTRIBUTES.forEach((attribute) => localizeAttribute(root, attribute, language));
  for (const child of root.childNodes) localizeTree(child, language);
}

export function useDocumentLanguage(language: Language) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  setRuntimeLanguage(hydrated ? language : "ru");

  useEffect(() => {
    runtimeLanguage = language;
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
    localizeTree(document.body, language);
    const headTimer = window.setTimeout(() => {
      document.title = PAGE_TITLES[language];
      const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (description) {
        description.content = language === "ru"
          ? "GENESIS — календарь задач и менеджер проектов с планом дня, напоминаниями и необязательной синхронизацией Google Calendar и Google Tasks."
          : language === "en" ? ENGLISH_DESCRIPTION : PAGE_TITLES[language];
      }
      const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (manifest) manifest.href = `${APP_BASE}/${language === "ru" ? "manifest.webmanifest" : "manifest.en.webmanifest"}`;
    }, 100);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          localizeTextNode(mutation.target as Text, language);
        } else if (mutation.type === "attributes") {
          localizeAttribute(mutation.target as Element, mutation.attributeName ?? "", language);
        } else {
          mutation.addedNodes.forEach((node) => localizeTree(node, language));
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });
    return () => {
      window.clearTimeout(headTimer);
      observer.disconnect();
    };
  }, [language]);
}
