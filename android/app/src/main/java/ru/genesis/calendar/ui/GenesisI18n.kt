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
import android.util.Log
import ru.genesis.calendar.domain.SacredCatalog
import java.util.concurrent.ConcurrentHashMap

/** The web's reviewed English copy is bundled into the offline APK. */
val LocalGenesisLanguage = compositionLocalOf { "ru" }

private val nativeCopy = mapOf(
    "Для синхронизации привычки войдите в аккаунт Google." to "Sign in with Google to sync this habit.",
    "Подключите Google Tasks в настройках аккаунта." to "Connect Google Tasks in account settings.",
    "Подключите Google Calendar в настройках аккаунта." to "Connect Google Calendar in account settings.",
    "Для привычки не найдена ближайшая дата выполнения." to "No upcoming date was found for this habit.",
    "Привычка сохранена на устройстве. Синхронизация Google пока не завершена — повторите сохранение." to "The habit was saved on this device. Google sync is still pending; save again to retry.",
    "GENESIS является источником истины для этого повторения." to "GENESIS is the source of truth for this recurrence.",
    "Эмодзи привычки" to "Habit emoji",
    "Свой эмодзи" to "Custom emoji",
    "Главная привычка" to "Key habit",
    "В фокусе может быть только одна привычка. Дополнительный XP не начисляется." to "Only one habit can hold the focus. It never grants extra XP.",
    "Ритуал" to "Ritual",
    "Название группы" to "Group name",
    "Синхронизация с Google" to "Sync with Google",
    "Переносимая задача для следующего выполнения" to "A rolling task for the next occurrence",
    "Сначала подключите Google Tasks в настройках аккаунта" to "Connect Google Tasks in account settings first",
    "Показывать в Google Calendar" to "Show in Google Calendar",
    "Событие создаётся только по вашему выбору" to "An event is created only when you choose this",
    "Сначала подключите Google Calendar в настройках аккаунта" to "Connect Google Calendar in account settings first",
    "Раздел открыт." to "Section opened.",
    "Период выбран в календаре." to "Calendar period selected.",
    "Период переключён." to "Calendar period changed.",
    "Больше разделов в этом направлении нет." to "There are no more sections in that direction.",
    "Прокрутка голосом пока доступна в календаре." to "Voice scrolling is currently available in the calendar.",
    "Переключить календарь:" to "Switch calendar:",
    "Открыть год" to "Open year",
    "Следующий год" to "Next year",
    "Предыдущий год" to "Previous year",
    "Следующий месяц" to "Next month",
    "Предыдущий месяц" to "Previous month",
    "Свайп влево" to "Swipe left",
    "Свайп вправо" to "Swipe right",
    "Выбрать дату:" to "Select date:",
    "Выбрать месяц:" to "Select month:",
    "Прокрутить:" to "Scroll:",
    "Задача открыта." to "Task opened.",
    "Задача больше не найдена." to "Task was not found.",
    "Задача отмечена выполненной." to "Task marked complete.",
    "Отметка выполнения снята." to "Completion removed.",
    "Отмечаю привычку." to "Updating the habit.",
    "Перемещаю задачу." to "Moving the task.",
    "Открыта форма проекта." to "Project editor opened.",
    "Открыта форма списка задач." to "Task list editor opened.",
    "Открыты привычки." to "Habits opened.",
    "Не удалось определить название задачи." to "Could not identify the task title.",
    "Несколько задач создайте в режиме голосового набора." to "Create multiple tasks in voice dictation mode.",
    "Создаю задачи." to "Creating tasks.",
    "Задачи созданы." to "Tasks created.",
    "Привычка отмечена выполненной." to "Habit marked complete.",
    "Отметка привычки снята." to "Habit completion removed.",
    "Аккаунт изменился. Повторите команду." to "The account changed. Try the command again.",
    "Не удалось сохранить настроение." to "Could not save the mood.",
    "Записываю настроение." to "Recording mood.",
    "Отметить настроение:" to "Record mood:",
    "Название задачи изменено." to "Task renamed.",
    "Переименование задачи:" to "Rename task:",
    "Задача перемещена." to "Task moved.",
    "Проект создан." to "Project created.",
    "Привычка создана." to "Habit created.",
    "Выберите аккаунт для списка в форме создания." to "Choose an account for the list in the creation form.",
    "Список задач создан." to "Task list created.",
    "Пока не умею это делать. Попробуйте открыть раздел, создать задачу, проект, список или привычку." to "I cannot do that yet. Try opening a section or creating a task, project, list or habit.",
    "Основное" to "Basics",
    "Календарь и срок" to "Calendar and date range",
    "Повторение по лунному календарю" to "Lunar recurrence",
    "Время и напоминание" to "Time and reminder",
    "✨ Своё настроение" to "✨ Custom mood",
    "Название настроения" to "Mood name",
    "Свой смайлик" to "Your emoji",
    "Для аналитики используется выбранная оценка настроения; по умолчанию — нейтральная." to "The selected mood score is used for analytics; neutral by default.",
    "Название или смайлик слишком длинные." to "The mood name or emoji is too long.",
    "Укажите название и смайлик своего настроения." to "Enter a name and emoji for your mood.",
    "Не добавлять в список задач" to "Do not add to a task list",
    "Выберите список, если задача должна находиться среди его задач." to "Choose a list if this task belongs in it.",
    "Аккаунты для размещения" to "Accounts for this task",
    "Детали встречи" to "Meeting details",
    "Настройки Яндекс.Календаря" to "Yandex Calendar settings",
    "Напоминания" to "Reminders",
    "Свернуть ранги" to "Hide ranks",
    "Свернуть рубежи" to "Hide milestones",
    "Свернуть достижения" to "Hide achievements",
    "Все достижения" to "All achievements",
    "Режим: голосовой набор" to "Mode: voice dictation",
    "Включить управление приложением" to "Switch to app control",
    "Выполнить задачу" to "Complete task",
    "Снять отметку задачи" to "Remove task completion",
    "Выполнить привычку" to "Complete habit",
    "Снять отметку привычки" to "Remove habit completion",
    "Метки" to "Tags",
    "Аккаунт для размещения" to "Account for this list",
    "Дата задач" to "Task dates",
    "Дополнительные настройки задач" to "More task settings",
    "Голосовое управление включено" to "Voice control is on",
    "Служба распознавания Android может передавать аудио своему поставщику." to "Android's speech service may send audio to its provider.",
    "Выключить" to "Turn off",
    "Пока не умею это делать." to "I cannot do that yet.",
    "Не удалось выполнить команду. Проверьте название и дату." to "Could not run the command. Check the item name and date.",
    "Для изменения списка повторите вход." to "Sign in again to edit this list.",
    "Основной список Google Tasks нельзя изменять в GENESIS." to "The default Google Tasks list cannot be edited in GENESIS.",
    "Для удаления списка повторите вход." to "Sign in again to delete this list.",
    "Основной список Google Tasks удалить нельзя." to "The default Google Tasks list cannot be deleted.",
    "Начисление XP фиксируется при создании привычки. Для другой формулы создайте новую привычку." to "XP scoring is fixed when a habit is created. Create a new habit to use another formula.",
    "Выберите время уведомления до сна." to "Choose when to receive the sleep reminder.",
    "Проверьте правила баллов для сна." to "Check the sleep scoring rules.",
    "Декады" to "Decades",
    "Голосовой помощник" to "Voice assistant",
    "Для напоминания в точное время привычки включите время привычки выше." to "Set the habit time above to receive a reminder at that exact time.",
    "Повторение по сакральному календарю" to "Sacred calendar recurrence",
    "Чётная/нечётная" to "Even/odd",
    "Апейрон исключён из расписания" to "Apeiron is excluded from the schedule",
    "Дни внутри пяты" to "Days within a pyata",
    "🔒 Начисление XP зафиксировано при создании. Для другой формулы удалите привычку и создайте новую." to "🔒 XP scoring was fixed when this habit was created. Delete it and create a new habit for another formula.",
    "Выберите один или несколько сроков. Каждое уведомление приходит в 09:00 по времени устройства." to "Choose one or more lead times. Each notification arrives at 09:00 device time.",
    "Продиктуйте или напишите команду: создать задачу, проект или привычку, открыть редактирование, перенести задачу или перейти в раздел. Проверьте результат перед выполнением." to "Dictate or type a command to create a task, project or habit; edit an item; move a task; or open a section. Review it before applying.",
    "Команда" to "Command",
    "Не удалось определить действие. Уточните название или выберите поддерживаемую команду." to "Could not identify the action. Specify the item title or choose a supported command.",
    "Не удалось разобрать команду." to "Could not parse the command.",
    "Проверить" to "Preview",
    "Служба распознавания Android может передавать аудио своему поставщику. Написанные команды разбираются на устройстве." to "Android's speech service may send audio to its provider. Typed commands are parsed on this device.",
    "Открыть раздел:" to "Open section:",
    "Создать список задач:" to "Create task list:",
    "Открыть подтверждение удаления привычки:" to "Open habit deletion confirmation:",
    "Открыть подтверждение удаления задачи:" to "Open task deletion confirmation:",
    "Открыть подтверждение удаления списка:" to "Open task list deletion confirmation:",
    "Проверьте подтверждение удаления списка." to "Review the task list deletion confirmation.",
    "Проверьте подтверждение удаления." to "Review the deletion confirmation.",
    "Открыта форма категории." to "Category editor opened.",
    "Создать категорию:" to "Create category:",
    "Открыть подтверждение удаления проекта:" to "Open project deletion confirmation:",
    "Открыть подтверждение удаления категории:" to "Open category deletion confirmation:",
    "Открыть задачу для редактирования:" to "Open task editor:",
    "Перенести задачу:" to "Move task:",
    "Задачи к созданию:" to "Tasks to create:",
    "Укажите время для напоминания" to "Set a time for the reminder",
    "Напомнить за" to "Remind before",
    "мин" to "min",
    "Аккаунт изменился. Откройте помощника заново." to "The account changed. Reopen the assistant.",
    "Введите название задачи." to "Enter a task title.",
    "Не удалось сохранить все задачи. Оставшиеся задачи видны в списке." to "Could not save all tasks. The remaining tasks are still in the preview.",
    "Произнесите или напишите задачу." to "Speak or type a task.",
    "Произнесите или напишите название задачи." to "Speak or type a task title.",
    "будет удалена из проекта и всех разделов. Если задача повторяется, удалится вся серия." to "will be removed from the project and every section. If it repeats, the entire series will be removed.",
    "Изменить список" to "Edit list",
    "Удалить список" to "Delete list",
    "Изменить список задач" to "Edit task list",
    "Не удалось изменить список." to "Could not edit the list.",
    "Удалить список задач?" to "Delete task list?",
    "и \$count задач будут удалены. Это действие нельзя отменить." to "and \$count tasks will be deleted. This cannot be undone.",
    "» и " to "» and ",
    "задач будут удалены. Это действие нельзя отменить." to "tasks will be deleted. This cannot be undone.",
    "Список также удалится из Google Tasks." to "The list will also be deleted from Google Tasks.",
    "Не удалось удалить список." to "Could not delete the list.",
    "В Google Tasks список хранит название; заметки и дата сохраняются в задачах. Время и напоминание применяются GENESIS и подключённым календарём." to "Google Tasks stores a list title; notes and dates belong to tasks. GENESIS and a connected calendar handle times and reminders.",
    "Дополнительные поля для новых задач" to "Additional fields for new tasks",
    "Заметка к задачам · Google Tasks" to "Task notes · Google Tasks",
    "Напомнить до начала" to "Remind before start",
    "Напоминать о времени сна" to "Remind me about bedtime",
    "Когда уведомить" to "When to notify",
    "В момент сна" to "At bedtime",
    "Уведомления приходят по расписанию плана, если они разрешены в Android." to "Notifications follow the plan schedule when Android allows them.",
    "Баллы за сон" to "Sleep points",
    "Баллы начисляются за выполненные условия. Это аналитика сна, без XP и Лавров." to "Points are awarded for met conditions. This sleep metric does not affect XP or Laurels.",
    "Правило" to "Rule",
    "Не позже" to "No later than",
    "Баллы от −100 до 100" to "Points from −100 to 100",
    "＋ Добавить правило" to "＋ Add rule",
    "Дата настроения" to "Mood date",
    "Подключение для выбранного Яндекс-аккаунта" to "Connection for the selected Yandex account",
    "Несколько аккаунтов" to "Multiple accounts",
    "Связанные способы входа и правила отправки задач" to "Linked sign-in methods and task routing rules",
    "Связанные аккаунты" to "Linked accounts",
    "Задачи в GENESIS" to "Tasks in GENESIS",
    "Связанные аккаунты и правила отправки задач в GENESIS." to "Linked accounts and task routing rules in GENESIS.",
    "Дополнительные аккаунты подключаются в кабинете сайта. Если у них уже есть данные GENESIS, сайт попросит подтвердить объединение. Google остаётся отдельным." to
        "Add accounts in the website account panel. If they already have GENESIS data, the site will ask you to confirm the merge. Google stays separate.",
    "При создании задачи выберите один или несколько связанных аккаунтов. Пока правило не сохранено, используется прежняя маршрутизация." to
        "Choose one or more linked accounts when creating a task. The previous routing remains active until you save this rule.",
    "Правила сохраняются в GENESIS. Напоминания устройства остаются локальными; выбранный Яндекс.Календарь доставляет свои календарные уведомления. Аккаунты без календаря хранят задачи в GENESIS." to
        "Rules are saved in GENESIS. Device reminders stay local; the selected Yandex Calendar sends its own notifications. Accounts without a calendar store tasks in GENESIS.",
    "Безвременье" to "Timelessness",
    "Иллюстрации времён года" to "Season illustrations",
    "Выбор действует для григорианского и сакрального календарей. У Апейрона одна космическая иллюстрация для всех регионов. Источник региона выбирается выше; в григорианском календаре Южного полушария сезоны меняются местами." to
        "The choice applies to Gregorian and sacred calendars. Apeiron uses one cosmic illustration in every region. Choose the region source above; Gregorian seasons are reversed in the Southern Hemisphere.",
    "ВОЙТИ ЧЕРЕЗ:" to "SIGN IN WITH:",
    "Задачи синхронизируются через сервер GENESIS." to "Tasks sync through the GENESIS server.",
    "Защищённые данные и задачи GENESIS обновлены." to "Protected GENESIS data and tasks are up to date.",
    "Изменения задач пока не подтверждены сервером и сохранены на устройстве." to
        "Task changes are still waiting for the server and remain on this device.",
    "Список хранится в зашифрованном пространстве GENESIS; задачи синхронизируются через сервер GENESIS." to
        "The list is stored in the encrypted GENESIS workspace; tasks sync through GENESIS.",
    "Подробнее в политике конфиденциальности" to "Read the privacy policy",
    "Место хранения задач зависит от способа входа и подключения календаря" to
        "Task storage depends on your sign-in and calendar connection",
    "Выберите город для точного времени по его часовому поясу." to
        "Choose a city for accurate times in its local time zone.",
    "Введите минимум 2 буквы на своём языке или на английском и выберите город из подсказок." to
        "Type at least 2 letters in your language or English, then choose a suggestion.",
    // Calendar reference dialogs.
    "Григорианский календарь" to
        "Gregorian calendar",
    "Сакральный календарь" to
        "Sacred calendar",
    "Лунный календарь" to
        "Lunar calendar",
    "Гражданская система времени" to
        "Civil system of time",
    "Современный григорианский календарь — профанская гражданская система с многослойной историей. Его месяцы и счёт года унаследованы от Рима." to
        "The modern Gregorian calendar is a civil system with a layered history. Its months and year count came from Rome.",
    "Предпосылки семидневной недели восходят к Древнему Вавилону: вавилонская астрология придала особое значение семи видимым небесным светилам. В Рим семидневный ритм пришёл по двум линиям — иудейской субботней и греко-римской планетарной. Дни недели получили небесных покровителей — Солнце, Луну, Марс, Меркурий, Юпитер, Венеру и Сатурн." to
        "The seven-day week reaches back to Babylonian astrology and its seven visible heavenly bodies. Rome received that rhythm through the Jewish Sabbath and Greco-Roman planetary tradition, giving the weekdays their celestial patrons.",
    "Почему год начинается 1 января" to
        "Why the year begins on January 1",
    "Январь связывали с Янусом, богом дверей, переходов и начал. В 153 году до н. э. вступление консулов в должность перенесли на 1 января; поскольку годы называли именами консулов, этот день стал гражданским началом года. Реформа Юлия Цезаря закрепила традицию." to
        "January was linked to Janus, god of doors, transitions, and beginnings. In 153 BCE the consuls began office on January 1; because years were named for them, that day became the civil opening of the year. Julius Caesar's reform established the tradition.",
    "В 1582 году папа Григорий XIII ввёл названную его именем реформу, чтобы исправить накопившееся смещение юлианского календаря и вернуть весеннее равноденствие к церковному расчёту Пасхи." to
        "In 1582 Pope Gregory XIII introduced the reform that bears his name to correct the Julian drift and restore the spring equinox used in the Church's Easter calculation.",
    "Смысл в системе GENESIS" to
        "Meaning in GENESIS",
    "В символической системе GENESIS покровителем этого летоисчисления выступает Кронос — образ времени, меры, предела и неумолимого хода циклов." to
        "In GENESIS, Cronus presides over this chronology as an image of time, measure, limits, and the course of cycles.",
    "Суббота понимается как сакральный день обязательного покоя: время прекращать обычный труд, восстанавливать тело и возвращаться к внутренней тишине. Эта практика созвучна иудейскому Шаббату — седьмому дню, посвящённому Богу и свободному от работы." to
        "Saturday is a sacred day of rest: a time to stop ordinary work, restore the body, and return to inner quiet, resonating with the Jewish Sabbath.",
    "Живой ритм Луны" to
        "The living rhythm of the Moon",
    "Лунный год начинается в день первого точного новолуния после весеннего равноденствия и включает 12 или 13 лунных месяцев по 29 или 30 суток." to
        "The lunar year begins at the first exact new moon after the spring equinox and contains 12 or 13 lunar months of 29 or 30 days.",
    "В системе GENESIS это магический «женский» год: его внутренняя ткань определяется не месяцами и неделями солнечного года, а ростом, полнотой и исходом Луны. Весеннее равноденствие служит ежегодной точкой настройки; условия для практик рождаются внутри самих лунных месяцев." to
        "In GENESIS this is a magical feminine year, shaped by the Moon's growth, fullness, and waning rather than the months and weeks of the solar year. The spring equinox is its annual tuning point.",
    "Месяцы и сезоны" to
        "Months and seasons",
    "Каждый месяц начинается в точный момент новолуния. Его сутки следуют фазам Луны, а вставочный тринадцатый месяц при необходимости удерживает лунный круг рядом с солнечными сезонами." to
        "Each month begins at the exact new moon. Its days follow the Moon's phases, while an intercalary thirteenth month keeps the lunar cycle near the solar seasons when needed.",
    "Это современная символическая система GENESIS, а не реконструкция единого древнегреческого календаря. Её античная опора — образ Селены как небесного знака для людей и полнота Луны в середине месяца в Гомеровом гимне; греческие лунно-солнечные календари действительно удерживали месяцы рядом с сезонами при помощи вставочного месяца." to
        "This is a modern GENESIS symbolic system, not a reconstruction of a single ancient Greek calendar. It draws on Selene and the Moon's fullness at mid-month; Greek lunisolar calendars kept months near the seasons with an intercalary month.",
    "Солнечно-лунный календарь" to
        "Solar-lunar calendar",
    "Год GENESIS начинается в день весеннего равноденствия и раскрывается через двенадцать месяцев. Каждый месяц несёт собственный образ, цвет, стихию и смысл — не просто отрезок времени, а отдельную ступень годового пути." to
        "The GENESIS year begins on the spring equinox and unfolds through twelve months. Each month carries its own image, color, element, and meaning—a distinct stage of the annual path.",
    "В каждом месяце ровно 30 дней. Вместо привычных недель время собрано в шесть пят: коротких пятидневных ритмов, где нечётные и чётные пяты сменяют друг друга. Так солнечная мера года соединяется с живым лунным дыханием." to
        "Each month has exactly 30 days, arranged into six five-day rhythms instead of ordinary weeks. The solar measure of the year meets the living breath of the Moon.",
    "Равноденствия и солнцестояния образуют четыре праздничные опоры. После завершения двенадцатого месяца наступает Апейрон — несколько дней вне обычного счёта, пространство тишины перед новым весенним началом." to
        "The equinoxes and solstices form four festive supports. After the twelfth month comes Apeiron: several days outside ordinary counting, a quiet space before the new spring beginning.",
    "Сакральная геометрия времени" to
        "Sacred geometry of time",
    "Почему наш год начинается в день весеннего равноденствия? Почему в месяце ровно 30 дней, разбитых на 6 «пят» (пятидневок), а самих месяцев 12, плюс «скрытый» 13-й месяц?" to
        "Why does the year begin on the spring equinox? Why does each month contain 30 days arranged into six pentads, with twelve months plus a hidden thirteenth?",
    "Это не случайность. Это классическая сакральная геометрия времени, где каждый день — шаг в процессе эволюции духа. Разберём эту структуру через оптику античной теологии Пифагора, Гесиода и Гомера." to
        "This is sacred geometry of time, where every day is a step in the evolution of spirit. We can read it through Pythagoras, Hesiod, and Homer.",
    "Почему год начинается в весеннее равноденствие?" to
        "Why does the year begin at the spring equinox?",
    "20 марта — это точка преодоления инерции зимы. Это первый день месяца Арейос (Арес), время прорыва, отделения бытия от небытия и победы света над тьмой. 12 месяцев — полный солярный круг, совершенный цикл развития идеи от её зарождения весной до полного растворения в пустоте (Зофос) в конце зимы. Оставшиеся 5–6 дней года — Апейрон, время чистого Хаоса вне времени, когда старый мир рухнул, а новый ещё не рождён." to
        "March 20 overcomes winter's inertia and opens Areios. Twelve months complete the solar circle; the remaining five or six days are Apeiron, pure Chaos outside time between the old world and the unborn new one.",
    "Пентада: 5 стихий и геометрия восхождения" to
        "Pentad: five elements and the geometry of ascent",
    "Каждая Пята (5 дней) — микрокосм, отражающий процесс «Анабасиса», восхождения души от плотной материи к чистому свету. Дни идут в строгом порядке: Земля — Вода — Воздух — Огонь — Эфир." to
        "Each Pentad is a microcosm of the soul's ascent from dense matter to pure light: Earth, Water, Air, Fire, and Aether.",
    "Пифагор — геометрия плотности. Мир строится от стабильного к тонкому. Земля — статика (куб), Вода — текучесть, Воздух — форма. Огонь стоит выше Воздуха, потому что он активен и трансформирует элементы. Эфир — квинтэссенция, венец творения." to
        "Pythagoras gives a geometry of density: the world rises from stable Earth through Water and Air to transforming Fire and the quintessence of Aether.",
    "Гесиод — хронология творения. В «Теогонии» путь идёт от тяжести к сиянию: сначала Хаос и твёрдая Земля, затем Вода, Небо и чистый Свет. Огонь — инструмент богов, стоящий над стихиями." to
        "Hesiod gives a chronology of creation, moving from Chaos and solid Earth through Water and Sky to pure Light; Fire is the gods' transforming instrument.",
    "Гомер — раздел мира. Аид получил недра, Посейдон — море, Зевс — высокое небо. Движение всегда идёт снизу вверх. Успех любого дела требует пройти эти пять шагов: от «заземления» идеи до её «одухотворения» в эфире." to
        "Homer divides the world among the underworld, sea, and high sky. Every undertaking must pass these five steps, from grounding an idea to spiritualizing it in Aether.",
    "Гексада: 6 Пят и Куб Событий" to
        "Hexad: six Pentads and the Cube of Events",
    "Если Пята — инструмент стихий, то Гексада (число 6) — рамка времени, в которой этот инструмент действует. Шесть пят образуют 30 дней месяца." to
        "If the Pentad is the elemental instrument, the Hexad is its frame in time. Six Pentads form a 30-day month.",
    "Для пифагорейцев 6 — первое совершенное число (1 + 2 + 3 = 6), число сотворения мира и гармонии. Это также число граней куба, самой устойчивой фигуры. Шесть Пят — шесть сторон «событийного куба» месяца. Пока не пройдёшь все шесть, не увидишь объёмную картину." to
        "For the Pythagoreans, six is the first perfect number and the number of the cube's faces. Six Pentads are the six sides of the month's event cube; only the complete passage reveals the whole.",
    "У Гесиода это шесть поколений теогонии и веков творения. У Гомера — шесть граней эпического «Агона», пути героя." to
        "Hesiod sees six generations and ages of creation; Homer gives six faces to the heroic path.",
    "СПРАВОЧНАЯ ИНФОРМАЦИЯ" to
        "REFERENCE",
    "Подробнее о дне" to "More about the day",
    "Скрыть подробности" to "Hide details",
    "Выберите категорию, чтобы отфильтровать проекты." to "Choose a category to filter projects.",
    "Начало недели" to "Start of week",
    "Навигация на широком экране" to "Wide-screen navigation",
    "Альбомный режим телефона и планшеты" to "Landscape phones and tablets",
    "Отображение меню" to "Menu display",
    "Кнопки телефона, альбомного режима и планшета" to "Phone, landscape, and tablet controls",
    "Кнопки меню первого уровня" to "Primary menu buttons",
    "Иконки" to "Icons", "С текстом" to "With text",
    "Автопрокрутка в портретном режиме" to "Auto-scroll in portrait mode",
    "Медленное движение справа налево; удержание пальцем ставит его на паузу." to
        "Slow right-to-left motion; hold a finger on the menu to pause it.",
    "Справочная информация" to "Reference information",
    "Расположение меню первого уровня" to "Primary menu position",
    "Слева" to "Left", "Сверху" to "Top",
    "Настройка применяется автоматически при повороте экрана и на планшете." to
        "This setting applies automatically when the screen rotates and on tablets.",
    "Смахните влево или вправо" to "Swipe left or right",
    "Цвет" to "Colour",
    "Цвет HEX" to "HEX colour",
    "Формат: #RRGGBB" to "Format: #RRGGBB",
    "Палитра" to "Palette",
    "Свой цвет" to "Custom colour",
    "Оттенок" to "Hue",
    "Насыщенность" to "Saturation",
    "Яркость" to "Brightness",
    "Просрочено" to "Overdue",
    "Три ритма соединяются в центре" to "Three rhythms meet at the centre",
    "Не удалось удалить задачу. Повторите попытку." to "Could not delete the task. Try again.",
    "Для создания списка повторите вход через Google." to "Sign in with Google again to create a list.",
    "Подключите Google Tasks для выбранного аккаунта в настройках." to "Connect Google Tasks for the selected account in Settings.",
    "Аккаунт изменился. Откройте форму заново." to "The account changed. Open the form again.",
    "Без списка Google Tasks" to "No Google Tasks list",
    "Списки задач доступны в разделе «Задачи»." to "Task lists are available on the Tasks page.",
    "Списки задач" to "Task lists",
    "Списков пока нет. Создайте список и добавьте в него задачи." to "No lists yet. Create a list and add tasks to it.",
    "В списке пока нет задач." to "This list has no tasks yet.",
    "Задачу" to "Task",
    "Список хранится в Google Tasks и доступен на сайте и смартфоне." to "The list is stored in Google Tasks and is available on the website and your phone.",
    "Подключите Google Tasks и войдите в аккаунт в настройках." to "Connect Google Tasks and sign in to your account in Settings.",
    "Задачи списка · по одной в строке" to "List tasks · one per line",
    "Задачи списка" to "List tasks",
    "Дата задач · " to "Task date · ",
    "Добавьте до 100 задач, до 500 символов каждая." to "Add up to 100 tasks, with up to 500 characters each.",
    "Проверьте данные списка." to "Check the list details.",
    "Не удалось создать список. Проверьте подключение и повторите попытку." to "Could not create the list. Check your connection and try again.",
    "Список создан. Не удалось сохранить все задачи; повторите сохранение." to "The list was created. Some tasks could not be saved; try saving again.",
    "Сохраняем…" to "Saving…",
    "Сохранить задачи" to "Save tasks",
    "Действует независимо от общего напоминания о дневной цели. Для доставки нужно разрешение Android." to "Works independently of the general daily goal reminder. Android permission is required for delivery.",
    "Общие напоминания о дневной цели" to "General daily goal reminders",
    "Личные напоминания включаются внутри каждой привычки и работают независимо от этого переключателя." to "Personal reminders are enabled in each habit and work independently of this switch.",
    "Общие напоминания включены" to "General reminders are on",
    "Личные напоминания включены · общие выключены" to "Personal reminders are on · general reminders are off",
    "Напоминания не включены" to "Reminders are not enabled",
    "Повторите вход через Google для синхронизации. Данные и напоминания сохранены на устройстве." to "Sign in with Google again to sync. Your data and reminders are saved on this device.",
    "Локальная копия открыта. Повторите вход через Google для синхронизации; напоминания продолжают работать." to "Your local copy is open. Sign in with Google again to sync; reminders keep working.",
    "Продолжить вход через Google" to "Continue with Google",
    "Отметьте привычку в день выполнения." to "Mark the habit on the day you complete it.",
    "На этот день привычка не запланирована." to "The habit is not scheduled for this day.",
    "Не удалось сохранить тему. Повторите попытку." to "Could not save the theme. Try again.",
    "Выберите разное время для светлой и вечерней темы." to "Choose different start times for the light and evening themes.",
    "Оформление" to "Appearance", "Светлая" to "Light", "Вечерняя" to "Evening", "Как на устройстве" to "Match device",
    "Вечерняя тема использует мягкие оттенки и приглушённые акценты." to "The evening theme uses soft colours and muted accents.",
    "Менять по времени устройства" to "Switch by device time",
    "Светлая тема с " to "Light theme from ", "Вечерняя тема с " to "Evening theme from ",
    "Используются часы и часовой пояс смартфона." to "Uses your phone's clock and time zone.",
    "Для синхронизации повторите вход. Данные и напоминания доступны на устройстве." to "Sign in again to sync. Data and reminders remain available on this device.",
    "Открыть вход через Google" to "Open Google sign-in",
    "Действует отдельно от напоминания о дневной цели. При включении активирует уведомления привычек на устройстве." to "Separate from the daily goal reminder. Enabling it activates habit notifications on this device.",
    "На Samsung добавьте GENESIS в «Никогда не спящие приложения», если включено автоматическое ограничение фоновой работы." to "On Samsung, add GENESIS to Never sleeping apps if automatic background restrictions are enabled.",
    "Фоновая работа Samsung" to "Samsung background settings",
    "Android блокирует напоминания о привычках." to "Android is blocking habit reminders.",
    "Разрешите уведомления GENESIS, чтобы получать их при закрытом приложении." to "Allow GENESIS notifications to receive reminders when the app is closed.",
    "Разрешить уведомления" to "Allow notifications",
    "Отметки выполнения доступны в день практики." to "Completion can be recorded on the day of practice.",
    "После перезагрузки и возврата из настроек Android напоминания восстанавливаются автоматически." to "Reminders are restored automatically after a reboot or returning from Android settings.",
    "Открыта защищённая локальная копия. Проверяем связь с облаком…" to "Your protected local copy is open. Checking the cloud connection…",
    "Настройки сохранены на устройстве и ожидают синхронизации." to "Settings are saved on this device and waiting to sync.",
    "Практика дня" to "Daily practice", "Точное время привычки" to "Habit's exact time",
    "Выполнять в определённое время" to "Practice at a specific time",
    "Персональное напоминание" to "Personal reminder",
    "Действует отдельно от напоминания о дневной цели." to "Separate from the daily goal reminder.",
    "В точное время привычки" to "At the habit's scheduled time", "В отдельное время" to "At a separate time",
    "Время напоминания" to "Reminder time", "За сколько минут" to "Minutes before",
    "Разрешить это напоминание в тихие часы" to "Allow this reminder during quiet hours",
    "Каждая привычка напоминает о себе в выбранное время. Дневная цель настраивается отдельно; тихие часы можно переопределить для отдельной привычки." to
        "Each habit has its own reminder time. The daily goal is separate; quiet hours can be overridden for individual habits.",
    "Неделя года ·" to "Week of the year ·",
    "Трекер привычек" to "Habit tracker", "Привычки дня" to "Habits for the day",
    "На этот день привычек нет." to "There are no habits for this day.",
    "Открыть привычки" to "Open habits",
    "Не удалось сохранить отметку привычки. Повторите попытку." to "Could not save habit completion. Try again.",
    "Зима" to "Winter", "Весна" to "Spring", "Лето" to "Summer", "Осень" to "Autumn",
    "Загружаем задачи аккаунта…" to "Loading account tasks…",
    "Ожидаем загрузки задач аккаунта." to "Waiting for account tasks to load.",
    "Часть записей не удалось прочитать. Остальные задачи загружены; сохранённые записи не удалены." to
        "Some records could not be read. Other tasks were loaded; saved records have been preserved.",
    "Google не подтвердил полную загрузку задач. Проверьте подключение Calendar и Tasks в настройках." to
        "Google could not confirm a complete task download. Check Calendar and Tasks connections in settings.",
    "Не удалось загрузить задачи аккаунта. Нажмите «Обновить» для повторной попытки." to
        "Account tasks could not be loaded. Tap Refresh to try again.",
    "Получено с сервера:" to "Received from server:", "Задач на устройстве:" to "Tasks on this device:",
    "Календарь - месяц" to "Calendar - month", "Календарь - год" to "Calendar - year",
    "На этот день задач больше нет." to "There are no more tasks for this day.",
    "Вернуть в работу" to "Mark as incomplete", "Выполнить задачу" to "Complete task",
    "Редактировать" to "Edit",
    "ГРИГОРИАНСКИЙ МЕСЯЦ" to "GREGORIAN MONTH", "САКРАЛЬНЫЙ МЕСЯЦ" to "SACRED MONTH",
    "ВНЕ ВРЕМЕНИ" to "OUTSIDE TIME", "Начало ·" to "Start ·", "Конец ·" to "End ·",
    "Настройки" to "Settings", "Задачи" to "Tasks", "Сон и настроение" to "Sleep & mood",
    "Сакральные, григорианские и лунные даты, задачи и время Солнца" to
        "Sacred, Gregorian and lunar dates, tasks and solar times",
    "Все задачи, сроки, приоритеты и напоминания" to "Your tasks, due dates, priorities and reminders",
    "СЕГОДНЯ" to "TODAY", "Дата в гражданском календаре" to "Date in the civil calendar",
    "ДЕНЬ НЕДЕЛИ" to "DAY OF THE WEEK", "ДАТА" to "DATE", "НЕДЕЛЯ ГОДА" to "WEEK OF THE YEAR",
    "дней в этом месяце" to "days in this month", "-й день" to " day",
    "Ежедневные практики, цели, серии и прогресс" to "Daily practice, goals, streaks and progress",
    "Категории, проекты и задачи внутри них" to "Categories, projects and their tasks",
    "Двадцать четыре буквенных образа и их значения" to "Twenty-four Greek letters and their meanings",
    "Двадцать четыре буквенных образа, карта дня и расклад девяти ликов" to
        "Twenty-four Greek letters, the daily card and the nine-face spread",
    "Четырнадцать сил: направления, ось, центр и врата" to "Fourteen powers: directions, axis, center and gates",
    "Сон, восстановление и эмоциональный ритм без давления" to "Sleep, recovery and emotional rhythm without pressure",
    "Данные аккаунта и задачи Google обновлены." to "Account data and Google tasks are up to date.",
    "Пространство обновлено. Часть задач Google пока недоступна; сохранённые задачи остаются на устройстве." to
        "Workspace updated. Some Google tasks are temporarily unavailable; saved tasks remain on this device.",
    "Данные других устройств получены. Неотправленные изменения этого устройства сохранены." to
        "Changes from your other devices have been received. Unsent changes on this device are safe.",
    "Аккаунт открыт. Обновление задач пока не завершилось; повторим автоматически. Сохранённые записи доступны." to
        "Your account is open. Task refresh has not finished; it will retry automatically. Saved records are available.",
    "Google Calendar и Tasks подключены" to "Google Calendar and Tasks are connected",
    "Подключите синхронизацию Google" to "Connect Google sync",
    "разрешение выдано" to "permission granted", "нужно разрешение" to "permission required",
    "GENESIS запросит доступ отдельно от входа и сохранит токен фоновой синхронизации только на сервере." to
        "GENESIS requests service access separately from sign-in and stores the background sync token only on the server.",
    "Обновить разрешения" to "Refresh permissions", "Подключить Calendar и Tasks" to "Connect Calendar and Tasks",
    "Разрешить синхронизацию Google?" to "Allow Google sync?",
    "Открываем окно Google…" to "Opening Google…", "Обновить аккаунт" to "Refresh account",
    "GENESIS создаёт отдельный календарь и синхронизирует в нём события." to
        "GENESIS creates a separate calendar and synchronizes events in it.",
    "GENESIS показывает и изменяет ваши списки и задачи по вашим действиям." to
        "GENESIS displays and changes your lists and tasks when you ask it to.",
    "Продолжить" to "Continue", "Не сейчас" to "Not now",
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
    "Совпавшее поле на сайте будет заменено вашей локальной версией. Остальные изменения сайта сохранятся. Задачи это действие не затрагивает." to
        "The conflicting website field will use your phone version. Other website changes and tasks are preserved.",
    "Только совпавшие изменения телефона будут заменены версией сайта. Остальные ваши изменения и задачи сохранятся." to
        "Only conflicting phone changes will use the website version. Your other changes and tasks are preserved.",
    "ЕЖЕДНЕВНЫЙ РИТМ" to "DAILY RHYTHM", "Свободный день" to "A free day",
    "ГРИГОРИАНСКИЙ ДЕНЬ" to "GREGORIAN DAY", "ЛУННЫЙ ДЕНЬ" to "LUNAR DAY",
    "САКРАЛЬНЫЙ ДЕНЬ" to "SACRED DAY", "Открыть день и задачи" to "Open day and tasks",
    "Показать день в календаре" to "Show day in calendar", "Создать задачу" to "Create task",
    "ГРИГОРИАНСКИЙ КАЛЕНДАРЬ" to "GREGORIAN CALENDAR",
    "САКРАЛЬНЫЙ КАЛЕНДАРЬ" to "SACRED CALENDAR", "ЛУННЫЙ КАЛЕНДАРЬ" to "LUNAR CALENDAR",
    "СМЫСЛ ДНЯ" to "MEANING OF THE DAY", "САКРАЛЬНЫЙ КАЛЕНДАРЬ · СМЫСЛ ДНЯ" to
        "SACRED CALENDAR · MEANING OF THE DAY", "ПИФАГОРЕЙСКИЙ СМЫСЛ" to "PYTHAGOREAN MEANING",
    "Пята, стихия и пифагорейский смысл выбранного сакрального дня." to
        "The pentad, element, and Pythagorean meaning of the selected sacred day.",
    "Пространство первообразов" to "Realm of archetypes",
    "Иллюстрация сакрального дня:" to "Sacred day illustration:",
    "НОВОЛУНИЕ" to "NEW MOON", "ПОЛНОЛУНИЕ" to "FULL MOON",
    "ЛУННЫЙ МЕСЯЦ" to "LUNAR MONTH", "Гно · Метэр · Базилея" to "Gno · Meter · Basileia",
    "Планируйте задачи, проекты и повторяющиеся практики. Личное пространство синхронизируется с сайтом и вашими устройствами." to
        "Plan tasks, projects and recurring practices. Keep your private workspace synchronized across the web and your devices.",
    "БЕЗОПАСНЫЙ ВХОД ЧЕРЕЗ GOOGLE" to "SECURE SIGN-IN THROUGH GOOGLE",
    "Задачи остаются в Google и на вашем устройстве" to "Tasks stay in Google and on your device",
    "Личные данные открываются только после входа" to "Private data opens only after sign-in",
    "ПОЖИЗНЕННЫЙ ПРОГРЕСС" to "LIFETIME PROGRESS", "ТЕКУЩИЙ РАНГ" to "CURRENT RANK",
    "Каждый балл сохраняет реальное выполнение. XP не тратится, а достигнутые ранги не теряются." to
        "Every point records real completion. XP is never spent, and achieved ranks are never lost.",
    "XP до" to "XP to", "ВЫ ЗДЕСЬ" to "YOU ARE HERE", "ДОСТИГНУТ" to "REACHED",
    "ВПЕРЕДИ" to "AHEAD", "ГАРАНТИРОВАННАЯ НАГРАДА" to "GUARANTEED CHECKPOINT REWARD",
    "Восход" to "Sunrise", "закат" to "sunset", "Закат" to "Sunset",
    "Полярный день или ночь" to "Polar day or night",
    "Удалить проект" to "Delete project", "Удалить проект?" to "Delete project?",
    "Удалить проект «" to "Delete project “", "» и все его подпроекты? Задачи останутся, но перейдут в Хаос-бокс." to
        "” and all its subprojects? Tasks will be kept and moved to the Chaos box.",
    "Не удалось удалить проект." to "Could not delete the project.",
    "Не удалось удалить проект. Повторите попытку." to "Could not delete the project. Try again.",
    "Категория больше не существует." to "The category no longer exists.",
    "Удалить категорию?" to "Delete category?", "Не удалось удалить категорию." to "Could not delete the category.",
    "Не удалось удалить категорию. Повторите попытку." to "Could not delete the category. Try again.",
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
    "Выполнено" to "Completed", "Не выполнено" to "Incomplete",
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
    "Резерв" to "Backup", "событий" to "events", "Батарея" to "Battery",
    "Без оптимизации" to "Unrestricted", "Системный режим" to "System mode",
    "Каналы:" to "Channels:", "задачи" to "tasks", "привычки" to "habits",
    "включены" to "on", "выключены" to "off",
    "Точные системные сигналы дополнены резервной доставкой WorkManager. После перезагрузки, обновления и возврата из настроек расписание восстанавливается автоматически." to
        "Exact system alarms have a WorkManager delivery backup. The schedule is restored automatically after a reboot, update, or return from system settings.",
    "Последнее восстановление расписания ·" to "Last schedule recovery ·",
    "Проверить уведомление через 1 минуту" to "Test a notification in 1 minute",
    "Последняя проверка доставлена ·" to "Last test delivered ·",
    "Проверка назначена ·" to "Test scheduled ·",
    "Открыть системные настройки батареи" to "Open system battery settings",
    "Samsung: никогда не спящие приложения" to "Samsung: Never sleeping apps",
    "One UI может снова перенести редко используемое приложение в сон. После обновления Samsung проверьте, что GENESIS остаётся в списке «Никогда не спящие приложения»." to
        "One UI may put an infrequently used app to sleep again. After a Samsung update, check that GENESIS remains in Never sleeping apps.",
    "Принудительную остановку приложения Android не разрешает обходить. После неё откройте GENESIS один раз — расписание восстановится." to
        "Android does not allow apps to bypass Force stop. Open GENESIS once afterwards to restore the schedule.",
    "Работает" to "Working", "Требует внимания" to "Needs attention",
    "Системная доставка работает. GENESIS сможет напоминать при закрытом приложении." to
        "System delivery works. GENESIS can send reminders while the app is closed.",
    "GENESIS · Проверка уведомлений" to "GENESIS · Notification test",
    "Проверить расписание" to "Check schedule", "Вход, синхронизация и связанные Google-аккаунты" to
        "Sign-in, sync, and linked Google accounts", "Версия" to "Version",
    // Theokyklos and shared units.
    "Центр" to "Center", "Очаг" to "Hearth", "Вход" to "Entrance", "Выход" to "Exit",
    "Зенит" to "Zenith", "Надир" to "Nadir", "дн." to "days", "дней" to "days",
    "лавров" to "Laurels", " из " to " of ",
    // Remaining native-only copy. Longer fragments also cover interpolated counters and dates.
    "+ Своё напоминание" to "+ Custom reminder", "＋ План" to "＋ Plan",
    "＋ Создать план сна" to "＋ Create sleep plan",
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
    "Календарь привычки" to "Habit calendar",
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
    "Определяет повторение и вид дат этой привычки." to "Sets this habit's recurrence and date display.",
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
    "Подтвердите доступ к Календарю через Яндекс ID. Отдельный пароль не требуется." to
        "Approve Calendar access through Yandex ID. No separate password is needed.",
    "Свернуть путь и награды" to "Collapse the path and rewards", "Путь героя" to "Hero's path",
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
    // Authentication, cloud state, validation, and failure recovery.
    "Серверная сессия ещё не проверена." to "The server session has not been checked yet.",
    "Проверяем серверную сессию…" to "Checking the server session…",
    "На сервере нет активного входа." to "There is no active server sign-in.",
    "Сессия подтверждена; зашифрованное пространство прочитано." to "Session confirmed; the encrypted workspace was read.",
    "Готовим защищённый вход…" to "Preparing secure sign-in…",
    "Вход подтверждён. Облачные данные расшифрованы автоматически." to "Sign-in confirmed. Cloud data was decrypted automatically.",
    "Готовим разрешения Google Calendar и Tasks…" to "Preparing Google Calendar and Tasks permissions…",
    "Подтвердите доступ к Google Calendar и Tasks в окне Google." to "Confirm access to Google Calendar and Tasks in the Google window.",
    "Сохраняем разрешения Google…" to "Saving Google permissions…",
    "Подключение Google Calendar и Tasks отменено. Данные и прежние разрешения не изменены." to
        "Google Calendar and Tasks connection was canceled. Your data and existing permissions were not changed.",
    "Google сохранил часть разрешений. Недостающий сервис можно подключить отдельно." to
        "Google saved some permissions. You can connect the missing service separately.",
    "Открываем зашифрованное пространство…" to "Opening the encrypted workspace…",
    "Данные доступны в приложении." to "Your data is available in the app.",
    "Пространство открыто, но Google не подтвердил обновление задач. Ранее загруженные задачи сохранены." to
        "The workspace is open, but Google did not confirm the task refresh. Previously loaded tasks are preserved.",
    "Есть локальные изменения аккаунта, ещё не отправленные на сервер. Облачная копия не перезаписала их." to
        "This account has local changes that have not reached the server. The cloud copy did not overwrite them.",
    "Выбранный язык пока не сохранён в аккаунте; повторите выбор в личном кабинете." to
        "The selected language has not been saved to the account yet; choose it again in Settings.",
    "Выбор карты пока не обновлён; нажмите «Обновить» при восстановлении сети." to
        "The card selection has not been updated; tap Refresh when the connection returns.",
    "Вход выполнен, но загрузка облачных данных пока не завершилась. Локальные записи сохранены." to
        "You are signed in, but cloud data has not finished loading. Local records are preserved.",
    "Вход выполнен, но для этого пространства требуется код восстановления. Данные не перезаписаны." to
        "You are signed in, but this workspace requires a recovery code. No data was overwritten.",
    "Вход выполнен, но формат облачных данных не удалось проверить (CLOUD_FORMAT). Локальные записи сохранены." to
        "You are signed in, but the cloud data format could not be verified (CLOUD_FORMAT). Local records are preserved.",
    "Вход выполнен, но импорт облачных данных не завершён (CLOUD_IMPORT). Локальные записи сохранены." to
        "You are signed in, but cloud data import did not finish (CLOUD_IMPORT). Local records are preserved.",
    "Сохраняем маршрутизацию аккаунтов…" to "Saving account routing…",
    "Маршрутизация сохранена на сайте GENESIS." to "Routing was saved to your GENESIS account.",
    "Сохраняем настройку на сервере…" to "Saving the setting to the server…",
    "Настройка сохранена в аккаунте; локальная копия обновляется." to "The setting was saved to your account; the local copy is updating.",
    "Отключаем дополнительный аккаунт…" to "Disconnecting the additional account…",
    "Дополнительный аккаунт отключён; существующие события Google не удалены." to
        "The additional account was disconnected; existing Google events were not deleted.",
    "Закрываем серверную сессию…" to "Closing the server session…",
    "Вход закрыт. Локальные черновики сохранены." to "Signed out. Local drafts are preserved.",
    "Вход удалён с устройства. Отзыв серверной сессии не подтверждён; локальные черновики сохранены." to
        "Sign-in was removed from this device. Server-session revocation was not confirmed; local drafts are preserved.",
    "Поставщик Google недоступен для очистки состояния." to "The Google provider is unavailable for state cleanup.",
    "Сессия аккаунта завершилась. Повторите вход и выбор карты." to "The account session ended. Sign in and choose the card again.",
    "Слишком много запросов. Повторите выбор карты через минуту." to "Too many requests. Try choosing the card again in a minute.",
    "Нет подтверждения от сервера. Проверьте сеть; прежний выбор карты сохранён." to
        "The server did not confirm the request. Check your connection; the previous card selection is preserved.",
    "Карта уже изменилась на другом устройстве. Нажмите «Обновить»." to "The card was changed on another device. Tap Refresh.",
    "Сервер временно не сохранил карту. Повторите позже." to "The server could not save the card temporarily. Try again later.",
    "Не удалось безопасно синхронизировать карту с аккаунтом." to "The card could not be synced securely with your account.",
    "Конфликт зашифрованного пространства: данные устройства сохранены. Решите, какую версию оставить." to
        "Encrypted workspace conflict: the device data is preserved. Choose which version to keep.",
    "Для синхронизации нужен код восстановления пространства." to "A workspace recovery code is required for sync.",
    "Изменения проектов или привычек пока не подтверждены сервером и сохранены на устройстве." to
        "Project or habit changes have not been confirmed by the server and remain on this device.",
    "Изменения задач пока не подтверждены Google и сохранены на устройстве." to
        "Task changes have not been confirmed by Google and remain on this device.",
    "Синхронизировано:" to "Synced:", "изменений пространства." to "workspace changes.",
    "Проверка входа отменена." to "Sign-in check was canceled.",
    "Вход отменён. Локальные записи не изменены." to "Sign-in was canceled. Local records were not changed.",
    "Поставщик входа Google недоступен. Проверьте наличие Google Play services; локальные функции доступны." to
        "Google sign-in is unavailable. Check Google Play services; offline features remain available.",
    "Google не предоставил данные для входа. Проверьте аккаунт и настройки OAuth. Локальные функции доступны." to
        "Google did not provide sign-in data. Check the account and OAuth settings; offline features remain available.",
    "Данные сайта защищены кодом восстановления. Ничего не перезаписано; понадобится код из личного кабинета." to
        "Website data is protected by a recovery code. Nothing was overwritten; you will need the code from your account.",
    "Не удалось проверить зашифрованные данные сайта. Сессия и локальные записи сохранены; ничего не перезаписано." to
        "The encrypted website data could not be verified. The session and local records are preserved; nothing was overwritten.",
    "Google вернул ответ, который не удалось проверить. Обновите Google Play services и повторите вход." to
        "Google returned a response that could not be verified. Update Google Play services and sign in again.",
    "Google-вход не подтверждён. Проверьте сеть, Google Play services и OAuth-регистрацию этой Android-сборки." to
        "Google sign-in was not confirmed. Check the connection, Google Play services, and this Android build's OAuth registration.",
    "Проверяем вход через Яндекс…" to "Checking Yandex sign-in…",
    "Вход через Яндекс подтверждён. Защищённое пространство открыто." to
        "Yandex sign-in confirmed. Your protected workspace is open.",
    "Вход через Яндекс не завершён" to "Yandex sign-in was not completed",
    "Рекомендуется пользователям за пределами России" to "Recommended for users outside Russia",
    "Рекомендуется пользователям в России" to "Recommended for users in Russia",
    "После входа данные сайта открываются в отдельной защищённой копии. Локальные черновики не перезаписываются." to
        "After sign-in, website data opens in a separate protected copy. Local drafts are preserved.",
    "Защищённое пространство GENESIS" to "Protected GENESIS workspace",
    "Политика конфиденциальности" to "Privacy Policy",
    "Не удалось открыть политику конфиденциальности" to "Could not open the Privacy Policy",
    "Задачи и списки пока остаются на этом устройстве." to "Tasks and lists stay on this device for now.",
    "Проекты и привычки хранятся в защищённом пространстве GENESIS. Подключение Яндекс Календаря будет доступно отдельно." to
        "Projects and habits are stored in your protected GENESIS workspace. Yandex Calendar connection will be available separately.",
    "Защищённые данные GENESIS обновлены. Задачи остаются на устройстве." to
        "Protected GENESIS data was updated. Tasks remain on this device.",
    "Google не завершил выдачу разрешений Calendar/Tasks. Повторите подключение и выберите тот же аккаунт." to
        "Google did not finish granting Calendar/Tasks permissions. Try connecting again and choose the same account.",
    "Нативный вход ещё не опубликован на сервере. Локальные функции доступны." to
        "Native sign-in has not been published on the server yet. Offline features remain available.",
    "Сессия или запрос входа отклонены. Начните вход заново." to "The session or sign-in request was rejected. Start sign-in again.",
    "Слишком много попыток. Повторите вход через минуту." to "Too many attempts. Try signing in again in a minute.",
    "Нет подтверждения от сервера. Проверьте сеть и повторите." to "The server did not confirm the request. Check your connection and try again.",
    "Защищённая сессия на устройстве недоступна. Повторите вход; локальные записи не изменены." to
        "The secure on-device session is unavailable. Sign in again; local records were not changed.",
    "Данные изменились на другом устройстве. Обновите синхронизацию." to "Data changed on another device. Refresh sync.",
    "Сервер временно не может подтвердить вход. Повторите позже." to "The server cannot confirm sign-in temporarily. Try again later.",
    "Ответ сервера не прошёл проверку. Вход не подтверждён." to "The server response failed verification. Sign-in was not confirmed.",
    "Не удалось безопасно завершить проверку. Состояние Google сброшено; повторите вход. Код:" to
        "The check could not be completed securely. Google state was reset; sign in again. Code:",
    "Текущая сессия и локальные записи не изменены." to "The current session and local records were not changed.",
    "Веб-версия GENESIS" to "GENESIS web app", "Не удалось открыть ссылку в браузере." to "The link could not be opened in the browser.",
    // Repository validation messages can surface in forms and snackbars.
    "Введите название до 500 символов." to "Enter a name of up to 500 characters.",
    "Введите название плана до 500 символов." to "Enter a plan name of up to 500 characters.",
    "Привычка изменилась. Откройте её заново." to "The habit changed. Open it again.",
    "Привычка не найдена" to "Habit not found", "Сегодня привычка не запланирована." to "This habit is not scheduled today.",
    "Врата ещё закрыты." to "The gate is still locked.", "Неподдерживаемая версия локальных привычек" to "Unsupported local habits version",
    "Некорректный набор раскладов." to "Invalid set of spreads.", "Серверная синхронизация доступна после входа." to "Server sync is available after sign-in.",
    "Это не повторяющаяся задача." to "This is not a recurring task.", "Этот день не входит в серию." to "This day is not part of the series.",
    "В выбранном периоде нет дат повторения." to "There are no recurrence dates in the selected period.",
    "Серия может содержать не более 500 повторений." to "A series can contain no more than 500 occurrences.",
    "Запись изменилась. Откройте её заново." to "The record changed. Open it again.",
    "Проект не найден. Выберите его заново." to "Project not found. Choose it again.", "Категория не найдена." to "Category not found.",
    "Задача больше недоступна." to "The task is no longer available.", "План изменился. Откройте его заново." to "The plan changed. Open it again.",
    "План сна не найден" to "Sleep plan not found", "План сна на паузе." to "The sleep plan is paused.",
    "Заполните запись сна." to "Complete the sleep entry.", "Выберите настроение." to "Choose a mood.",
    "Заметка должна быть не длиннее 200 символов." to "The note must be no longer than 200 characters.",
    "Неподдерживаемая версия трекеров" to "Unsupported tracker version",
    "Повторяющиеся идентификаторы структуры." to "Duplicate structure identifiers.", "Цикл во вложенности проектов." to "Cycle in project nesting.",
    "Структура проектов изменилась. Откройте форму заново." to "The project structure changed. Open the form again.",
    // Welcome, navigation, editors, and screen-specific native copy.
    "Добро пожаловать в GENESIS" to "Welcome to GENESIS",
    "Календарь, проекты и ежедневные практики в гармонии со временем." to
        "Calendar, projects, and daily practices in harmony with time.",
    "Ваше пространство защищено" to "Your workspace is protected",
    "Войдите через Google, чтобы открыть зашифрованные данные GENESIS и синхронизированные задачи." to
        "Sign in with Google to open your encrypted GENESIS data and synced tasks.",
    "Открыть веб-версию" to "Open the web app", "Проверяем аккаунт…" to "Checking your account…",
    "Для продолжения нужен аккаунт Google" to "A Google account is required to continue",
    "Изолированное тестовое пространство · только на этом устройстве" to "Isolated test workspace · this device only",
    "Локальные черновики · аккаунт не подключён" to "Local drafts · no account connected",
    "Изменить задачу" to "Edit task", "Удалить повторение?" to "Delete occurrence?",
    "Сохранение изменит всю серию. При удалении можно выбрать только" to
        "Saving will change the entire series. When deleting, you can choose only",
    "Можно удалить только" to "You can delete only", "или всю серию." to "or the entire series.",
    "Напоминание этой задачи будет отменено." to "This task's reminder will be canceled.",
    "За" to "Before", "мин до задачи" to "min before the task", "1 час" to "1 hour",
    "Мин" to "Min", "Дни" to "Days", "Недели" to "Weeks",
    "Введите корректную дату, время и интервал до четырёх недель." to "Enter a valid date, time, and interval of up to four weeks.",
    "Точная дата должна быть не позже задачи и не раньше четырёх недель до неё." to
        "The exact date must be no later than the task and no more than four weeks before it.",
    "Выберите корректную дату задачи." to "Choose a valid task date.",
    "Период повторения — от даты задачи до пяти лет." to "The recurrence period runs from the task date for up to five years.",
    "Серия должна содержать от 1 до 500 повторений." to "A series must contain 1 to 500 occurrences.",
    "Подпроекты" to "Subprojects", "Следующий уровень" to "Next level",
    "Календарь, время и гадания сохраняются в аккаунте GENESIS и зеркалируются на устройстве." to
        "Calendar, time, and divination settings are saved to your GENESIS account and mirrored on this device.",
    "До входа эти настройки сохраняются только на устройстве." to "Before sign-in, these settings are saved only on this device.",
    "Не удалось открыть защищённые данные: ключ недоступен." to "Protected data could not be opened: the key is unavailable.",
    "Проверьте данные задачи." to "Check the task details.", "Не удалось сохранить. Введённые данные остаются в форме." to
        "Could not save. Your entries remain in the form.",
    "Проверьте дату повторения." to "Check the recurrence date.", "Не удалось удалить это повторение." to "Could not delete this occurrence.",
    "Проверьте введённые данные." to "Check the entered information.",
    "Не удалось сохранить привычки. Данные формы сохранены на экране." to "Could not save habits. The form data remains on screen.",
    "Защищённые привычки недоступны. Новые записи не заменят сохранённые данные." to
        "Protected habits are unavailable. New entries will not replace saved data.",
    "На сегодня нет запланированных привычек. Серия не изменится." to "No habits are scheduled today. Your streak will not change.",
    "Сегодня не запланировано" to "Not scheduled today", "Обновить оценку" to "Update rating",
    "Выполнено ·" to "Completed ·", "баллов" to "points", "Отметить выполнение" to "Mark complete",
    "Привычка" to "Habit", "Изменить привычку" to "Edit habit",
    "Григорианский ритм" to "Gregorian rhythm", "Лунный ритм" to "Lunar rhythm", "Сакральный ритм" to "Sacred rhythm",
    "Ежедневно" to "Daily", "Ежемесячно" to "Monthly", "Ежегодно" to "Yearly",
    "Без баллов" to "No points", "Выполнение · 10" to "Completion · 10", "Сохранение…" to "Saving…",
    "Проект больше не существует." to "The project no longer exists.", "Задача больше не существует." to "The task no longer exists.",
    "возвращена в Хаос-бокс." to "was returned to the Chaos box.", "перенесена в" to "was moved to",
    "Не удалось перенести задачу." to "Could not move the task.", "Не удалось перенести задачу. Повторите попытку." to "Could not move the task. Try again.",
    "Проекты и задачи аккаунта" to "Projects and tasks in your account",
    "Структура задач и разделов на этом устройстве" to "Task and section structure on this device",
    "Завершён" to "Completed", "Архив" to "Archived", "Свернуть список" to "Collapse list", "Показать ещё" to "Show more",
    "Проверьте проект." to "Check the project.", "Не удалось сохранить проект. Повторите попытку." to "Could not save the project. Try again.",
    "Проверьте категорию." to "Check the category.", "Не удалось сохранить категорию." to "Could not save the category.",
    "В проект" to "To project", "Перенести" to "Move", "Бирюза" to "Turquoise", "Терракота" to "Terracotta",
    "Золото" to "Gold", "Фиолетовый" to "Purple", "Синий" to "Blue", "Изменить категорию" to "Edit category",
    "Новый проект" to "New project", "Активен" to "Active",
    "Ручка переноса задачи" to "Drag handle for task", "Удерживайте задачу" to "Press and hold task", "и перетащите в проект" to "and drag it to a project",
    "Одна задача · календарный ритм" to "One task · calendar rhythm", "Дни лунного месяца" to "Lunar month days",
    "Дни сакрального месяца" to "Sacred month days",
    "Задачи и события" to "Tasks and events", "Выберите дату" to "Choose a date", "Выбрать время" to "Choose time",
    "Обычный календарь отображения. Дата и повторение задач выбираются отдельно." to
        "Standard display calendar. Task dates and recurrence are chosen separately.",
    "Иллюстрация месяца" to "Month illustration", "Иллюстрация дня недели:" to "Weekday illustration:",
    "Иллюстрация дня" to "Day illustration", "Апейрон · вне обычного цикла" to "Apeiron · outside the ordinary cycle",
    "Свернуть ритм суток" to "Collapse daily rhythm", "Развернуть ритм суток" to "Expand daily rhythm",
    "ГРИГОРИАНСКИЙ КАЛЕНДАРЬ ·" to "GREGORIAN CALENDAR ·", "ГОД" to "YEAR",
    "ЛУННЫЙ КАЛЕНДАРЬ ·" to "LUNAR CALENDAR ·", "МЕСЯЦ" to "MONTH", "лунный день" to "lunar day",
    "Рубеж лунного месяца" to "Lunar month boundary",
    "Защищённые записи недоступны. Сохранённые данные не будут заменены пустыми." to
        "Protected records are unavailable. Saved data will not be replaced with empty values.",
    "Не удалось сохранить запись. Введённые данные остаются в форме." to "Could not save the entry. Your entries remain in the form.",
    "Длительность пока не рассчитана" to "Duration has not been calculated yet", "Качество не оценено" to "Quality not rated",
    "Качество не выбрано" to "Quality not selected", "ч" to "hr", "мин" to "min",
    "Сон и пробуждение" to "Sleep and waking",
    "Не удалось обновить выбор карты с сервера. Сохранённая копия на устройстве не изменена." to
        "Could not refresh the card selection from the server. The saved on-device copy was not changed.",
    "Перебросить карту" to "Redraw card", "Перебросить расклад" to "Redraw spread", "Выбор закреплён до завтра" to "Selection is fixed until tomorrow",
    "Поле движения для случайного выбора" to "Gesture area for random selection",
    "Защищённые привычки недоступны. Практики можно читать, но изменения не сохраняются." to
        "Protected habits are unavailable. You can read practices, but changes cannot be saved.",
    "Не удалось сохранить практику." to "Could not save the practice.", "Рекомендуется" to "Recommended",
    "приоритет" to "priority", "запланирована сегодня" to "scheduled today", "сегодня не запланирована" to "not scheduled today",
    "Отметить сегодня" to "Mark today",
    // Habit library, progress, rewards, quests, and mood values.
    "План на день" to "Daily plan", "5 минут утром, чтобы определить главные задачи дня." to "Take 5 minutes in the morning to identify the day's main tasks.",
    "Стакан воды после пробуждения" to "A glass of water after waking", "Начать день с простого действия." to "Start the day with a simple action.",
    "Утренняя разминка" to "Morning stretch", "5–10 минут движения после пробуждения." to "Move for 5–10 minutes after waking.",
    "Прогулка" to "Walk", "Минимум 20 минут движения на свежем воздухе." to "Spend at least 20 minutes moving outdoors.",
    "Чтение" to "Reading", "20 минут чтения без отвлечений." to "Read without distractions for 20 minutes.",
    "Фокус-сессия" to "Focus session", "Не менее 30 минут сосредоточенной работы над одной важной задачей." to
        "Spend at least 30 focused minutes on one important task.",
    "Медитация / дыхательная практика" to "Meditation / breathing practice",
    "5 минут спокойного наблюдения или дыхательной практики." to "Spend 5 minutes in quiet observation or breathing practice.",
    "10 минут порядка" to "10-minute tidy-up", "Небольшая уборка или организация пространства." to "Do a small clean-up or organize your space.",
    "Вечерний обзор дня" to "Evening review", "Кратко вспомнить сделанное и определить главное на завтра." to
        "Briefly review what you accomplished and choose tomorrow's main priority.",
    "Без экрана перед сном" to "Screen-free before bed", "Отложить телефон и другие экраны минимум за 30 минут до сна." to
        "Put away your phone and other screens at least 30 minutes before sleep.",
    "Первый шаг" to "First Step", "Выполнить первую привычку" to "Complete your first habit",
    "Нить ритма" to "Thread of Rhythm", "Серия три дня" to "Three-day streak",
    "Семь восходов" to "Seven Sunrises", "Серия семь дней" to "Seven-day streak",
    "Укреплённый ритм" to "Strengthened Rhythm", "Завершённый круг" to "Completed Circle",
    "Первый идеальный день" to "First perfect day", "Укоренение" to "Taking Root", "Одна привычка 30 раз" to "Complete one habit 30 times",
    "Сотня" to "One Hundred", "Одна привычка 100 раз" to "Complete one habit 100 times", "Железный ритм" to "Iron Rhythm",
    "Пятьдесят восходов" to "Fifty Sunrises", "Стодневный путь" to "Hundred-Day Path",
    "Идеальная неделя" to "Perfect Week", "Семь идеальных дней подряд" to "Seven perfect days in a row",
    "Золотая череда" to "Golden Run", "30 идеальных дней подряд" to "30 perfect days in a row",
    "Полугодовой круг" to "Half-Year Circle", "Полный оборот" to "Full Revolution",
    "Пятьсот восходов" to "Five Hundred Sunrises", "Тысяча дней пути" to "Thousand-Day Path",
    "Завершить путь возвращения" to "Complete the return path", "Созвездие постоянства" to "Constellation of Consistency",
    "1000 выполнений всего" to "1,000 total completions",
    "Все рубежи достигнуты" to "All milestones reached", "Следующий рубеж:" to "Next milestone:", "дня" to "days",
    "Свернуть галерею" to "Collapse gallery", "Тайное достижение" to "Secret achievement", "Откроется по мере продвижения" to "Unlocks as you progress",
    "Выполните дневную цель три раза подряд. Прежняя серия не восстанавливается." to
        "Complete the daily goal three times in a row. The previous streak is not restored.",
    "После разрыва серии здесь появится трёхдневный путь возвращения." to
        "After a streak breaks, a three-day return path will appear here.",
    "Готово" to "Done", "Завершить дневную цель" to "Complete the daily goal",
    "Выполнить дневную цель" to "Complete the daily goal", "раз" to "times",
    "Создать идеальных дней:" to "Create perfect days:", "Выполнить" to "Complete", "привычку" to "habit",
    "привычек за месяц" to "habits in a month", "запланированных привычек" to "scheduled habits",
    "Испытание дня" to "Daily quest", "Испытание недели" to "Weekly quest", "Эпическое испытание" to "Epic quest",
    "Завершено" to "Completed", "Видимый путь пройден" to "Visible path completed", "До" to "Until",
    "Ранг не найден." to "Rank not found.", "Путь ещё не начат" to "The path has not begun yet", "Этот рубеж ещё не достигнут." to "This milestone has not been reached yet.",
    "Для Искры Гестии нужно" to "Hestia's Spark requires", "Запас Искр Гестии уже заполнен." to "Your Hestia's Spark stock is already full.",
    // Hero-rank and reward titles are Android-native data, so keep their reviewed English names here.
    "Амфора стремления" to "Amphora of Aspiration", "Амфора странствия" to "Amphora of Journey",
    "Амфора стойкости" to "Amphora of Fortitude", "Амфора точности" to "Amphora of Precision",
    "Амфора мастерства" to "Amphora of Mastery", "Амфора мудрости" to "Amphora of Wisdom",
    "Амфора славы" to "Amphora of Glory", "Амфора бездны" to "Amphora of the Abyss", "Амфора не найдена." to "Amphora not found.",
    "Аркадийская Стрела" to "Arcadian Arrow", "Бронзовое Крыло" to "Bronze Wing", "Владыка Нити" to "Master of the Thread",
    "Владыка Потока" to "Master of the Current", "Восставший из Бездны" to "Risen from the Abyss",
    "Голос за Стиксом" to "Voice Beyond the Styx", "Горный Укротитель" to "Mountain Tamer",
    "Железный Возничий" to "Iron Charioteer", "Зеркальный Победитель" to "Mirror Victor",
    "Златорогий Следопыт" to "Golden-Horned Pathfinder", "Золотой Аргонавт" to "Golden Argonaut",
    "Икар" to "Icarus", "Копьё Афины" to "Spear of Athena", "Львиное Сердце" to "Lionheart",
    "Многоумный Странник" to "Wise Wanderer", "Небесный Всадник" to "Sky Rider",
    "Носитель Калидонской Славы" to "Bearer of Calydonian Glory", "Носитель Царской Чести" to "Bearer of Royal Honor",
    "Победитель Яда" to "Conqueror of Venom", "Разгадчик Сфинкса" to "Solver of the Sphinx",
    "Сеятель Драконьего Семени" to "Sower of Dragon's Teeth", "Сизиф" to "Sisyphus",
    "Страж Западного Предела" to "Guardian of the Western Boundary", "Тантал" to "Tantalus",
    "Укротитель Мощи" to "Tamer of Might", "Хранитель Золотого Сада" to "Guardian of the Golden Garden",
    "Циклоп" to "Cyclops", "Щит Мирмидонян" to "Shield of the Myrmidons",
    // Mood choices.
    "Воодушевление" to "Inspired", "Восторг" to "Delighted", "Грусть" to "Sad", "Крайне тяжело" to "Very difficult",
    "Нейтрально" to "Neutral", "Опустошённость" to "Drained", "Радость" to "Joyful", "Сосредоточенность" to "Focused",
    "Спокойствие" to "Calm", "Тревога" to "Anxious", "Уверенность" to "Confident", "Усталость" to "Tired",
    // Accessibility descriptions and remaining compact labels.
    "Авторские часы: внешнее кольцо часов, внутреннее кольцо минут" to
        "Custom clock: hours on the outer ring, minutes on the inner ring",
    "Приоритет" to "Priority", "Ручка переноса задачи" to "Task drag handle",
    "Живописная основа карты" to "Painted card background", "Синхронизация" to "Sync",
    "Аккаунты для новых задач" to "Accounts for new tasks", "подключён" to "connected", "не подключён" to "not connected",
    "включён" to "enabled", "выключен" to "disabled",
    "ВЕСНА" to "SPRING", "ЛЕТО" to "SUMMER", "ОСЕНЬ" to "AUTUMN", "ЗИМА" to "WINTER",
    "ВНЕ ВРЕМЕНИ" to "OUTSIDE TIME",
    "Открываем защищённое пространство" to "Opening the protected workspace",
    "Отложить на 10 мин" to "Snooze for 10 min",
    "Синхронизировано:" to "Synced:", "задач," to "tasks,",
    "За " to "Before ",
    "и все отметки будут удалены. Рубеж в" to "and all completion records will be deleted. The milestone at",
    "выполнений достигнут — заработанные Лавры сохранятся." to "completions was reached, so earned Laurels will be preserved.",
    "и все отметки будут удалены. Прогресс:" to "and all completion records will be deleted. Progress:",
    "баланс Лавров будет обнулён." to "the Laurel balance will be reset.",
    "До «" to "To “", "»:" to "”:",
    // Account settings and cloud ownership.
    "Защищённая учётная запись и состояние сессии" to "Protected account and session status",
    "Облако" to "Cloud", "Что хранится в GENESIS, а что синхронизируется с Google" to
        "What stays in GENESIS and what syncs with Google",
    "Сайт GENESIS" to "GENESIS website", "Ожидает загрузки защищённого пространства" to
        "Waiting for the protected workspace",
    "Версия облака:" to "Cloud version:",
    "Проекты, категории, привычки, отметки, сон, настроение, награды и испытания." to
        "Projects, categories, habits, completions, sleep, mood, rewards, and quests.",
    "Calendar и Tasks подключены" to "Calendar and Tasks are connected",
    "Calendar и Tasks требуют подключения" to "Calendar and Tasks need to be connected",
    "События календаря и задачи Google появятся после подключения сервисов." to
        "Google calendar events and tasks will appear after you connect the services.",
    "Google Calendar и Tasks" to "Google Calendar and Tasks",
    "Разрешения и фоновая синхронизация" to "Permissions and background sync",
    "Связанные аккаунты и правила отправки задач" to "Linked accounts and task routing rules",
    "Академия, поддержка и веб-версия" to "Academy, support, and web version",
    // Habit settings shared with the website.
    "Не удалось сохранить настройки привычек." to "Could not save habit settings.",
    "ЕЖЕДНЕВНАЯ ПРАКТИКА" to "DAILY PRACTICE", "Трекинг привычек" to "Habit tracking",
    "Включить трекер привычек" to "Enable habit tracker",
    "Показывает страницу «Привычки», настроение и прогресс. При отключении зашифрованные записи сохраняются." to
        "Shows the Habits page, mood, and progress. Encrypted records remain safe when disabled.",
    "Трекинг привычек включён" to "Habit tracking is enabled",
    "Трекинг привычек скрыт" to "Habit tracking is hidden",
    "Стартовые привычки" to "Starter habits", "Все стандартные предложения доступны" to
        "All standard suggestions are available",
    "Скрыто предложений:" to "Hidden suggestions:", "Восстановить стандартные" to "Restore defaults",
    "Обнуление трекера" to "Reset tracker",
    "Безвозвратно удалит привычки, сон, настроение, статистику, XP и лавры. Настройки аккаунта и календаря сохранятся." to
        "Permanently deletes habits, sleep, mood, statistics, XP, and Laurels. Account and calendar settings remain.",
    "Обнулить все привычки" to "Reset all habits",
    "МОТИВАЦИЯ НА УСТРОЙСТВЕ" to "ON-DEVICE MOTIVATION",
    "GENESIS объединяет близкие напоминания, соблюдает тихие часы и снижает частоту мотивационных сообщений после повторных пропусков." to
        "GENESIS groups nearby reminders, respects quiet hours, and reduces motivational messages after repeated misses.",
    "Включить уведомления на этом устройстве" to "Enable notifications on this device",
    "Разрешение Android запрашивается только после включения этого переключателя." to
        "Android permission is requested only after you enable this switch.",
    "Разрешение Android выключено" to "Android permission is disabled",
    "Уведомления включены" to "Notifications are enabled", "Уведомления отключены" to "Notifications are disabled",
    "Поведение уведомлений" to "Notification tone", "Героический" to "Heroic", "С иронией" to "Wry",
    "При выборе стиля сразу появится тестовое уведомление с примером формулировки." to
        "Choosing a tone immediately shows a test notification with a sample message.",
    "Android не разрешил показать пример уведомления." to
        "Android did not allow the notification preview to be shown.",
    "Напоминание о дневной цели" to "Daily goal reminder", "Начало тихих часов" to "Quiet hours start",
    "Конец тихих часов" to "Quiet hours end", "Напоминания о цели и серии" to "Goal and streak reminders",
    "Показываются только пока цель достижима; не стыдят и не отнимают прогресс." to
        "Shown only while the goal is reachable; never shames you or removes progress.",
    "Аналитика уведомлений не содержит названий привычек и остаётся только на этом устройстве. Настройки хранятся внутри зашифрованного пространства." to
        "Notification analytics contains no habit names and stays on this device. Settings are stored inside the encrypted workspace.",
    "ОТКЛИК И ДОСТУПНОСТЬ" to "FEEDBACK AND ACCESSIBILITY", "Отклик на выполнение" to "Completion feedback",
    "Выберите, как GENESIS подтверждает выполнение привычки. Системное ограничение движения всегда имеет приоритет." to
        "Choose how GENESIS confirms habit completion. The system reduced-motion setting always takes priority.",
    "Короткие анимации" to "Short animations", "Плавный отклик галочки, карточки и прогресса." to
        "Smooth feedback for the checkmark, card, and progress.",
    "Звук выполнения" to "Completion sound", "Короткий локальный сигнал; не загружается с сервера." to
        "A short local sound that is never downloaded from the server.",
    "Тактильный отклик" to "Haptic feedback", "Лёгкая вибрация на поддерживаемых устройствах." to
        "A light vibration on supported devices.",
    "Уведомления о достижениях" to "Achievement notifications",
    "Показывать новое достижение в уведомлении о выполнении." to
        "Show a new achievement in the completion notification.",
    "Создавать и показывать ежедневные, недельные и эпические испытания." to
        "Create and show daily, weekly, and epic quests.",
    "Игровые блоки" to "Gamification panels", "Показывать ранги, Лавры, награды серии и достижения." to
        "Show ranks, Laurels, streak rewards, and achievements.",
    "Включите трекинг привычек, чтобы изменить эти настройки." to
        "Enable habit tracking to change these settings.",
    "Обнулить трекер?" to "Reset the tracker?",
    "Будут безвозвратно удалены привычки, отметки, сон, настроение, XP, награды и Лавры. Это действие нельзя отменить." to
        "Habits, completions, sleep, mood, XP, rewards, and Laurels will be permanently deleted. This cannot be undone.",
    "Не удалось обнулить трекер." to "Could not reset the tracker.", "Обнулить" to "Reset",
    // Generic on-device habit notifications.
    "Дневная цель ещё достижима." to "Your daily goal is still within reach.",
    "Вас ждёт запланированная практика." to "A scheduled practice is waiting for you.",
    "Вас ждут запланированные практики:" to "Scheduled practices are waiting for you:",
    "Героический зов: завершите практику дня и продолжите ритм." to
        "Heroic call: complete today's practice and carry the rhythm forward.",
    "Героический зов: запланированная практика ждёт свершения." to
        "Heroic call: a planned practice awaits your action.",
    "Героический зов: вас ждут практики — \$count." to
        "Heroic call: \$count planned practices await your action.",
    "Героический зов: вас ждут практики — " to "Heroic call: planned practices await your action — ",
    "Дневная цель всё ещё ждёт. Кажется, терпения ей не занимать." to
        "Your daily goal is still waiting. Apparently it has excellent patience.",
    "Привычка заметила ваше отсутствие. Считаем это разминкой?" to
        "Your practice noticed your absence. Shall we call that a warm-up?",
    "Практики заметили ваше отсутствие — все \$count. Внимательная публика." to
        "\$count practices noticed your absence. A remarkably attentive audience.",
    "Практики заметили ваше отсутствие — все " to "Practices noticed your absence — all ",
    "Внимательная публика." to "A remarkably attentive audience.",
    "Спокойное напоминание: дневная цель ещё достижима." to
        "A quiet nudge: your daily practice is still within reach.",
    "Спокойное напоминание: вас ждёт запланированная практика." to
        "A quiet nudge: a planned practice is waiting.",
    "Спокойное напоминание: вас ждут практики — \$count." to
        "A quiet nudge: \$count planned practices are waiting.",
    "Спокойное напоминание: вас ждут практики — " to "A quiet nudge: planned practices are waiting — ",
    "GENESIS · пример: \$label" to "GENESIS · \$label preview",
    "GENESIS · пример: " to "GENESIS · preview: ",
    "Новое достижение стало частью вашего пути." to
        "A new achievement is now part of your path.",
    "Новых достижений открыто: \$count." to
        "\$count new achievements are now part of your path.",
    "Новых достижений открыто: " to "New achievements unlocked: ",
    "GENESIS · Достижение" to "GENESIS · Achievement",
    "В окне Google выберите тот же аккаунт:" to "In the Google window, choose the same account:",
)

