package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.CalendarRange
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.SacredCatalog
import ru.genesis.calendar.domain.SacredMonth
import ru.genesis.calendar.domain.MoonInfo
import ru.genesis.calendar.domain.SolarEvent
import ru.genesis.calendar.domain.SolarLocation
import ru.genesis.calendar.data.LocalTask
import ru.genesis.calendar.data.TaskOccurrences
import java.time.LocalDate
import java.time.ZoneId
import java.time.Month
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale
import kotlin.math.roundToInt

private val ru = Locale.forLanguageTag("ru")
private val calendarIncompleteColor = Color(0xffb63b42)
private val calendarCompletedColor = Color(0xff255b59)

private enum class GregorianSeason(val title: String, val englishTitle: String,
    val months: List<Int>, val background: Color, val accent: Color) {
    WINTER("Зима", "Winter", listOf(1, 2, 12), Color(0xfffffdf8), Color(0xff526263)),
    SPRING("Весна", "Spring", listOf(3, 4, 5), Color(0xffdfefdd), Color(0xff356239)),
    SUMMER("Лето", "Summer", listOf(6, 7, 8), Color(0xffdceff6), Color(0xff275f79)),
    AUTUMN("Осень", "Autumn", listOf(9, 10, 11), Color(0xfff5ded9), Color(0xff963f36)),
}
private fun seasonForGregorianMonth(month: Int, southern: Boolean): GregorianSeason = when (month) {
    12, 1, 2 -> if (southern) GregorianSeason.SUMMER else GregorianSeason.WINTER
    3, 4, 5 -> if (southern) GregorianSeason.AUTUMN else GregorianSeason.SPRING
    6, 7, 8 -> if (southern) GregorianSeason.WINTER else GregorianSeason.SUMMER
    else -> if (southern) GregorianSeason.SPRING else GregorianSeason.AUTUMN
}
@Composable private fun seasonSurface(season: GregorianSeason): Color = if (!LocalEveningTheme.current) season.background else when(season) {
    GregorianSeason.WINTER -> Color(0xff3c4643)
    GregorianSeason.SPRING -> Color(0xff2d4935)
    GregorianSeason.SUMMER -> Color(0xff2e495b)
    GregorianSeason.AUTUMN -> Color(0xff543630)
}
@Composable private fun seasonAccent(season: GregorianSeason): Color = if (!LocalEveningTheme.current) season.accent else when(season) {
    GregorianSeason.WINTER -> Color(0xffd6d8d3)
    GregorianSeason.SPRING -> Color(0xffabc8a2)
    GregorianSeason.SUMMER -> Color(0xffadc8d4)
    GregorianSeason.AUTUMN -> Color(0xffddb2a7)
}
private fun dateLabel(locale: Locale) = DateTimeFormatter.ofPattern("d MMM yyyy", locale)

internal fun sacredMonthArtPath(index: Int): String {
    require(index in 0..12)
    return "month-art-v4/month-${(index + 1).toString().padStart(2, '0')}.webp"
}

/** The display calendar controls this screen only; task input and recurrence remain independent. */
@Composable
fun CalendarScreen(date: LocalDate, mode: CalendarMode, onSelect: (LocalDate) -> Unit,
    onModeChange: (CalendarMode) -> Unit = {},
    experimental: Boolean = false, tasks: List<LocalTask> = emptyList(), use24: Boolean = true,
    weekStartsOnSunday: Boolean = true,
    gregorianYearStartsInMarch: Boolean = false, regionalSeasonArt: Boolean = false,
    onStartGregorianYearInMarch: () -> Unit = {},
    seasonRegionZone: ZoneId = ZoneId.systemDefault(),
    onCompleteTask: (LocalTask) -> Unit = {},
    onEditTask: (LocalTask, LocalDate) -> Unit = { _, _ -> },
    onDeleteTask: (LocalTask) -> Unit = {},
    onDeleteOccurrence: ((LocalTask, LocalDate) -> Unit)? = null,
    dayHabits: @Composable (LocalDate) -> Unit = {},
    menuSwipeState: MenuSwipeState? = null, periodSwipeEnabled: Boolean = true) {
    val calendar = remember { GenesisCalendar() }
    var shown by rememberSaveable(mode, date) { mutableStateOf(date.toString()) }
    var selected by rememberSaveable(mode, date) { mutableStateOf(date.toString()) }
    var localYearView by rememberSaveable { mutableStateOf(false) }
    val yearView = menuSwipeState?.calendar == "year" || menuSwipeState == null && localYearView
    var taskListDate by rememberSaveable { mutableStateOf<String?>(null) }
    var deletingTaskId by rememberSaveable { mutableStateOf<String?>(null) }
    var deletingDate by rememberSaveable { mutableStateOf(date.toString()) }
    val shownDate = LocalDate.parse(shown)
    val range = remember(shownDate, mode) { runCatching { calendar.monthRange(shownDate, mode) } }

    CompositionLocalProvider(LocalCalendarPeriodSwipeEnabled provides periodSwipeEnabled) {
    Column(Modifier.fillMaxSize()) {
        ConnectedSubmenu(listOf(SubmenuItem("month", "Месяц"), SubmenuItem("year", "Год")),
            if (yearView) "year" else "month", {
                localYearView = it == "year"; menuSwipeState?.calendar = it
            }, Modifier.testTag("calendar-view-switch"))
        if (yearView) CalendarYearOverview(calendar, shownDate, mode, onModeChange, experimental, tasks,
            gregorianYearStartsInMarch, regionalSeasonArt, seasonRegionZone,
            onStartGregorianYearInMarch,
            onMonth = {
                shown = it.toString(); selected = it.toString(); localYearView = false
                menuSwipeState?.calendar = "month"
            },
            onYear = { shown = it.toString() })
        else if (range.isFailure) Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CalendarPageHeader(false, mode, onModeChange)
            Text("Этот период вне диапазона офлайн-календаря.", color = MaterialTheme.colorScheme.error)
        }
        else CalendarMonthContent(calendar, range.getOrThrow(), mode, onModeChange,
            LocalDate.parse(selected), experimental, tasks,
            weekStartsOnSunday,
            onNavigate = { shown = it.toString(); selected = it.toString() },
            onChoose = { selected = it.toString() }, onOpenDay = onSelect,
            onOpenTaskList = { taskListDate = it.toString() },
            dayActions = { day ->
                val dayTasks = TaskOccurrences.byDate(tasks, day, day)[day.toString()].orEmpty()
                CalendarInlineTasks(day, dayTasks, use24, onCompleteTask,
                    onEdit = { onEditTask(it, day) },
                    onDelete = { deletingTaskId = it.id; deletingDate = day.toString() })
                dayHabits(day)
            })
    }
    }
    tasks.firstOrNull { it.id == deletingTaskId }?.let { task ->
        val occurrenceDate = LocalDate.parse(deletingDate)
        val recurring = task.recurrence.enabled && onDeleteOccurrence != null
        AlertDialog(onDismissRequest = { deletingTaskId = null },
            title = { Text(if (recurring) "Удалить повторение?" else "Удалить задачу?") },
            text = { Text(if (recurring) "Можно удалить только $occurrenceDate или всю серию."
                else "Напоминание этой задачи будет отменено.") },
            confirmButton = { Column {
                if (recurring) TextButton({ onDeleteOccurrence?.invoke(task, occurrenceDate); deletingTaskId = null }) {
                    Text("Только этот день") }
                TextButton({ onDeleteTask(task); deletingTaskId = null },
                    Modifier.testTag("calendar-inline-delete-confirm")) { Text(if (recurring) "Вся серия" else "Удалить") }
            } }, dismissButton = { TextButton({ deletingTaskId = null }) { Text("Отмена") } })
    }
    taskListDate?.let { rawDate ->
        val taskDate = LocalDate.parse(rawDate)
        val dayTasks = remember(tasks, rawDate) {
            TaskOccurrences.byDate(tasks, taskDate, taskDate)[rawDate].orEmpty()
        }
        CalendarTaskListDialog(taskDate, dayTasks, use24, onDismiss = { taskListDate = null },
            onComplete = onCompleteTask,
            onEdit = { task -> taskListDate = null; onEditTask(task, taskDate) },
            onDelete = onDeleteTask,
            onDeleteOccurrence = onDeleteOccurrence?.let { callback -> { task -> callback(task, taskDate) } },
            onOpenDay = { taskListDate = null; onSelect(taskDate) })
    }
}

