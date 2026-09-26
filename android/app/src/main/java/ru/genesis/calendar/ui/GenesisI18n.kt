package ru.genesis.calendar.ui

import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.domain.SacredCatalog
import java.util.concurrent.ConcurrentHashMap

/** The web's reviewed English copy is bundled into the offline APK. */
val LocalGenesisLanguage = compositionLocalOf { "ru" }

private val nativeCopy = mapOf(
    "Настройки" to "Settings", "Задачи" to "Tasks", "Сон и настроение" to "Sleep & mood",
    "Новая привычка" to "New habit", "Обычные привычки" to "Habits",
    "Подборка" to "Suggestions", "Скрыть подборку" to "Hide suggestions",
    "Путь Героя и награды" to "Hero's path & rewards", "История отметок" to "Completion history",
    "Мои привычки" to "My habits", "Открыть путь и награды" to "Open path & rewards",
    "Свернуть путь" to "Collapse path", "Древо рангов, достижения и защита серии. Накопленный XP не тратится." to
        "Rank tree, achievements, and streak protection. Earned XP is never spent.",
    "Оставить изменения телефона" to "Keep phone changes", "Оставить изменения сайта" to "Keep website changes",
    "Оставить версию телефона?" to "Keep the phone version?", "Оставить версию сайта?" to "Keep the website version?",
    "Оставить на телефоне" to "Keep on phone", "Оставить на сайте" to "Keep on website",
    "Одно и то же поле изменено на сайте и на телефоне. Обычная синхронизация остановлена; обе копии сохранены." to
        "The same field changed on the website and phone. Automatic sync stopped; both copies are safe.",
    "Совпавшее поле на сайте будет заменено вашей локальной версией. Остальные изменения сайта сохранятся. Задачи Google это действие не затрагивает." to
        "The conflicting website field will use your phone version. Other website changes and Google tasks are preserved.",
    "Только совпавшие изменения телефона будут заменены версией сайта. Остальные ваши изменения и задачи Google сохранятся." to
        "Only conflicting phone changes will use the website version. Your other changes and Google tasks are preserved.",
    "ЕЖЕДНЕВНЫЙ РИТМ" to "DAILY RHYTHM", "Свободный день" to "A free day",
    "ГРИГОРИАНСКИЙ ДЕНЬ" to "GREGORIAN DAY", "ЛУННЫЙ ДЕНЬ" to "LUNAR DAY",
    "САКРАЛЬНЫЙ ДЕНЬ" to "SACRED DAY", "Открыть день и задачи" to "Open day and tasks",
    "ГРИГОРИАНСКИЙ КАЛЕНДАРЬ" to "GREGORIAN CALENDAR",
    "Воскресенье" to "Sunday", "Понедельник" to "Monday", "Вторник" to "Tuesday",
    "Среда" to "Wednesday", "Четверг" to "Thursday", "Пятница" to "Friday",
    "Суббота" to "Saturday", "Части тела:" to "Body parts:",
    "День Аполлона" to "Day of Apollo", "День Луны — Селены, Гекаты и Артемиды" to
        "Day of the Moon — Selene, Hecate, and Artemis", "День Ареса" to "Day of Ares",
    "День Гермеса" to "Day of Hermes", "День Зевса и Геры" to "Day of Zeus and Hera",
    "День Афродиты, Гестии и Диониса" to "Day of Aphrodite, Hestia, and Dionysus",
    "День Кроноса, Аида и Посейдона" to "Day of Cronus, Hades, and Poseidon",
    "К текущему месяцу" to "Current month", "Год" to "Year", "Календарь отображения" to "Display calendar",
    "Календарь ввода и повторений" to "Task & recurrence calendar",
    "Русский" to "Russian", "English" to "English", "Язык интерфейса" to "Interface language",
    "Личные данные сохраняются на этом устройстве до входа в аккаунт." to
        "Your data stays on this device until you sign in.",
    "Ежедневная практика, сон и настроение в одном защищённом пространстве." to
        "Daily practice, sleep and mood in one protected space.",
    "Защищённая копия аккаунта GENESIS · изменения синхронизируются с сайтом" to
        "Protected GENESIS account copy · changes sync with the website",
    "Здесь появятся ваши практики. Выберите идею из подборки или создайте свою." to
        "Your practices will appear here. Pick a suggestion or create your own.",
    "XP открывает ступени ранга; Лавры можно тратить на защиту серии. Ранги не заменяют ваши привычки." to
        "XP unlocks ranks; Laurels can protect your streak. Ranks never replace your habits.",
    // Native navigation and high-frequency actions.
    "Сегодня" to "Today", "Все задачи" to "All tasks", "Задачи дня" to "Tasks for the day",
    "Проекты" to "Projects", "Календарь" to "Calendar", "Привычки" to "Habits",
    "Стойхейон" to "Stoicheion", "Теокиклос" to "Theokyklos", "Создать" to "Create",
    "Закрыть" to "Close", "Отмена" to "Cancel", "Сохранить" to "Save", "Изменить" to "Edit",
    "Удалить" to "Delete", "Обновить" to "Refresh", "Обновление…" to "Refreshing…",
    "Синхронизация аккаунта" to "Account sync", "Получаем изменения с сервера…" to
        "Getting changes from the server…", "Аккаунт GENESIS · защищённая локальная копия" to
        "GENESIS account · protected local copy", "Сохранено на устройстве" to "Saved on device",
    "Задач пока нет. Создайте первую запись." to "No tasks yet. Create your first entry.",
    "На сегодня задач нет. Можно оставить день свободным или создать задачу." to
        "There are no tasks today. Keep the day free or create a task.",
    "День свободен для нового замысла" to "The day is open for a new intention",
    "выполнено" to "completed", "Повторяется" to "Repeats", "Приоритет" to "Priority",
    "Проект" to "Project", "Без времени" to "No time",
    // Calendar task counters and day list.
    "Месяц" to "Month", "Открыть список." to "Open list.", "задач на" to "tasks on",
    "На этот день задач нет." to "There are no tasks on this day.",
    "Другой месяц, только просмотр" to "Adjacent month, view only",
    "Задачи дня ·" to "Tasks for the day ·", "И ещё" to "And",
    // Projects and drag destinations.
    "Хаос-бокс" to "Chaos box", "Категории жизни" to "Life categories", "Управлять" to "Manage",
    "Свернуть" to "Collapse", "Открыть" to "Open", "Добавить категорию" to "Add category",
    "В этом разделе пока нет проектов." to "There are no projects in this section yet.",
    "Создать задачу в проекте" to "Create a task in this project", "Изменить проект" to "Edit project",
    "Списки Google Tasks появятся здесь после подключения аккаунта." to
        "Google Tasks lists will appear here after you connect your account.",
    "Куда перенести задачу?" to "Move task to", "Найти проект" to "Find a project",
    "Переносим" to "Moving", "Отпустите задачу над нужным проектом" to
        "Release the task over the destination project", "В составе:" to "Inside:",
    "Удерживайте задачу и перетащите её в проект. Здесь можно вернуть задачу обратно." to
        "Press and hold a task, then drag it to a project. You can also return it here.",
    // Habits, hero path, rewards, and quests.
    "Свободный день" to "A free day", "Путь Героя" to "Hero's Path", "Серия" to "Streak",
    "Лавры" to "Laurels", "Ритм" to "Rhythm", "Добавить из библиотеки" to "Add from library",
    "Сегодня свободно" to "Free today", "Запланировано сегодня" to "Scheduled today",
    "На паузе" to "Paused", "РАСПИСАНИЕ" to "SCHEDULE", "ПРИОРИТЕТ" to "PRIORITY",
    "Качество выполнения" to "Completion quality", "Снять отметку" to "Remove completion",
    "Путь героических рангов" to "Heroic rank path", "Все ранги" to "All ranks",
    "Награды за серию" to "Streak rewards", "Все рубежи" to "All milestones",
    "Достижения" to "Achievements", "Открыть всю галерею" to "Open the full gallery",
    "Искра Гестии" to "Hestia's Spark", "Возвращение" to "Return", "Испытания" to "Quests",
    "Путь продолжается…" to "The path continues…", "За видимыми вратами скрывается продолжение." to
        "The path continues beyond the visible gate.", "Вы здесь" to "You are here",
    "Достигнут" to "Reached", "Впереди" to "Ahead", "Получено" to "Claimed", "Закрыто" to "Locked",
    // Sleep and mood.
    "Восстановление тела и эмоциональный ритм — отдельные наблюдения без оценки и давления." to
        "Body recovery and emotional rhythm are observations without judgment or pressure.",
    "Ритм восстановления" to "Recovery rhythm", "Сон" to "Sleep", "Настроение" to "Mood",
    "Нет записи" to "No entry", "Не выбрано" to "Not selected", "Пока не выбрано" to "Not selected yet",
    "Настроение дня" to "Mood of the day", "Выбрать настроение" to "Choose mood",
    "Изменить настроение" to "Change mood", "Планы и фактическое восстановление" to
        "Plans and actual recovery", "Добавить план" to "Add plan", "Активный план" to "Active plan",
    "Нет записи на выбранную дату" to "No entry for the selected date", "Засыпание" to "Fell asleep",
    "Пробуждение" to "Woke up", "Длительность" to "Duration", "Качество" to "Quality",
    "Отклонение от плана" to "Difference from plan", "Добавить запись" to "Add entry",
    "Изменить запись" to "Edit entry", "История наблюдений" to "Observation history",
    "План сна" to "Sleep plan", "Планируемое засыпание" to "Planned bedtime",
    "Планируемое пробуждение" to "Planned wake time", "План активен" to "Plan is active",
    "Оценивать качество" to "Track quality", "Сохранить план" to "Save plan",
    "Сохранить запись" to "Save entry", "Заметка" to "Note", "Заметка и контекст" to "Note and context",
    // Settings.
    "Календарь, время, приватность и напоминания" to "Calendars, time, privacy, and reminders",
    "Выбор сохраняется в аккаунте GENESIS" to "Saved to your GENESIS account",
    "Выбор хранится на этом устройстве" to "Saved on this device", "Календари и время" to "Calendars & time",
    "Отображение не меняет календарь ввода и повторений" to
        "Display choice does not change task input or recurrence", "Формат времени" to "Time format",
    "Управление картами без отключения алфавита" to "Control cards without disabling the alphabet",
    "Гадания по картам" to "Card divination", "Системные напоминания" to "System reminders",
    "Проверка разрешений и точности Android" to "Android permissions and timing accuracy",
    "Уведомления" to "Notifications", "Включены" to "On", "Выключены" to "Off",
    "Доставка" to "Delivery", "Точная" to "Exact", "Приблизительная" to "Approximate",
    "Канал задач" to "Task channel", "Настроить уведомления" to "Configure notifications",
    "Проверить расписание" to "Check schedule", "Вход, синхронизация и связанные Google-аккаунты" to
        "Sign-in, sync, and linked Google accounts", "Версия" to "Version",
    // Theokyklos and shared units.
    "Центр" to "Center", "Очаг" to "Hearth", "Вход" to "Entrance", "Выход" to "Exit",
    "Зенит" to "Zenith", "Надир" to "Nadir", "дн." to "days", "дней" to "days",
    "лавров" to "Laurels", " из " to " of ",
    // Remaining native-only copy. Longer fragments also cover interpolated counters and dates.
    "+ Своё напоминание" to "+ Custom reminder", "＋ План" to "＋ Plan",
    "◷ План ·" to "◷ Plan ·", "Лавров" to "Laurels", " проектов" to " projects",
    " категорий" to " categories", " привычек" to " habits", " отметок" to " completions",
    " задач в Хаос-боксе" to " tasks in the Chaos box", " повторений одной задачи" to " recurrences of one task",
    "-й день года" to " day of the year", " дней года" to " days in the year",
    " дней в месяце" to " days in the month", " освещённости" to " illuminated",
    "освещённость" to "illumination", " · сектор расклада" to " · spread sector",
    "СТИХИЯ" to "ELEMENT", "14 сил · направления · центр и порог" to "14 forces · directions · center and threshold",
    "Автоматически защитит один пропущенный день без XP и ложного выполнения." to
        "Automatically protects one missed day without XP or a false completion.",
    "В выбранном периоде нет дат для этого правила." to "This rule has no dates in the selected period.",
    "В облачном пространстве пока нет категорий. Будут использованы аккаунты по умолчанию." to
        "The cloud workspace has no categories yet. Default accounts will be used.",
    "В этот день часы переводятся: время неоднозначно или отсутствует. Используется совместимый с сайтом расчёт; проверьте запись." to
        "The clocks change on this day, so the time may be ambiguous or missing. A website-compatible calculation is used; check the entry.",
    "Возобновить" to "Resume", "Восемь направлений" to "Eight directions",
    "Время запланированного действия" to "Scheduled action time", "Все привычки →" to "All habits →",
    "Второй путь · за вратами" to "Second path · beyond the gate", "Вход в GENESIS" to "Sign in to GENESIS",
    "Выберите один или несколько аккаунтов для этой задачи." to "Choose one or more accounts for this task.",
    "Выбрано:" to "Selected:", "Выбрать без жеста" to "Choose without gesture", "Выйти" to "Sign out",
    "Выполнимое испытание появится, когда будет запланирована активная привычка." to
        "An achievable quest will appear once an active habit is scheduled.",
    "Дата относится к засыпанию. Если пробуждение не позже засыпания по часам, используется следующий день." to
        "The date belongs to bedtime. If the wake time is not later on the clock, the next day is used.",
    "Двенадцать двухчасовых периодов" to "Twelve two-hour periods",
    "Девять букв соотносятся со сторонами света и центром. Расклад начинается с карты дня и вашего движения." to
        "Nine letters correspond to the directions and center. The spread begins with the card of the day and your movement.",
    "Длительность:" to "Duration:", "Для задачи из списка Google Tasks напоминания здесь недоступны; они поддерживаются для событий Google Calendar." to
        "Reminders are unavailable here for Google Tasks items; they are supported for Google Calendar events.",
    "Дни месяца" to "Days of month", "Дни пяты" to "Days of the pyata", "Дни расписания" to "Schedule days",
    "Дополнительные Google-аккаунты подключаются через защищённый веб-поток. В браузере войдите в тот же кабинет GENESIS, затем вернитесь в приложение." to
        "Additional Google accounts use the secure web flow. Sign in to the same GENESIS account in the browser, then return to the app.",
    "Достигнутые рубежи сохраняются. Достижения не изменяют опыт ранга." to
        "Reached milestones are permanent. Achievements do not change rank XP.",
    "Доступный способ выбора для управления без движения пальцем." to "Accessible selection without a swipe gesture.",
    "За время до задачи" to "Before the task", "Задач без проекта пока нет." to "There are no unassigned tasks yet.",
    "Заклинания Божеств" to "Invocations of the Deities", "Запас:" to "Stock:", "Запись сна ·" to "Sleep entry ·",
    "Изменения проектов и привычек синхронизируются с зашифрованным пространством, задачи — с Google. При конфликте локальная копия сохраняется." to
        "Project and habit changes sync with the encrypted workspace; tasks sync with Google. The local copy is preserved during conflicts.",
    "Каждая награда начисляется один раз. Разрыв серии её не отнимает." to "Each reward is granted once. Breaking a streak does not remove it.",
    "Календарь повторения" to "Recurrence calendar", "Календарь расписания" to "Schedule calendar",
    "Карта дня и расклад скрыты настройкой. Буквы и значения остаются доступными." to
        "The daily card and spread are hidden in settings. Letters and meanings remain available.",
    "Карты дня и расклад можно скрыть; буквы и значения останутся доступны." to "Daily cards and spreads can be hidden; letters and meanings remain available.",
    "Категории появятся автоматически после загрузки зашифрованного пространства." to "Categories appear automatically after the encrypted workspace loads.",
    "Корневой" to "Root", "Коснитесь любого направления, полюса, очага, центра или врат." to
        "Tap any direction, pole, hearth, center, or gate.",
    "Круг божественных сил" to "Circle of divine forces", "Куда отправлять новые задачи" to "Where to send new tasks",
    "Купить Искру" to "Buy a Spark", "Максимум 500 повторений. Сократите период или выберите меньше дат." to
        "Maximum 500 recurrences. Shorten the period or choose fewer dates.",
    "Метки через запятую" to "Comma-separated labels", "Начать" to "Start", "Начать выбор карты дня" to "Choose today's card",
    "Начисление XP" to "XP award", "Не влияет на баллы. Без выбора запись не создаётся." to "Does not affect points. No entry is created without a selection.",
    "Не оценивать качество" to "Do not rate quality", "Не удалось открыть авторские карты. Данные не заменены." to "Could not open the original cards. Data was not replaced.",
    "Не удалось открыть каталог Теокиклоса." to "Could not open the Theokyklos catalog.",
    "Облако · версия" to "Cloud · version", "Обновить аккаунты" to "Refresh accounts", "Ограничить срок" to "Set an end date",
    "Один из 24 авторских образов на сегодня. Выбор сохраняется на этом устройстве." to "One of 24 original images for today. Your choice is saved on this device.",
    "Опыт ранга сохраняется навсегда и не тратится." to "Rank XP is permanent and is never spent.",
    "Ось, врата и ядро" to "Axis, gates, and core", "Отклонение от плана ·" to "Difference from plan ·",
    "Отключить аккаунт?" to "Disconnect account?", "Откройте метафизический профиль, прямое и перевёрнутое положение, практику и число." to
        "Open the metaphysical profile, upright and reversed meanings, practice, and number.",
    "Открываем защищённое пространство" to "Opening the protected workspace", "Открыть подключение на сайте" to "Connect on the website",
    "Открыть полный профиль" to "Open full profile", "Открыть продолжение пути" to "Open the next path",
    "Открыть сектор Теокиклоса →" to "Open Theokyklos sector →", "Отметка помогает увидеть закономерности и не влияет на XP или Лавры." to
        "The entry helps reveal patterns and does not affect XP or Laurels.",
    "Отправить в Google-аккаунты" to "Send to Google accounts", "Пауза" to "Pause", "План" to "Plan",
    "Повторить синхронизацию" to "Retry sync", "Пока нет плана сна. Создайте ориентир, затем отмечайте фактическое время." to
        "There is no sleep plan yet. Set a target, then record the actual time.",
    "После перезагрузки расписание восстанавливается после разблокировки; просроченные сигналы не повторяются." to
        "The schedule is restored after unlock following a reboot; missed alerts are not repeated.",
    "После Google-входа данные сайта и задачи Google открываются в отдельной защищённой копии. Локальные черновики не перезаписываются." to
        "After Google sign-in, website data and Google tasks open in a separate protected copy. Local drafts are never overwritten.",
    "Последнее возвращение:" to "Last return:", "Последняя защита:" to "Last protection:",
    "Проведите пальцем несколько раз. Движение создаёт зерно расклада." to "Swipe several times. Your movement creates the spread seed.",
    "Проверено:" to "Checked:", "Произносите каждое слово осознанно, переходя от смысла к звучанию." to "Speak each word consciously, moving from meaning to sound.",
    "РИТМ СУТОК · ВРЕМЯ УСТРОЙСТВА" to "DAILY RHYTHM · DEVICE TIME", "Сакральные привычки" to "Sacred habits",
    "Связанные аккаунты и правила отправки задач на сайте GENESIS." to "Linked accounts and task routing rules on the GENESIS website.",
    "СЗ · Север · СВ\nЗапад · Центр · Восток\nЮЗ · Юг · ЮВ" to "NW · North · NE\nWest · Center · East\nSW · South · SE",
    "Создать задачу без проекта" to "Create unassigned task", "Солнечные точки года" to "Solar points of the year",
    "Составлены из вашего активного ритма · награда — Лавры, не XP ранга" to "Built from your active rhythm · rewards are Laurels, not rank XP",
    "Состояние" to "Status", "Срок серии — не более пяти лет." to "A streak period cannot exceed five years.", "Ссылки GENESIS" to "GENESIS links",
    "Точная дата и время" to "Exact date and time", "Точное время напоминаний" to "Exact reminder timing", "Три ритма дня" to "Three rhythms of the day",
    "Убрать" to "Remove", "Уведомления и редактор правил баллов для сна пока не подключены." to "Sleep notifications and score-rule editing are not connected yet.",
    "Удалить привычку?" to "Delete habit?", "Укажите оба времени для расчёта длительности." to "Enter both times to calculate duration.",
    "Условие выполнено" to "Condition met", "Целое число" to "Whole number", "Часовой пояс · Europe/Moscow" to "Time zone · Europe/Moscow",
    "Числовое значение" to "Numeric value", "пифмен" to "digital root", "Числовые значения девяти букв складываются до корня от 1 до 9." to "The numeric values of the nine letters reduce to a root from 1 to 9.",
    "Этот год вне диапазона офлайн-календаря." to "This year is outside the offline calendar range.", "Этот период вне диапазона офлайн-календаря." to "This period is outside the offline calendar range.",
    "Android может задерживать сигналы. Проверьте разрешения GENESIS в настройках устройства." to "Android may delay alerts. Check GENESIS permissions in device settings.",
    "Google Tasks сообщил о неполной загрузке. Объединение пока недоступно." to "Google Tasks reported an incomplete load. Merging is unavailable for now.",
    "ⓘ Сон и настроение — личные наблюдения без XP и Лавров. Это не медицинская оценка." to "ⓘ Sleep and mood are personal observations without XP or Laurels. This is not medical advice.",
    " больше не будет связан с GENESIS. Уже созданные события и задачи останутся в Google." to
        " will no longer be linked to GENESIS. Existing events and tasks will remain in Google.",
    " · серия " to " · streak ", " дн." to " days", "-й из " to " of ", "Год " to "Year ",
    " ч " to " hr ", " мин" to " min", "Задачи сайта:" to "Website tasks:", " · списки:" to " · lists:",
    "Мин +" to "Min +", "Мин −" to "Min −", "Час +" to "Hour +", "Час −" to "Hour −",
    "Правила сохраняются в аккаунте сайта. Изменения задач Android отправляются в Google через GENESIS; если сеть недоступна, они остаются в защищённой очереди на устройстве." to
        "Rules are saved in your website account. Android task changes are sent to Google through GENESIS; when offline, they remain in the protected on-device queue.",
    "При создании задачи выберите один или несколько Google-аккаунтов. Пока правило не сохранено, используется прежняя маршрутизация." to
        "Choose one or more Google accounts when creating a task. Until the rule is saved, the previous routing remains active.",
    "ПЯТА" to "PYATA", "СТУПЕНЬ" to "STAGE", "Ступень" to "Stage", "Рекорд:" to "Record:", " · получено " to " · claimed ",
    "Сон:" to "Sleep:", " · настроение:" to " · mood:", " · награды:" to " · rewards:", " · испытания:" to " · quests:",
)