private object TranslationCatalog {
    @Volatile private var dictionary: Map<String, String>? = null
    @Volatile private var fragments: List<Map.Entry<String, String>> = emptyList()
    @Volatile private var englishReverse: Map<String, String> = emptyMap()
    private val foreignDictionaries = ConcurrentHashMap<String, Map<String, String>>()
    private val foreignFragments = ConcurrentHashMap<String, List<Map.Entry<String, String>>>()
    private val resolved = ConcurrentHashMap<String, String>()
    private val cyrillic = Regex("[А-Яа-яЁё]")

    private fun source(context: android.content.Context): Map<String, String> =
        dictionary ?: synchronized(this) {
            dictionary ?: run {
                fun objectAsset(name: String): JSONObject = context.assets.open("originals/i18n/$name")
                    .bufferedReader().use { JSONObject(it.readText()) }
                buildMap {
                    listOf("translations.en.json", "curated-translations.en.json", "year-translations/en.json").forEach { name ->
                        runCatching { objectAsset(name) }.onSuccess { catalog ->
                            catalog.keys().forEach { put(it, catalog.getString(it)) }
                        }.onFailure { error ->
                            Log.e("GenesisI18n", "Could not load $name: ${error.javaClass.simpleName}")
                        }
                    }
                    runCatching {
                        val englishDays = context.assets.open("originals/i18n/calendar-days.en.json")
                            .bufferedReader().use { JSONArray(it.readText()) }
                        val sacredDays = SacredCatalog.months.flatMap { it.days }
                        require(englishDays.length() == sacredDays.size)
                        sacredDays.forEachIndexed { index, day ->
                            val english = englishDays.getJSONObject(index)
                            val englishName = english.getString("name")
                            put(day.name, englishName)
                            put(day.description, english.getString("description"))
                            val russianParts = Regex("^(.*?)\\s*(\\([^()]+\\))$").matchEntire(day.name)
                            val englishParts = Regex("^(.*?)\\s*(\\([^()]+\\))$").matchEntire(englishName)
                            if (russianParts != null && englishParts != null) {
                                put(russianParts.groupValues[1], englishParts.groupValues[1])
                                put(russianParts.groupValues[2], englishParts.groupValues[2])
                            }
                        }
                    }.onFailure { error ->
                        Log.e("GenesisI18n", "Could not load sacred days: ${error.javaClass.simpleName}")
                    }
                }
            }.also {
                fragments = (it + nativeCopy).entries.filter { entry -> entry.key.length in 3..180 }
                    .sortedByDescending { entry -> entry.key.length }
                englishReverse = (it + nativeCopy).entries.associate { entry -> entry.value to entry.key }
                dictionary = it
            }
        }