@Composable
private fun CalendarPageHeader(yearView: Boolean, mode: CalendarMode,
    onModeChange: (CalendarMode) -> Unit, modifier: Modifier = Modifier) {
    val copy = mobileCalendarCopy(LocalGenesisLanguage.current)
    GenesisPageHeader(if (yearView) "Календарь - год" else "Календарь - месяц",
        copy.calendarName(mode), "☷",
        modifier.heightIn(min = if (compactWindowHeight()) 88.dp else 138.dp),
        calendarMode = mode, onCalendarModeClick = { onModeChange(nextCalendarMode(mode)) })
}

@Composable
private fun CalendarMonthContent(calendar: GenesisCalendar, range: CalendarRange, mode: CalendarMode,
    onModeChange: (CalendarMode) -> Unit, selected: LocalDate, experimental: Boolean, tasks: List<LocalTask>,
    weekStartsOnSunday: Boolean,
    onNavigate: (LocalDate) -> Unit, onChoose: (LocalDate) -> Unit,
    onOpenDay: (LocalDate) -> Unit, onOpenTaskList: (LocalDate) -> Unit,
    dayActions: @Composable (LocalDate) -> Unit) {
    val locale = Locale.forLanguageTag(LocalGenesisLanguage.current).takeIf { it.language.isNotBlank() } ?: ru
    val solarLocation by rememberAutomaticSolarLocation(calendar.zoneId)
    val scroll = rememberScrollState()
    var previewRequested by remember(range.start) { mutableStateOf(false) }
    var selectedDayTop by remember(range.start) { mutableIntStateOf(-1) }
    var selectedDayHeight by remember(range.start) { mutableIntStateOf(0) }
    var viewportHeight by remember { mutableIntStateOf(0) }
    val density = LocalDensity.current
    val tasksByDate = remember(tasks, range) { TaskOccurrences.byDate(tasks, range.start, range.end) }
    BoxWithConstraints(Modifier.fillMaxSize().testTag("calendar-month")) {
        val twoPanes = maxWidth >= 840.dp
        LaunchedEffect(selected, previewRequested, selectedDayTop, scroll.maxValue, twoPanes) {
            if (!twoPanes && previewRequested && selectedDayTop >= 0) scroll.animateScrollTo(selectedDayTop)
        }
        val choose: (LocalDate) -> Unit = { day -> previewRequested = true; onChoose(day) }
        val monthContent: @Composable () -> Unit = {
            CalendarPageHeader(false, mode, onModeChange, Modifier.padding(vertical = 8.dp))
        CalendarPeriodPager(range,
            remember(range, mode) { runCatching { calendar.monthRange(range.start.minusDays(1), mode) }.getOrNull() },
            remember(range, mode) { runCatching { calendar.monthRange(range.end.plusDays(1), mode) }.getOrNull() },
            { onNavigate(range.start.minusDays(1)) },
            { onNavigate(range.end.plusDays(1)) }, Modifier.fillMaxWidth()) { page, previous, next ->
            val sacred = calendar.sacredDate(page.start)
            val month = SacredCatalog.months[sacred.monthIndex]
            val pageTasks = remember(tasks, page) { TaskOccurrences.byDate(tasks, page.start, page.end) }
            Card(Modifier.fillMaxWidth().testTag(if (mode == CalendarMode.SACRED) "sacred-month-pyatas"
                else "calendar-month-panel-${mode.wireValue}"), shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = .45f))) {
                CalendarPeriodNavigation(when (mode) {
                    CalendarMode.SACRED -> "${month.roman} · ${month.name}"
                    CalendarMode.PROFANE -> page.start.month.getDisplayName(TextStyle.FULL_STANDALONE, locale)
                        .replaceFirstChar { it.titlecase(locale) } + " ${page.start.year}"
                    CalendarMode.LUNAR -> calendar.lunarDate(page.start).month.name
                }, false, previous, next)
                if (mode == CalendarMode.SACRED) SacredMonthHero(month, sacred.sacredYear)
                else Surface(Modifier.fillMaxWidth().testTag("calendar-month-description"),
                    color = if (mode == CalendarMode.LUNAR) Color(0xff082e2f) else MaterialTheme.colorScheme.primaryContainer) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(if (mode == CalendarMode.LUNAR) calendar.lunarDate(page.start).month.title
                            else "Григорианский месяц", style = MaterialTheme.typography.titleMedium,
                            color = if (mode == CalendarMode.LUNAR) Color(0xffffe9b5) else MaterialTheme.colorScheme.onSurface)
                        Text(if (mode == CalendarMode.LUNAR) calendar.lunarDate(page.start).month.description
                            else "Обычный календарь отображения. Дата и повторение задач выбираются отдельно.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (mode == CalendarMode.LUNAR) Color(0xffd5e5df) else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Column(Modifier.padding(horizontal = 10.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${page.start.format(dateLabel(locale))} — ${page.end.format(dateLabel(locale))}",
                        style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (mode == CalendarMode.SACRED) SacredDayGrid(calendar, page, selected, choose, experimental,
                        pageTasks, onOpenTaskList, solarLocation)
                    else SevenDayGrid(calendar, page, mode, selected, choose, experimental, pageTasks,
                        onOpenTaskList, solarLocation, weekStartsOnSunday)
                }
            }
        }
        }
        val dayContent: @Composable () -> Unit = {
            SelectedDayCard(calendar, selected, mode, onOpenDay, experimental,
                tasksByDate[selected.toString()].orEmpty(), solarLocation, dayActions)
        }
        if (twoPanes) {
            Row(Modifier.fillMaxSize().padding(horizontal = 12.dp).testTag("calendar-two-pane"),
                horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Column(Modifier.weight(1.55f).fillMaxHeight().verticalScroll(scroll),
                    verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    monthContent()
                    Spacer(Modifier.height(16.dp))
                }
                Column(Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState())
                    .padding(top = 8.dp).testTag("calendar-day-pane"),
                    verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    dayContent()
                    Spacer(Modifier.height(16.dp))
                }
            }
        } else {
            Column(Modifier.fillMaxSize().onSizeChanged { viewportHeight = it.height }
                .verticalScroll(scroll).padding(horizontal = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                monthContent()
                Box(Modifier.fillMaxWidth().onGloballyPositioned {
                    selectedDayTop = it.positionInParent().y.roundToInt(); selectedDayHeight = it.size.height
                }) { dayContent() }
                Spacer(Modifier.height(maxOf(16.dp, with(density) {
                    (viewportHeight - selectedDayHeight).coerceAtLeast(0).toDp()
                })))
            }
        }
    }
}

@Composable
private fun SacredMonthHero(month: SacredMonth, year: Int) {
        Row(Modifier.fillMaxWidth().testTag("sacred-month-hero").background(Color(0xff082e2f))) {
            OriginalImage(sacredMonthArtPath(month.index), "Иллюстрация месяца ${month.name}",
                Modifier.width(120.dp).height(190.dp))
            Column(Modifier.weight(1f).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("${month.season} · ${month.roman} месяц · $year", style = MaterialTheme.typography.labelSmall,
                    color = Color(0xffdfc17e))
                Text(month.name, style = MaterialTheme.typography.titleLarge, color = Color(0xfffff5df))
                Text(month.title, style = MaterialTheme.typography.titleSmall, color = Color(0xffffe9b5))
                Text(month.description, style = MaterialTheme.typography.bodySmall, color = Color(0xffd5e5df))
            }
        }
}