private object TranslationCatalog {
    @Volatile private var dictionary: Map<String, String>? = null
    @Volatile private var fragments: List<Map.Entry<String, String>> = emptyList()
    private val resolved = ConcurrentHashMap<String, String>()
    private val cyrillic = Regex("[А-Яа-яЁё]")

    private fun source(context: android.content.Context): Map<String, String> =
        dictionary ?: synchronized(this) {
            dictionary ?: runCatching {
                fun objectAsset(name: String): JSONObject = context.assets.open("originals/i18n/$name")
                    .bufferedReader().use { JSONObject(it.readText()) }
                val web = objectAsset("translations.en.json")
                val curated = objectAsset("curated-translations.en.json")
                val englishDays = context.assets.open("originals/i18n/calendar-days.en.json")
                    .bufferedReader().use { JSONArray(it.readText()) }
                val sacredDays = SacredCatalog.months.flatMap { it.days }
                require(englishDays.length() == sacredDays.size)
                buildMap {
                    web.keys().forEach { put(it, web.getString(it)) }
                    curated.keys().forEach { put(it, curated.getString(it)) }
                    sacredDays.forEachIndexed { index, day ->
                        val english = englishDays.getJSONObject(index)
                        put(day.name, english.getString("name"))
                        put(day.description, english.getString("description"))
                    }
                }
            }.getOrElse { emptyMap() }.also {
                fragments = (it + nativeCopy).entries.filter { entry -> entry.key.length in 4..180 }
                    .sortedByDescending { entry -> entry.key.length }
                dictionary = it
            }
        }