    fun translate(context: android.content.Context, text: String, language: String): String =
        resolved.getOrPut("$language\u0000$text") {
        val english = source(context)
        val normalized = text.trim()
        if (language == "en") {
            (nativeCopy[normalized] ?: english[normalized])?.let { return@getOrPut it }
        }
        val translations = if (language == "en") english else foreignDictionaries.getOrPut(language) {
            runCatching {
                val names = if (language in setOf("el", "sr", "uk"))
                    listOf("translations.$language.a.json", "translations.$language.b.json")
                    else if (language == "ja") listOf("translations.ja.json", "translations.ja.b.json")
                    else listOf("translations.$language.json")
                buildMap {
                    names.forEach { name ->
                        context.assets.open("originals/i18n/$name").bufferedReader().use { reader ->
                            JSONObject(reader.readText()).let { json ->
                                json.keys().forEach { put(it, json.getString(it)) }
                            }
                        }
                    }
                    context.assets.open("originals/i18n/year-translations/$language.json")
                        .bufferedReader().use { reader ->
                            JSONObject(reader.readText()).let { json ->
                                json.keys().forEach { put(it, json.getString(it)) }
                            }
                        }
                }
            }.getOrElse { error ->
                Log.e("GenesisI18n", "Could not load $language: ${error.javaClass.simpleName}")
                emptyMap()
            }
        }
        translations[normalized]?.let { return@getOrPut it }
        val russianKey = if (cyrillic.containsMatchIn(normalized)) normalized else englishReverse[normalized]
        russianKey?.let { translations[it] }?.let { return@getOrPut it }
        if (!cyrillic.containsMatchIn(normalized)) return@getOrPut text
        var result = normalized
        val candidateFragments = if (language == "en") fragments else foreignFragments.getOrPut(language) {
            translations.entries.filter { it.key.length in 3..180 }
                .sortedByDescending { it.key.length }
        }
        for ((russian, translated) in candidateFragments) {
            if (!result.contains(russian)) continue
            result = result.replace(russian, translated)
        }
        if (!cyrillic.containsMatchIn(result)) result else
            (nativeCopy[normalized] ?: english[normalized] ?: text)
    }
}

internal fun translateGenesisText(context: android.content.Context, source: String, language: String): String =
    TranslationCatalog.translate(context, source, language)

@Composable
fun genesisTranslate(source: String): String {
    val language = LocalGenesisLanguage.current
    if (language == "ru") return source
    val context = LocalContext.current
    return remember(source, context, language) { TranslationCatalog.translate(context, source, language) }
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
        color = eveningInk(color), fontSize = fontSize, fontStyle = fontStyle, fontWeight = fontWeight,
        fontFamily = fontFamily, letterSpacing = letterSpacing, textDecoration = textDecoration,
        textAlign = textAlign, lineHeight = lineHeight, overflow = overflow, softWrap = softWrap,
        maxLines = maxLines, minLines = minLines, onTextLayout = onTextLayout, style = style)
}