@Composable
private fun SacredDayGrid(calendar: GenesisCalendar, range: CalendarRange, selected: LocalDate,
    onChoose: (LocalDate) -> Unit, experimental: Boolean, tasksByDate: Map<String, List<LocalTask>>,
    onOpenTaskList: (LocalDate) -> Unit, solarLocation: SolarLocation) {
    var expandedPyatas by remember(range.start) { mutableStateOf(emptySet<Int>()) }
    range.dates().chunked(5).forEachIndexed { rowIndex, dates ->
        val first = calendar.sacredDate(dates.first())
        val day = SacredCatalog.months[first.monthIndex].days[first.day - 1]
        if (experimental && first.monthIndex != 12) {
            TextButton(onClick = { expandedPyatas = if (rowIndex in expandedPyatas)
                expandedPyatas - rowIndex else expandedPyatas + rowIndex },
                modifier = Modifier.fillMaxWidth().testTag("pyata-${rowIndex + 1}")) {
                Text("ПЯТА ${rowIndex + 1} · ${day.pyataTitle}  ${if (rowIndex in expandedPyatas) "⌃" else "⌄"}",
                    modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
            }
            if (rowIndex in expandedPyatas) Text(pyataDescriptions[rowIndex.coerceIn(0, 5)],
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                style = MaterialTheme.typography.bodyMedium)
        } else Text(if (first.monthIndex == 12) "Вне времени" else "Пята ${rowIndex + 1} · ${day.pyataTitle}",
            style = MaterialTheme.typography.titleSmall)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            dates.forEach { date ->
                val sacred = calendar.sacredDate(date)
                val definition = SacredCatalog.months[sacred.monthIndex].days[sacred.day - 1]
                CalendarDay(calendar, date, sacred.day, listOf("I", "II", "III", "IIII", "V")[(sacred.day - 1) % 5],
                    definition.name, date == selected, onChoose, Modifier.weight(1f),
                    if (experimental) calendar.moonInfo(date) else null,
                    if (experimental) "${date.dayOfMonth}.${date.monthValue}" else null,
                    if (experimental) tasksByDate[date.toString()].orEmpty().size else 0,
                    if (experimental) calendar.solarEvent(date) else null,
                    onTaskBadgeClick = onOpenTaskList,
                    solarLocation = if (experimental) solarLocation else null,
                    completedTaskCount = if (experimental) tasksByDate[date.toString()].orEmpty().count { it.done } else 0)
            }
            repeat(5 - dates.size) { Spacer(Modifier.weight(1f)) }
        }
    }
}

@Composable
private fun SevenDayGrid(calendar: GenesisCalendar, range: CalendarRange, mode: CalendarMode,
    selected: LocalDate, onChoose: (LocalDate) -> Unit, experimental: Boolean,
    tasksByDate: Map<String, List<LocalTask>>, onOpenTaskList: (LocalDate) -> Unit,
    solarLocation: SolarLocation, weekStartsOnSunday: Boolean) {
    val sundayFirst = mode == CalendarMode.PROFANE && weekStartsOnSunday
    val english = LocalGenesisLanguage.current == "en"
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(1.dp)) {
        (if (sundayFirst && english) listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
            else if (english) listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
            else if (sundayFirst) listOf("Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб")
            else listOf("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс")).forEach {
            Text(it, Modifier.weight(1f), style = MaterialTheme.typography.labelSmall)
        }
    }
    val leading = weekLeadingOffset(range.start, mode, weekStartsOnSunday)
    val days: List<LocalDate?> = when (mode) {
        CalendarMode.PROFANE -> gregorianGridDates(range, weekStartsOnSunday)
        CalendarMode.LUNAR -> lunarGridDates(range)
        CalendarMode.SACRED -> List(leading) { null } + range.dates()
    }
    days.chunked(7).forEachIndexed { weekIndex, week ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(1.dp)) {
            week.forEachIndexed { dayIndex, date ->
                if (date == null) Spacer(Modifier.weight(1f))
                else if (mode == CalendarMode.LUNAR) {
                    val absoluteIndex = weekIndex * 7 + dayIndex
                    val adjacent = date !in range.start..range.end
                    val adjacentAlpha = lunarAdjacentAlpha(absoluteIndex, leading,
                        range.dates().size, days.size)
                    LunarCalendarDay(calendar, date, date == selected, onChoose, Modifier.weight(1f),
                        if (experimental && !adjacent) tasksByDate[date.toString()].orEmpty().size else 0,
                        adjacent, adjacentAlpha, onOpenTaskList,
                        if (experimental) solarLocation else null,
                        completedTaskCount = if (experimental && !adjacent) tasksByDate[date.toString()].orEmpty().count { it.done } else 0)
                } else CalendarDay(calendar, date,
                    if (mode == CalendarMode.LUNAR) calendar.lunarDate(date).day else date.dayOfMonth,
                    null, calendar.formatDate(date, mode), date == selected, onChoose, Modifier.weight(1f),
                    if (experimental) calendar.moonInfo(date) else null,
                    if (experimental) calendar.sacredDate(date).let { "${it.day} · ${SacredCatalog.months[it.monthIndex].name}" } else null,
                    if (experimental && date in range.start..range.end) tasksByDate[date.toString()].orEmpty().size else 0,
                    if (experimental) calendar.solarEvent(date) else null,
                    patron = if (mode == CalendarMode.PROFANE) weekdayPatronMark(date) else null,
                    adjacent = mode == CalendarMode.PROFANE && date !in range.start..range.end,
                    onTaskBadgeClick = onOpenTaskList,
                    solarLocation = if (experimental) solarLocation else null,
                    completedTaskCount = if (experimental && date in range.start..range.end)
                        tasksByDate[date.toString()].orEmpty().count { it.done } else 0)
            }
            repeat(7 - week.size) { Spacer(Modifier.weight(1f)) }
        }
    }
}

internal fun weekLeadingOffset(date: LocalDate, mode: CalendarMode,
    weekStartsOnSunday: Boolean = true): Int =
    if (mode == CalendarMode.PROFANE && weekStartsOnSunday) date.dayOfWeek.value % 7
    else date.dayOfWeek.value - 1

/** Gregorian rows include the previous/next month's dates as read-only, fading context. */
internal fun gregorianGridDates(range: CalendarRange, weekStartsOnSunday: Boolean = true): List<LocalDate> {
    val leading = weekLeadingOffset(range.start, CalendarMode.PROFANE, weekStartsOnSunday)
    val trailing = (7 - (leading + range.dates().size) % 7) % 7
    return (leading downTo 1).map { range.start.minusDays(it.toLong()) } + range.dates() +
        (1..trailing).map { range.end.plusDays(it.toLong()) }
}

/** Lunar rows are symmetrical: both neighbouring months are read-only fading context. */
internal fun lunarGridDates(range: CalendarRange): List<LocalDate> {
    val leading = weekLeadingOffset(range.start, CalendarMode.LUNAR)
    val trailing = (7 - (leading + range.dates().size) % 7) % 7
    return (leading downTo 1).map { range.start.minusDays(it.toLong()) } + range.dates() +
        (1..trailing).map { range.end.plusDays(it.toLong()) }
}

internal fun lunarAdjacentAlpha(index: Int, leading: Int, currentDays: Int, totalDays: Int): Float {
    val firstCurrent = leading
    val firstTrailing = leading + currentDays
    return when {
        index in firstCurrent until firstTrailing -> 1f
        index < firstCurrent && leading > 0 ->
            (0.18f + 0.28f * ((index + 1f) / leading.toFloat())).coerceIn(.18f, .46f)
        index >= firstTrailing -> {
            val trailing = (totalDays - firstTrailing).coerceAtLeast(1)
            val position = index - firstTrailing
            (0.46f - 0.28f * ((position + 1f) / trailing.toFloat())).coerceIn(.18f, .46f)
        }
        else -> 1f
    }
}

internal fun genesisRoman(value: Int): String {
    require(value in 1..3999)
    var rest = value
    val output = StringBuilder()
    listOf(1000 to "M", 900 to "CM", 500 to "D", 400 to "CD", 100 to "C", 90 to "XC",
        50 to "L", 40 to "XL", 10 to "X", 9 to "VIIII", 5 to "V", 4 to "IIII", 1 to "I")
        .forEach { (amount, symbol) -> while (rest >= amount) { output.append(symbol); rest -= amount } }
    return output.toString()
}

private val genesisMonthRomans = listOf(
    "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "VIIII", "X", "XI", "XII", "O",
)

internal fun lunarSacredDateLabel(sacredDay: Int, pyata: Int, monthIndex: Int): String {
    require(sacredDay in 1..30 && monthIndex in genesisMonthRomans.indices &&
        (pyata in 1..6 || (monthIndex == 12 && pyata == 0)))
    // Apeiron stands outside the pentads; its real catalog uses pyata = 0.
    if (monthIndex == 12 && pyata == 0) return "${genesisRoman(sacredDay)}/O"
    val dayInsidePyata = (sacredDay - 1) % 5 + 1
    return "${genesisRoman(dayInsidePyata)}/$pyata/${genesisMonthRomans[monthIndex]}"
}