    fun translate(context: android.content.Context, text: String): String = resolved.getOrPut(text) {
        val translations = source(context)
        val normalized = text.trim()
        (nativeCopy[normalized] ?: translations[normalized])?.let { return@getOrPut it }
        if (!cyrillic.containsMatchIn(normalized)) return@getOrPut text
        var result = normalized
        for ((russian, english) in fragments) {
            if (!result.contains(russian)) continue
            result = result.replace(russian, english)
        }
        if (!cyrillic.containsMatchIn(result)) result else text
    }
}

@Composable
fun genesisTranslate(source: String): String {
    if (LocalGenesisLanguage.current != "en") return source
    val context = LocalContext.current
    return remember(source, context) { TranslationCatalog.translate(context, source) }
}

/** Local Text facade keeps the Android screens in step with the bundled web translation catalog. */
@Composable
fun Text(text: String, modifier: Modifier = Modifier, color: Color = Color.Unspecified,
    fontSize: TextUnit = TextUnit.Unspecified, fontStyle: FontStyle? = null,
    fontWeight: FontWeight? = null, fontFamily: FontFamily? = null,
    letterSpacing: TextUnit = TextUnit.Unspecified, textDecoration: TextDecoration? = null,
    textAlign: TextAlign? = null, lineHeight: TextUnit = TextUnit.Unspecified,
    overflow: TextOverflow = TextOverflow.Clip, softWrap: Boolean = true,
    maxLines: Int = Int.MAX_VALUE, minLines: Int = 1,
    onTextLayout: (TextLayoutResult) -> Unit = {}, style: TextStyle = LocalTextStyle.current) {
    androidx.compose.material3.Text(text = genesisTranslate(text), modifier = modifier,
        color = color, fontSize = fontSize, fontStyle = fontStyle, fontWeight = fontWeight,
        fontFamily = fontFamily, letterSpacing = letterSpacing, textDecoration = textDecoration,
        textAlign = textAlign, lineHeight = lineHeight, overflow = overflow, softWrap = softWrap,
        maxLines = maxLines, minLines = minLines, onTextLayout = onTextLayout, style = style)
}