@Composable
private fun LunarCalendarDay(calendar: GenesisCalendar, date: LocalDate, selected: Boolean,
    onChoose: (LocalDate) -> Unit, modifier: Modifier, taskCount: Int, adjacent: Boolean,
    adjacentAlpha: Float, onTaskBadgeClick: (LocalDate) -> Unit, solarLocation: SolarLocation?,
    completedTaskCount: Int = 0) {
    val lunar = calendar.lunarDate(date)
    val moon = calendar.moonInfo(date)
    val sacred = calendar.sacredDate(date)
    val locale = Locale.forLanguageTag(LocalGenesisLanguage.current)
    val weekday = date.dayOfWeek.getDisplayName(TextStyle.SHORT, locale).removeSuffix(".")
    val gregorian = date.format(DateTimeFormatter.ofPattern(if (LocalGenesisLanguage.current == "en") "d MMM" else "d MMM", locale))
    val sacredLabel = lunarSacredDateLabel(sacred.day,
        SacredCatalog.months[sacred.monthIndex].days[sacred.day - 1].pyata, sacred.monthIndex)
    val solarLabels = solarLocation?.let { solarTimeLabels(date, it, calendar) }
    val description = genesisTranslate("${lunar.day} лунный день · ${moon.phase} · $gregorian · $weekday · $sacredLabel" +
        (solarLabels?.let { " · Восход ${it.first}, закат ${it.second}" } ?: "") +
        (if (adjacent) " · Другой месяц, только просмотр" else ""))
    Surface(onClick = { onChoose(date) }, enabled = !adjacent,
        modifier = modifier.heightIn(min = if (solarLabels == null) 126.dp else 148.dp)
            .then(if (adjacent) Modifier.alpha(adjacentAlpha) else Modifier)
            .semantics { contentDescription = description }.testTag("calendar-day-$date"),
        shape = MaterialTheme.shapes.medium,
        color = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        border = if (!adjacent && date == LocalDate.now()) BorderStroke(2.dp, MaterialTheme.colorScheme.primary) else null) {
        Box(Modifier.fillMaxWidth()) {
            Column(Modifier.fillMaxWidth().padding(start = 4.dp, top = 6.dp, end = 4.dp,
                bottom = if (completedTaskCount in 1 until taskCount) 26.dp else 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(lunar.day.toString(), style = MaterialTheme.typography.titleSmall)
                MoonPhaseIcon(moon.phaseStep, size = 23.dp)
                Text(gregorian, fontSize = 9.sp, lineHeight = 10.sp, maxLines = 1)
                Text(weekday, fontSize = 9.sp, lineHeight = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(sacredLabel, fontSize = 8.sp, lineHeight = 9.sp, maxLines = 1,
                    color = MaterialTheme.colorScheme.primary)
                solarLabels?.let {
                    Text("↗${it.first}", fontSize = 7.sp, lineHeight = 8.sp, maxLines = 1,
                        color = MaterialTheme.colorScheme.primary)
                    Text("↘${it.second}", fontSize = 7.sp, lineHeight = 8.sp, maxLines = 1,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (taskCount > 0 && !adjacent) {
                CalendarTaskBadge(date, taskCount, completedTaskCount, 24.dp,
                    Modifier.align(Alignment.BottomEnd).padding(end = 3.dp, bottom = 3.dp),
                    Alignment.BottomEnd, onTaskBadgeClick)
            }
        }
    }
}

@Composable
private fun CalendarDay(calendar: GenesisCalendar, date: LocalDate, number: Int, sublabel: String?, fullName: String,
    selected: Boolean, onChoose: (LocalDate) -> Unit, modifier: Modifier,
    moon: MoonInfo?, crossDate: String?, taskCount: Int, solar: SolarEvent?,
    patron: WeekdayPatronMark? = null, adjacent: Boolean = false,
    onTaskBadgeClick: (LocalDate) -> Unit = {}, solarLocation: SolarLocation? = null,
    completedTaskCount: Int = 0) {
    val today = !adjacent && date == LocalDate.now()
    val locale = Locale.forLanguageTag(LocalGenesisLanguage.current)
    val solarLabels = solarLocation?.let { solarTimeLabels(date, it, calendar) }
    val dayDescription = genesisTranslate("$number · $fullName · ${date.format(dateLabel(locale))}" +
        (patron?.let { " · ${it.symbol} ${it.patrons}" } ?: "") +
        (moon?.let { " · ${it.day} лунный день · ${it.phase}, ${it.illumination}%" } ?: "") +
        (if (taskCount > 0) " · $taskCount задач" else "") +
        (solar?.let { " · ${it.name}" } ?: "") +
        (solarLabels?.let { " · Восход ${it.first}, закат ${it.second}" } ?: "") +
        (if (adjacent) " · Другой месяц, только просмотр" else ""))
    val foreground = if (selected && patron != null) patron.selectedForeground else
        if (patron != null && !LocalEveningTheme.current) Color(0xff132426) else MaterialTheme.colorScheme.onSurface
    CompositionLocalProvider(LocalPreserveCalendarColors provides (patron != null)) {
    Surface(onClick = { onChoose(date) }, enabled = !adjacent,
        modifier = modifier.heightIn(min = if (solarLabels != null) 112.dp else if (moon == null) 64.dp else 96.dp)
        .then(if (adjacent) Modifier.alpha(0.42f) else Modifier)
        .semantics { contentDescription = dayDescription }
        .testTag("calendar-day-$date"),
        shape = MaterialTheme.shapes.medium,
        color = when {
            adjacent -> MaterialTheme.colorScheme.surface
            selected && patron != null -> patron.selectedBackground
            selected -> MaterialTheme.colorScheme.primaryContainer
            patron != null -> if(LocalEveningTheme.current) weekdayEveningWash(date) else patron.wash
            else -> MaterialTheme.colorScheme.surface
        },
        border = if (today) BorderStroke(2.dp, patron?.accent ?: MaterialTheme.colorScheme.primary) else null) {
        Box(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(start = 4.dp,
            top = if (completedTaskCount in 1 until taskCount) 26.dp else 4.dp, end = 4.dp, bottom = 4.dp),
            verticalArrangement = Arrangement.Center) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Text(number.toString(), style = MaterialTheme.typography.titleSmall, color = foreground)
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment=Alignment.CenterVertically,
                horizontalArrangement=Arrangement.SpaceBetween) {
            Text(if (adjacent) date.month.getDisplayName(TextStyle.SHORT_STANDALONE, locale)
                else sublabel ?: date.dayOfWeek.getDisplayName(TextStyle.SHORT, locale),
                style = MaterialTheme.typography.labelSmall, color = foreground)
            patron?.let { Text(it.symbol, style=MaterialTheme.typography.titleSmall,
                modifier=Modifier.testTag("calendar-patron-$date"), color=if(selected || LocalEveningTheme.current) foreground else it.accent) }
            }
            if (moon != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    MoonPhaseIcon(moon.phaseStep, size = 15.dp)
                    Text(moon.day.toString(), style = MaterialTheme.typography.labelSmall, color = foreground)
                }
                if (crossDate != null) Text(crossDate, style = MaterialTheme.typography.labelSmall,
                    maxLines = 1, color = if (selected && patron != null) foreground else MaterialTheme.colorScheme.onSurfaceVariant)
                if (solar != null) Text(solar.symbol,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (selected && patron != null) foreground else patron?.accent ?: MaterialTheme.colorScheme.primary)
                solarLabels?.let { labels ->
                    Text("↗${labels.first}", fontSize = 8.sp, lineHeight = 9.sp, maxLines = 1,
                        color = if (selected && patron != null) foreground else MaterialTheme.colorScheme.primary)
                    Text("↘${labels.second}", fontSize = 8.sp, lineHeight = 9.sp, maxLines = 1,
                        color = if (selected && patron != null) foreground else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        if (taskCount > 0 && !adjacent) {
            CalendarTaskBadge(date, taskCount, completedTaskCount, if (patron != null) 28.dp else 23.dp,
                Modifier.align(Alignment.TopEnd), Alignment.TopEnd, onTaskBadgeClick)
        }
        }
    }
    }
}

@Composable
private fun CalendarTaskBadge(date: LocalDate, total: Int, completed: Int, size: androidx.compose.ui.unit.Dp,
    modifier: Modifier, alignment: Alignment, onClick: (LocalDate) -> Unit) {
    val locale = Locale.forLanguageTag(LocalGenesisLanguage.current)
    val description = genesisTranslate("$total задач на ${date.format(dateLabel(locale))}. Открыть список.")
    Box(modifier.size(48.dp).testTag("calendar-task-count-$date")
        .clickable { onClick(date) }.semantics { contentDescription = description }) {
        CalendarTaskStatusDiscs(total, completed, size, "calendar-task", date.toString(),
            Modifier.align(alignment).padding(1.dp))
    }
}

@Composable
private fun CalendarTaskStatusDiscs(total: Int, completed: Int, size: androidx.compose.ui.unit.Dp,
    prefix: String, key: String, modifier: Modifier = Modifier) {
    val counts = listOf(false to total - completed, true to completed).filter { it.second > 0 }
    val discSize = if (counts.size > 1) 20.dp else size
    CompositionLocalProvider(LocalPreserveCalendarColors provides true) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        counts.forEachIndexed { index, (done, count) ->
            val status = if (done) "done" else "open"
            val stateLabel = genesisTranslate(if (done) "Выполнено" else "Не выполнено")
            Box(if (index == 0) Modifier.testTag("$prefix-count-disc-$key") else Modifier) {
                Surface(Modifier.size(discSize).testTag("$prefix-$status-count-$key")
                    .semantics { contentDescription = "$stateLabel: $count" }, shape = CircleShape,
                    color = if (LocalEveningTheme.current) {
                        if (done) Color(0xff287a57) else Color(0xffd64a54)
                    } else if (done) calendarCompletedColor else calendarIncompleteColor, shadowElevation = 3.dp) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(if (count > 99) "99+" else count.toString(), color = Color.White,
                            fontSize = if (counts.size > 1 || count > 99) 8.sp else 12.sp, maxLines = 1)
                    }
                }
            }
        }
    }
    }
}

@Composable
private fun CalendarTaskListDialog(date: LocalDate, tasks: List<LocalTask>, use24: Boolean,
    onDismiss: () -> Unit, onComplete: (LocalTask) -> Unit, onEdit: (LocalTask) -> Unit,
    onDelete: (LocalTask) -> Unit, onDeleteOccurrence: ((LocalTask) -> Unit)?, onOpenDay: () -> Unit) {
    val locale = Locale.forLanguageTag(LocalGenesisLanguage.current)
    var deletingId by rememberSaveable(date) { mutableStateOf<String?>(null) }
    Dialog(onDismissRequest = onDismiss) {
        Surface(Modifier.fillMaxWidth().heightIn(max = 560.dp).testTag("calendar-task-list-dialog"),
            shape = RoundedCornerShape(24.dp), color = Color(0xfffffbf2),
            border = BorderStroke(1.dp, Color(0x66b28a4a)), shadowElevation = 18.dp) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    CalendarTaskStatusDiscs(tasks.size, tasks.count { it.done }, 44.dp,
                        "calendar-dialog-task", date.toString())
                    Column(Modifier.weight(1f)) {
                        Text("Задачи дня", style = MaterialTheme.typography.titleLarge)
                        Text(date.format(dateLabel(locale)), style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    TextButton(onClick = onDismiss, modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)) {
                        Text("Закрыть")
                    }
                }
                HorizontalDivider(color = Color(0x44b28a4a))
                LazyColumn(Modifier.weight(1f, fill = false), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (tasks.isEmpty()) item {
                        Text("На этот день задач больше нет.", Modifier.padding(vertical = 12.dp),
                            style = MaterialTheme.typography.bodyMedium)
                    }
                    items(tasks, key = { it.id }) { task ->
                        val completionDescription = genesisTranslate(if (task.done)
                            "Вернуть в работу" else "Выполнить задачу") + ": " + task.title
                        Surface(Modifier.fillMaxWidth().testTag("calendar-task-${task.id}"), shape = RoundedCornerShape(14.dp),
                            color = if (task.done) completedTaskSurface else Color(0xfff4ecdc)) {
                            Column {
                            Row(Modifier.fillMaxWidth().padding(start = 4.dp, end = 12.dp, top = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(checked = task.done, onCheckedChange = { onComplete(task) },
                                    modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)
                                        .testTag("calendar-task-complete-${task.id}").semantics {
                                            contentDescription = completionDescription
                                        })
                                Column(Modifier.weight(1f)) {
                                    TaskTitle(task,
                                        style = MaterialTheme.typography.titleSmall, maxLines = 2,
                                        color = if (task.done) calendarCompletedColor else calendarIncompleteColor,
                                        occurrenceDate = date)
                                    Text(listOfNotNull(task.time.takeIf { it.isNotBlank() }?.let { timeLabel(it, use24) },
                                        task.project.takeIf { it.isNotBlank() }).joinToString(" · ").ifBlank { "Без времени" },
                                        style = MaterialTheme.typography.bodySmall,
                                         color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text(if (task.done) "Выполнено" else "Выполнить задачу",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (task.done) calendarCompletedColor else calendarIncompleteColor)
                                }
                            }
                            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                TextButton(onClick = { onEdit(task) }, modifier = Modifier.weight(1f)
                                    .heightIn(min = 48.dp).testTag("calendar-task-edit-${task.id}")) {
                                    Text("Редактировать")
                                }
                                TextButton(onClick = { deletingId = task.id }, modifier = Modifier.weight(1f)
                                    .heightIn(min = 48.dp).testTag("calendar-task-delete-${task.id}"),
                                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                                    Text("Удалить")
                                }
                            }
                            }
                        }
                    }
                }
                Button(onClick = onOpenDay, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                    Text("Открыть день и задачи")
                }
            }
        }
    }
    tasks.firstOrNull { it.id == deletingId }?.let { task ->
        val recurring = task.recurrence.enabled && onDeleteOccurrence != null
        AlertDialog(onDismissRequest = { deletingId = null },
            title = { Text(if (recurring) "Удалить повторение?" else "Удалить задачу?") },
            text = { Text(if (recurring) "Можно удалить только ${date} или всю серию."
                else "Напоминание этой задачи будет отменено.") },
            confirmButton = {
                Column {
                    if (recurring) TextButton(onClick = { onDeleteOccurrence?.invoke(task); deletingId = null },
                        modifier = Modifier.heightIn(min = 48.dp).testTag("calendar-delete-occurrence")) {
                        Text("Только этот день")
                    }
                    TextButton(onClick = { onDelete(task); deletingId = null },
                        modifier = Modifier.heightIn(min = 48.dp).testTag("calendar-delete-confirm")) {
                        Text(if (recurring) "Вся серия" else "Удалить")
                    }
                }
            },
            dismissButton = { TextButton(onClick = { deletingId = null },
                modifier = Modifier.heightIn(min = 48.dp)) { Text("Отмена") } })
    }
}

@Composable
private fun SelectedDayCard(calendar: GenesisCalendar, date: LocalDate, mode: CalendarMode,
    onOpenDay: (LocalDate) -> Unit, experimental: Boolean, tasks: List<LocalTask>,
    solarLocation: SolarLocation, dayActions: @Composable (LocalDate) -> Unit) {
    if (experimental) {
        ExperimentalSelectedDayCard(calendar, date, mode, onOpenDay, tasks, solarLocation, dayActions)
        return
    }
    val sacred = calendar.sacredDate(date)
    val month = SacredCatalog.months[sacred.monthIndex]
    val day = month.days[sacred.day - 1]
    val locale = Locale.forLanguageTag(LocalGenesisLanguage.current)
    val weekday = if (mode == CalendarMode.PROFANE) todayHeroCopy(date, mode, calendar,
        LocalGenesisLanguage.current) else null
    Card(Modifier.fillMaxWidth().testTag("calendar-selected-day")) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            weekday?.let { OriginalImage(it.imagePath, "Иллюстрация дня недели: ${it.title}",
                Modifier.fillMaxWidth().height(196.dp).testTag("calendar-weekday-art")) }
            if (experimental && mode == CalendarMode.SACRED) OriginalImage("day-art-v1/month-${(sacred.monthIndex + 1).toString().padStart(2, '0')}/day-${sacred.day.toString().padStart(2, '0')}.webp",
                "Иллюстрация дня ${day.name}", Modifier.fillMaxWidth().height(136.dp))
            Text(when (mode) {
                CalendarMode.PROFANE -> "ГРИГОРИАНСКИЙ ДЕНЬ"
                CalendarMode.LUNAR -> "ЛУННЫЙ ДЕНЬ"
                CalendarMode.SACRED -> "САКРАЛЬНЫЙ ДЕНЬ"
            }, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Text(when (mode) {
                CalendarMode.PROFANE -> date.format(DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy", locale))
                    .replaceFirstChar { it.titlecase(locale) }
                CalendarMode.LUNAR -> calendar.lunarDate(date).let { "${it.day} · ${it.month.name}" }
                CalendarMode.SACRED -> "${sacred.day} · ${month.name}"
            }, style = MaterialTheme.typography.titleLarge, modifier = Modifier.testTag("calendar-selected-primary-date"))
            if (mode == CalendarMode.PROFANE) {
                val patron = weekdayPatronMark(date)
                Row(verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.testTag("calendar-selected-patron")) {
                    Text(patron.symbol, style = MaterialTheme.typography.headlineMedium, color = patron.accent)
                    Column {
                        Text(patron.guidance, style = MaterialTheme.typography.titleSmall, color = patron.accent)
                        Text(patron.patrons, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            weekday?.let {
                Text(it.description, style = MaterialTheme.typography.titleMedium)
                it.details.forEach { detail -> Text(detail, style = MaterialTheme.typography.bodySmall) }
            }
            if (mode != CalendarMode.PROFANE) Text(date.format(dateLabel(locale)), style = MaterialTheme.typography.labelMedium)
            if (mode == CalendarMode.SACRED) {
                Text(day.name, style = MaterialTheme.typography.titleSmall)
                Text(day.description, style = MaterialTheme.typography.bodyMedium)
            }
            if (experimental) {
                val lunar = calendar.lunarDate(date)
                val moon = calendar.moonInfo(date)
                HorizontalDivider()
                Row(verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MoonPhaseIcon(moon.phaseStep, size = 40.dp)
                    Column {
                        Text("${moon.day} лунный день · ${moon.phase}", style = MaterialTheme.typography.titleSmall)
                        Text("${moon.epithet} · ${moon.direction} · освещённость ${moon.illumination}%",
                            style = MaterialTheme.typography.bodySmall)
                    }
                }
                Text("${lunar.month.name} · ${lunar.decade}${if (lunar.isThreshold) " · Рубеж" else ""}",
                    style = MaterialTheme.typography.bodySmall)
                Text("Сакральная дата · ${sacred.day} · ${month.name} · ${day.name}",
                    style = MaterialTheme.typography.bodySmall)
                if (mode != CalendarMode.SACRED) Text(day.description, style = MaterialTheme.typography.bodySmall)
                Text("Пята ${day.pyata} · ${day.pyataTitle}", style = MaterialTheme.typography.bodySmall)
                Text("${date.dayOfWeek.getDisplayName(TextStyle.FULL_STANDALONE, locale)} · ${date.dayOfYear}-й день года",
                    style = MaterialTheme.typography.bodySmall)
                if (moon.event.isNotBlank()) Text(moon.event, color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.labelLarge)
                calendar.solarEvent(date)?.let { event ->
                    Text("${event.symbol} ${event.name} · ${event.instant.atZone(calendar.zoneId).format(DateTimeFormatter.ofPattern("HH:mm z", locale))}",
                        color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleSmall)
                }
                HorizontalDivider()
                Text("Задачи дня · ${tasks.size}", style = MaterialTheme.typography.titleSmall)
                tasks.take(5).forEach { task -> TaskTitle(task, label = "${if (task.done) "✓" else "○"} ${task.title}",
                    style = MaterialTheme.typography.bodySmall, maxLines = 1,
                    color = if (task.done) calendarCompletedColor else calendarIncompleteColor,
                    occurrenceDate = date) }
                if (tasks.size > 5) Text("И ещё ${tasks.size - 5}…", style = MaterialTheme.typography.labelSmall)
            }
            Button(onClick = { onOpenDay(date) }) { Text("Открыть день и задачи") }
        }
    }
}

@Composable
private fun ExperimentalSelectedDayCard(calendar: GenesisCalendar, date: LocalDate, mode: CalendarMode,
    onOpenDay: (LocalDate) -> Unit, tasks: List<LocalTask>, solarLocation: SolarLocation,
    dayActions: @Composable (LocalDate) -> Unit) {
    val sacred = calendar.sacredDate(date)
    val month = SacredCatalog.months[sacred.monthIndex]
    val day = month.days[sacred.day - 1]
    val lunar = calendar.lunarDate(date)
    val locale = Locale.forLanguageTag(LocalGenesisLanguage.current)
    val weekday = if (mode == CalendarMode.PROFANE) todayHeroCopy(date, mode, calendar,
        LocalGenesisLanguage.current) else null
    val primaryDate = when (mode) {
        CalendarMode.PROFANE -> date.format(DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy", locale))
            .replaceFirstChar { it.titlecase(locale) }
        CalendarMode.LUNAR -> "${lunar.day} · ${lunar.month.name}"
        CalendarMode.SACRED -> "${sacred.day} · ${month.name}"
    }
    val modeTitle = when (mode) {
        CalendarMode.PROFANE -> "ГРИГОРИАНСКИЙ ДЕНЬ"
        CalendarMode.LUNAR -> "ЛУННЫЙ ДЕНЬ"
        CalendarMode.SACRED -> "САКРАЛЬНЫЙ ДЕНЬ"
    }
    val heroPath = weekday?.imagePath ?: "day-art-v1/month-${(sacred.monthIndex + 1).toString().padStart(2, '0')}/day-${sacred.day.toString().padStart(2, '0')}.webp"
    val heroTitle = weekday?.title ?: day.name
    val heroDescription = weekday?.description ?: day.description
    Card(Modifier.fillMaxWidth().testTag("calendar-selected-day"), shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Color(0x66dfc17e)),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
            Box(Modifier.fillMaxWidth().heightIn(min = 300.dp).testTag("calendar-day-hero")) {
                OriginalImage(heroPath, heroTitle, Modifier.matchParentSize().testTag("calendar-weekday-art"))
                Box(Modifier.matchParentSize().background(Brush.verticalGradient(
                    0f to Color(0x15040e10), .45f to Color(0x55040e10), 1f to Color(0xf5071d20))))
                Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(modeTitle, style = MaterialTheme.typography.labelMedium, color = Color(0xffdfc17e))
                    Text(primaryDate, style = MaterialTheme.typography.headlineSmall,
                        color = Color(0xfff9f2e2), modifier = Modifier.testTag("calendar-selected-primary-date"))
                    Text(heroTitle, style = MaterialTheme.typography.titleMedium, color = Color(0xfff1e5cb))
                    Text(heroDescription, style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xffeee6d7), maxLines = 4)
                }
            }
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (mode == CalendarMode.PROFANE) {
                    val patron = weekdayPatronMark(date)
                    Surface(color = MaterialTheme.colorScheme.primaryContainer,
                        shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()
                            .testTag("calendar-selected-patron")) {
                        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(patron.symbol, style = MaterialTheme.typography.headlineMedium, color = patron.accent)
                            Column {
                                Text(patron.guidance, style = MaterialTheme.typography.titleSmall, color = patron.accent)
                                Text(patron.patrons, style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer)
                            }
                        }
                    }
                    weekday?.details?.forEach { detail ->
                        Text(detail, style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                } else Text(date.format(dateLabel(locale)), style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary)

                CalendarSelectedDayFacts(date, calendar, solarLocation, mode)
                dayActions(date)
                Button(onClick = { onOpenDay(date) }, modifier = Modifier.fillMaxWidth()) {
                    Text("Открыть день и задачи")
                }
            }
        }
    }
}

@Composable
private fun CalendarYearOverview(calendar: GenesisCalendar, shown: LocalDate, mode: CalendarMode,
    onModeChange: (CalendarMode) -> Unit,
    experimental: Boolean, tasks: List<LocalTask>,
    gregorianYearStartsInMarch: Boolean, regionalSeasonArt: Boolean, seasonRegionZone: ZoneId,
    onStartGregorianYearInMarch: () -> Unit,
    onMonth: (LocalDate) -> Unit, onYear: (LocalDate) -> Unit) {
    val sacredYear = calendar.sacredDate(shown).sacredYear
    val period = if (mode == CalendarMode.PROFANE) LocalDate.of(
        shown.year - if (gregorianYearStartsInMarch && shown.monthValue < 3) 1 else 0,
        if (gregorianYearStartsInMarch) 3 else 1, 1)
        else LocalDate.of(sacredYear, 3, 20)
    val context = LocalContext.current
    val suggestionPrefs = remember(context) { context.getSharedPreferences("genesis.calendar-suggestions", android.content.Context.MODE_PRIVATE) }
    var springSuggestionDismissed by remember { mutableStateOf(suggestionPrefs.getBoolean("spring-year-dismissed", false)) }
    Column(Modifier.fillMaxSize().testTag("calendar-year").verticalScroll(rememberScrollState())
        .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        CalendarPageHeader(true, mode, onModeChange,
            Modifier.padding(vertical = 8.dp))
        CalendarPeriodPager(period, period.minusYears(1), period.plusYears(1),
            { onYear(period.minusYears(1)) }, { onYear(period.plusYears(1)) },
            Modifier.fillMaxWidth()) { page, previous, next ->
            CalendarYearPanel(calendar, page, mode, experimental, tasks,
                gregorianYearStartsInMarch, regionalSeasonArt, seasonRegionZone,
                springSuggestionDismissed, onStartGregorianYearInMarch,
                { springSuggestionDismissed = true; suggestionPrefs.edit().putBoolean("spring-year-dismissed", true).apply() },
                onMonth, previous, next)
        }
        Spacer(Modifier.height(80.dp))
    }
}

@Composable
private fun CalendarYearPanel(calendar: GenesisCalendar, shown: LocalDate, mode: CalendarMode,
    experimental: Boolean, tasks: List<LocalTask>,
    gregorianYearStartsInMarch: Boolean, regionalSeasonArt: Boolean, seasonRegionZone: ZoneId,
    springSuggestionDismissed: Boolean, onStartGregorianYearInMarch: () -> Unit,
    onDismissSpringSuggestion: () -> Unit,
    onMonth: (LocalDate) -> Unit,
    onPrevious: () -> Unit, onNext: () -> Unit) {
    val locale = Locale.forLanguageTag(LocalGenesisLanguage.current)
    val sacredYear = calendar.sacredDate(shown).sacredYear
    val yearLabel = if (mode == CalendarMode.PROFANE && gregorianYearStartsInMarch)
        "${shown.year}–${shown.year + 1}" else if (mode == CalendarMode.PROFANE) shown.year.toString() else sacredYear.toString()
    val entries = remember(shown, mode, locale, gregorianYearStartsInMarch) { runCatching {
        when (mode) {
            CalendarMode.SACRED -> SacredCatalog.months.map { month ->
                Triple(calendar.gregorianDate(sacredYear, month.index, 1), month.name, month.title)
            }
            CalendarMode.PROFANE -> (0..11).map { offset ->
                val monthStart = shown.plusMonths(offset.toLong()).withDayOfMonth(1)
                Triple(monthStart, Month.of(monthStart.monthValue)
                    .getDisplayName(TextStyle.FULL_STANDALONE, locale).replaceFirstChar { it.titlecase(locale) }, "")
            }
            CalendarMode.LUNAR -> calendar.lunarYear(sacredYear).let { year ->
                (0 until year.monthCount).map { ordinal ->
                    Triple(calendar.lunarMonthStart(year.startMonthIndex + ordinal),
                        SacredCatalog.lunarMonths[ordinal].name, SacredCatalog.lunarMonths[ordinal].title)
                }
            }
        }
    } }
    if (entries.isFailure) {
        Column(Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CalendarPeriodNavigation(yearLabel, true, onPrevious, onNext)
            Text("Этот год вне диапазона офлайн-календаря.", color = MaterialTheme.colorScheme.error)
        }
        return
    }
    val months = entries.getOrThrow()
    val yearSeasonGroups = remember(months, seasonRegionZone) {
        val southern = isSouthernSeasonRegion(seasonRegionZone)
        val groups = mutableListOf<Pair<GregorianSeason, MutableList<Triple<LocalDate, String, String>>>>()
        months.forEach { entry ->
            val season = seasonForGregorianMonth(entry.first.monthValue, southern)
            if (groups.lastOrNull()?.first != season) groups.add(season to mutableListOf())
            groups.last().second.add(entry)
        }
        groups
    }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val yearColumns = if (maxWidth >= 780.dp) 2 else 1
        Card(Modifier.fillMaxWidth().testTag("calendar-year-panel"),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = .45f))) {
            Column(Modifier.fillMaxWidth().padding(bottom = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                CalendarPeriodNavigation(yearLabel, true, onPrevious, onNext)
        if (experimental) {
            val events = calendar.solarEvents(if (mode == CalendarMode.PROFANE) shown.year else sacredYear)
            Column(Modifier.padding(horizontal = 12.dp).testTag("calendar-year-solar-points"),
                verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Солнечные точки года", style = MaterialTheme.typography.titleMedium)
                events.chunked(if (yearColumns == 2) 4 else 2).forEach { pair ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        pair.forEach { event ->
                            SolarPointTile(event, calendar, onMonth, Modifier.weight(1f))
                        }
                    }
                }
            }
        }
        if (mode == CalendarMode.PROFANE && !gregorianYearStartsInMarch && !springSuggestionDismissed) {
            val copy = springYearCopy(LocalGenesisLanguage.current)
            Card(Modifier.fillMaxWidth().padding(horizontal = 10.dp).testTag("spring-year-suggestion"),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xff173b38)),
                border = BorderStroke(1.dp, Color(0xffdfc17e).copy(alpha = .65f))) {
                Row(Modifier.fillMaxWidth().padding(12.dp),
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        androidx.compose.material3.Text(copy.title, color = Color(0xfffff5df),
                            style = MaterialTheme.typography.titleMedium)
                        androidx.compose.material3.Text(copy.body, color = Color(0xffc8d9d4),
                            style = MaterialTheme.typography.bodySmall)
                        TextButton(onClick = onStartGregorianYearInMarch,
                            modifier = Modifier.testTag("spring-year-switch")) {
                            androidx.compose.material3.Text(copy.action, color = Color(0xffdfc17e))
                        }
                    }
                    IconButton(onClick = onDismissSpringSuggestion,
                        modifier = Modifier.size(40.dp).testTag("spring-year-dismiss")) {
                        androidx.compose.material3.Text("×", color = Color(0xffdfc17e),
                            style = MaterialTheme.typography.headlineSmall,
                            modifier = Modifier.semantics { contentDescription = copy.dismiss })
                    }
                }
            }
        }
        if (mode == CalendarMode.PROFANE) {
            yearSeasonGroups.withIndex().toList().chunked(yearColumns).forEach { row ->
              Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { (groupIndex, group) ->
                  val (season, seasonMonths) = group
                  Box(Modifier.weight(1f)) {
                    CompositionLocalProvider(LocalPreserveCalendarColors provides true) {
                    Card(Modifier.fillMaxWidth().testTag(
                        "gregorian-season-${season.name.lowercase()}${if (groupIndex > 0 && season == GregorianSeason.WINTER) "-end" else ""}"),
                        shape = RoundedCornerShape(22.dp),
                        colors = CardDefaults.cardColors(containerColor = seasonSurface(season)
                            .copy(alpha = if (LocalEveningTheme.current) .22f else .78f)),
                        border = BorderStroke(1.dp, seasonAccent(season).copy(alpha = .3f))) {
                        Box {
                        OriginalImage(gregorianSeasonArtPath(season.name.lowercase(), seasonRegionZone,
                            regionalSeasonArt), null,
                            Modifier.matchParentSize().alpha(if (LocalEveningTheme.current) .78f else .39f)
                                .testTag("gregorian-season-art-${season.name.lowercase()}"))
                        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(if (LocalGenesisLanguage.current == "en") season.englishTitle else season.title,
                                Modifier.padding(start = 8.dp, top = 6.dp, bottom = 4.dp),
                                style = MaterialTheme.typography.titleLarge, color = seasonAccent(season))
                            seasonMonths.forEachIndexed { index, (start, name, title) ->
                                if (index > 0) HorizontalDivider(color = seasonAccent(season).copy(alpha = .18f))
                                CalendarYearMonthCard(calendar, start, mode, start.monthValue, name, title,
                                    tasks, onMonth, locale)
                            }
                        }
                        }
                    }
                    }
                  }
                }
                if (row.size < yearColumns) Spacer(Modifier.weight(1f))
              }
            }
        } else months.withIndex().toList().chunked(yearColumns).forEach { row ->
            Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { (ordinal, entry) ->
                    val (start, name, title) = entry
                    Box(Modifier.weight(1f)) {
                        CalendarYearMonthCard(calendar, start, mode, ordinal + 1, name, title, tasks, onMonth, locale)
                    }
                }
                if (row.size < yearColumns) Spacer(Modifier.weight(1f))
            }
        }
        Box(Modifier.padding(horizontal = 10.dp)) {
            CalendarYearDescriptionCard(calendar, shown, mode, gregorianYearStartsInMarch)
        }
            }
        }
    }
}

@Composable
private fun CalendarYearMonthCard(calendar: GenesisCalendar, start: LocalDate, mode: CalendarMode, ordinal: Int,
    name: String, title: String, tasks: List<LocalTask>, onMonth: (LocalDate) -> Unit,
    locale: Locale) {
    val english = LocalGenesisLanguage.current == "en"
    val range = calendar.monthRange(start, mode)
    val sacredIndex = if (mode == CalendarMode.SACRED) calendar.sacredDate(start).monthIndex else -1
    val monthTag = when (mode) {
        CalendarMode.SACRED -> "sacred-year-month-$sacredIndex"
        CalendarMode.PROFANE -> "calendar-year-month-$start"
        CalendarMode.LUNAR -> "lunar-year-month-$ordinal"
    }
    val rangeLabel = if (range.start.year == range.end.year) {
        "${range.start.format(DateTimeFormatter.ofPattern("d MMMM", locale))} — " +
            range.end.format(DateTimeFormatter.ofPattern("d MMMM yyyy", locale))
        } else {
        "${range.start.format(DateTimeFormatter.ofPattern("d MMMM yyyy", locale))} — " +
            range.end.format(DateTimeFormatter.ofPattern("d MMMM yyyy", locale))
    }
    val count = TaskOccurrences.countInRange(tasks, range.start, range.end)
    val season = GregorianSeason.entries.first { start.monthValue in it.months }
    val mainInk = if(mode == CalendarMode.PROFANE && LocalEveningTheme.current) MaterialTheme.colorScheme.onSurface else Color(0xff102b2c)
    val detailInk = if(mode == CalendarMode.PROFANE && LocalEveningTheme.current) MaterialTheme.colorScheme.onSurfaceVariant else Color(0xff405b59)
    Card(onClick = { onMonth(start) }, modifier = Modifier.fillMaxWidth()
        .testTag(monthTag), shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = if (mode == CalendarMode.PROFANE)
            seasonSurface(season).copy(alpha = if (LocalEveningTheme.current) .62f else 1f) else Color(0xfff5f0e6)),
        border = if (mode == CalendarMode.PROFANE) null else BorderStroke(1.dp, Color(0x668b6727))) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            when (mode) {
            CalendarMode.SACRED -> OriginalImage(sacredMonthArtPath(sacredIndex), "Иллюстрация месяца $name",
                Modifier.width(76.dp).height(112.dp))
            CalendarMode.PROFANE -> Surface(Modifier.size(74.dp), shape = RoundedCornerShape(17.dp),
                color = seasonAccent(season).copy(alpha = .1f), border = BorderStroke(1.dp, seasonAccent(season).copy(alpha = .3f))) {
                Box(contentAlignment = Alignment.Center) {
                    Text(ordinal.toString(), color = mainInk,
                        style = MaterialTheme.typography.headlineMedium,
                        modifier = Modifier.testTag("gregorian-year-number-$ordinal"))
                }
            }
            CalendarMode.LUNAR -> Box(Modifier.size(74.dp), contentAlignment = Alignment.Center) {
                MoonPhaseIcon(11, size = 70.dp)
                Surface(shape = CircleShape, color = Color(0xdff5f0e6),
                    border = BorderStroke(1.dp, Color(0xff8b6727))) {
                    Text(ordinal.toString(), Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
                        color = Color(0xff0b2b2d), style = MaterialTheme.typography.titleMedium)
                }
            }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (mode != CalendarMode.PROFANE) Text(when (mode) {
                    CalendarMode.LUNAR -> if (english) "LUNAR MONTH $ordinal" else "ЛУННЫЙ МЕСЯЦ $ordinal"
                    CalendarMode.PROFANE -> ""
                    CalendarMode.SACRED -> SacredCatalog.months[sacredIndex].let { month ->
                        if (sacredIndex == 12) { if (english) "OUTSIDE TIME" else "ВНЕ ВРЕМЕНИ" }
                        else if (english) "SACRED MONTH ${month.roman}" else "САКРАЛЬНЫЙ МЕСЯЦ ${month.roman}"
                    }
                },
                    color = Color(0xff8b6727), style = MaterialTheme.typography.labelSmall)
                Text(name, color = mainInk, style = MaterialTheme.typography.titleLarge)
                if (title.isNotBlank()) Text(title, color = detailInk, style = MaterialTheme.typography.bodySmall,
                    maxLines = 2)
                if (mode != CalendarMode.PROFANE) Text(rangeLabel, color = Color(0xff102b2c), style = MaterialTheme.typography.labelMedium,
                    modifier = Modifier.testTag(if (mode == CalendarMode.LUNAR) "lunar-year-range-$ordinal"
                        else "sacred-year-range-$sacredIndex"))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Text(if (english) "${range.dates().size} days" else "${range.dates().size} дней",
                        color = detailInk, style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.testTag("calendar-year-days-$ordinal"))
                }
                if (mode == CalendarMode.PROFANE) Text(if (english) "$count tasks" else "$count задач",
                    color = detailInk, style = MaterialTheme.typography.labelMedium,
                    modifier = Modifier.testTag("calendar-year-task-count-$ordinal"))
                    if (count > 0) {
                        val completed = TaskOccurrences.countInRange(tasks.filter { it.done }, range.start, range.end)
                        Column {
                            if (count > completed) Text(genesisTranslate("Не выполнено") + ": ${count - completed}",
                                color = if(LocalEveningTheme.current) Color(0xffed7b7e) else calendarIncompleteColor, style = MaterialTheme.typography.labelSmall)
                            if (completed > 0) Text(genesisTranslate("Выполнено") + ": $completed",
                                color = if(LocalEveningTheme.current) Color(0xff8dcfa9) else calendarCompletedColor, style = MaterialTheme.typography.labelSmall)
                        }
                    }
            }
            Text("›", color = Color(0xff8b6727), style = MaterialTheme.typography.titleLarge)
        }
    }
}

@Composable
private fun SolarPointTile(event: SolarEvent, calendar: GenesisCalendar,
    onMonth: (LocalDate) -> Unit, modifier: Modifier = Modifier) {
    val locale = Locale.forLanguageTag(LocalGenesisLanguage.current)
    val tileHeight = (148f * maxOf(1f, LocalDensity.current.fontScale)).dp
    val evening = LocalEveningTheme.current
    val solarAccent = if (evening) Color(0xffdfc17e) else Color(0xff715923)
    val solarInk = if (evening) Color(0xfffff5df) else Color(0xff253a36)
    Surface(onClick = { onMonth(event.date) }, modifier = modifier.height(tileHeight)
        .testTag("solar-point-${event.date}"), shape = MaterialTheme.shapes.medium,
        color = if (evening) Color(0xff183432) else Color(0xfff5ecd6),
        border = BorderStroke(1.dp, Color(0xffd7bd79))) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(event.symbol, style = MaterialTheme.typography.titleLarge, color = solarAccent)
            androidx.compose.foundation.text.BasicText(genesisTranslate(event.shortName),
                style = MaterialTheme.typography.labelMedium.copy(color = solarAccent),
                maxLines = 1, softWrap = false,
                autoSize = TextAutoSize.StepBased(minFontSize = 9.sp, maxFontSize = 12.sp))
            Text(event.date.dayOfWeek.getDisplayName(TextStyle.FULL, locale),
                style = MaterialTheme.typography.bodySmall, color = solarInk)
            Text(event.date.format(DateTimeFormatter.ofPattern("d MMMM yyyy", locale)),
                style = MaterialTheme.typography.titleSmall, color = solarInk)
            Text(event.instant.atZone(calendar.zoneId).format(DateTimeFormatter.ofPattern("HH:mm z", locale)),
                style = MaterialTheme.typography.labelSmall, color = solarAccent)
        }
    }
}
