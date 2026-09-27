package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import java.time.Month
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

private val ru = Locale.forLanguageTag("ru")
private fun dateLabel(locale: Locale) = DateTimeFormatter.ofPattern("d MMM yyyy", locale)

internal fun sacredMonthArtPath(index: Int): String {
    require(index in 0..12)
    return "month-art-v4/month-${(index + 1).toString().padStart(2, '0')}.webp"
}

/** The display calendar controls this screen only; task input and recurrence remain independent. */
@Composable
fun CalendarScreen(date: LocalDate, mode: CalendarMode, onSelect: (LocalDate) -> Unit,
    experimental: Boolean = false, tasks: List<LocalTask> = emptyList()) {
    val calendar = remember { GenesisCalendar() }
    var shown by rememberSaveable(mode, date) { mutableStateOf(date.toString()) }
    var selected by rememberSaveable(mode, date) { mutableStateOf(date.toString()) }
    var yearView by rememberSaveable { mutableStateOf(false) }
    var taskListDate by rememberSaveable { mutableStateOf<String?>(null) }
    val shownDate = LocalDate.parse(shown)
    val range = remember(shownDate, mode) { runCatching { calendar.monthRange(shownDate, mode) } }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Календарь", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
            FilterChip(selected = !yearView, onClick = { yearView = false }, label = { Text("Месяц") })
            FilterChip(selected = yearView, onClick = { yearView = true }, label = { Text("Год") })
        }
        if (yearView) CalendarYearOverview(calendar, shownDate, mode, experimental, tasks,
            onMonth = { shown = it.toString(); selected = it.toString(); yearView = false },
            onYear = { shown = it.toString() })
        else if (range.isFailure) Text("Этот период вне диапазона офлайн-календаря.",
            Modifier.padding(16.dp), color = MaterialTheme.colorScheme.error)
        else CalendarMonthContent(calendar, range.getOrThrow(), mode, LocalDate.parse(selected), experimental, tasks,
            onNavigate = { shown = it.toString(); selected = it.toString() },
            onChoose = { selected = it.toString() }, onOpenDay = onSelect,
            onOpenTaskList = { taskListDate = it.toString() })
    }
    taskListDate?.let { rawDate ->
        val taskDate = LocalDate.parse(rawDate)
        val dayTasks = remember(tasks, rawDate) {
            TaskOccurrences.byDate(tasks, taskDate, taskDate)[rawDate].orEmpty()
        }
        CalendarTaskListDialog(taskDate, dayTasks, onDismiss = { taskListDate = null }) {
            taskListDate = null
            onSelect(taskDate)
        }
    }
}

@Composable
private fun CalendarMonthContent(calendar: GenesisCalendar, range: CalendarRange, mode: CalendarMode,
    selected: LocalDate, experimental: Boolean, tasks: List<LocalTask>,
    onNavigate: (LocalDate) -> Unit, onChoose: (LocalDate) -> Unit,
    onOpenDay: (LocalDate) -> Unit, onOpenTaskList: (LocalDate) -> Unit) {
    val firstSacred = calendar.sacredDate(range.start)
    val locale = if (LocalGenesisLanguage.current == "en") Locale.ENGLISH else ru
    val sacredMonth = SacredCatalog.months[firstSacred.monthIndex]
    val solarLocation by rememberAutomaticSolarLocation(calendar.zoneId)
    val scroll = rememberScrollState()
    var previewRequested by remember(range.start) { mutableStateOf(false) }
    LaunchedEffect(selected, previewRequested) {
        if (previewRequested) scroll.animateScrollTo(scroll.maxValue)
    }
    val choose: (LocalDate) -> Unit = { day -> previewRequested = true; onChoose(day) }
    Column(Modifier.fillMaxSize().verticalScroll(scroll).padding(horizontal = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = { onNavigate(range.start.minusDays(1)) },
                modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)) { Text("←") }
            Text(when (mode) {
                CalendarMode.SACRED -> "${sacredMonth.roman} · ${sacredMonth.name}"
                CalendarMode.PROFANE -> range.start.month.getDisplayName(TextStyle.FULL_STANDALONE, locale)
                    .replaceFirstChar { it.titlecase(locale) } + " ${range.start.year}"
                CalendarMode.LUNAR -> calendar.lunarDate(range.start).month.name
            }, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
            TextButton(onClick = { onNavigate(range.end.plusDays(1)) },
                modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)) { Text("→") }
        }
        if (mode == CalendarMode.SACRED) SacredMonthHero(sacredMonth, firstSacred.sacredYear)
        else Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(if (mode == CalendarMode.LUNAR) calendar.lunarDate(range.start).month.title
                    else "Григорианский месяц", style = MaterialTheme.typography.titleMedium)
                Text(if (mode == CalendarMode.LUNAR) calendar.lunarDate(range.start).month.description
                    else "Обычный календарь отображения. Дата и повторение задач выбираются отдельно.",
                    style = MaterialTheme.typography.bodyMedium)
            }
        }
        Text("${range.start.format(dateLabel(locale))} — ${range.end.format(dateLabel(locale))}",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        val tasksByDate = remember(tasks, range) { TaskOccurrences.byDate(tasks, range.start, range.end) }
        if (mode == CalendarMode.SACRED) SacredDayGrid(calendar, range, selected, choose, experimental,
            tasksByDate, onOpenTaskList, solarLocation)
        else SevenDayGrid(calendar, range, mode, selected, choose, experimental, tasksByDate,
            onOpenTaskList, solarLocation)
        SelectedDayCard(calendar, selected, mode, onOpenDay, experimental,
            tasksByDate[selected.toString()].orEmpty(), solarLocation)
        TextButton(onClick = { onNavigate(LocalDate.now()) }) { Text("К текущему месяцу") }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun SacredMonthHero(month: SacredMonth, year: Int) {
    Card(Modifier.fillMaxWidth().testTag("sacred-month-hero")) {
        Row(Modifier.fillMaxWidth()) {
            OriginalImage(sacredMonthArtPath(month.index), "Иллюстрация месяца ${month.name}",
                Modifier.width(120.dp).height(190.dp))
            Column(Modifier.weight(1f).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("${month.season} · ${month.roman} месяц · $year", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary)
                Text(month.name, style = MaterialTheme.typography.titleLarge)
                Text(month.title, style = MaterialTheme.typography.titleSmall)
                Text(month.description, style = MaterialTheme.typography.bodySmall)
            }
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
                    solarLocation = if (experimental) solarLocation else null)
            }
            repeat(5 - dates.size) { Spacer(Modifier.weight(1f)) }
        }
    }
}

@Composable
private fun SevenDayGrid(calendar: GenesisCalendar, range: CalendarRange, mode: CalendarMode,
    selected: LocalDate, onChoose: (LocalDate) -> Unit, experimental: Boolean,
    tasksByDate: Map<String, List<LocalTask>>, onOpenTaskList: (LocalDate) -> Unit,
    solarLocation: SolarLocation) {
    val sundayFirst = mode == CalendarMode.PROFANE
    val english = LocalGenesisLanguage.current == "en"
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(1.dp)) {
        (if (sundayFirst && english) listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
            else if (english) listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
            else if (sundayFirst) listOf("Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб")
            else listOf("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс")).forEach {
            Text(it, Modifier.weight(1f), style = MaterialTheme.typography.labelSmall)
        }
    }
    val leading = weekLeadingOffset(range.start, mode)
    val days: List<LocalDate?> = when (mode) {
        CalendarMode.PROFANE -> gregorianGridDates(range)
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
                    val adjacentAlpha = if (!adjacent || leading == 0) 1f
                        else 0.2f + 0.24f * ((absoluteIndex + 1f) / leading.toFloat())
                    LunarCalendarDay(calendar, date, date == selected, onChoose, Modifier.weight(1f),
                        if (experimental && !adjacent) tasksByDate[date.toString()].orEmpty().size else 0,
                        adjacent, adjacentAlpha, onOpenTaskList,
                        if (experimental) solarLocation else null)
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
                    solarLocation = if (experimental) solarLocation else null)
            }
            repeat(7 - week.size) { Spacer(Modifier.weight(1f)) }
        }
    }
}

internal fun weekLeadingOffset(date: LocalDate, mode: CalendarMode): Int =
    if (mode == CalendarMode.PROFANE) date.dayOfWeek.value % 7 else date.dayOfWeek.value - 1

/** Gregorian rows include the previous/next month's dates as read-only, fading context. */
internal fun gregorianGridDates(range: CalendarRange): List<LocalDate> {
    val leading = weekLeadingOffset(range.start, CalendarMode.PROFANE)
    val trailing = (7 - (leading + range.dates().size) % 7) % 7
    return (leading downTo 1).map { range.start.minusDays(it.toLong()) } + range.dates() +
        (1..trailing).map { range.end.plusDays(it.toLong()) }
}

/** Lunar leading cells show the closing days of the previous month as read-only context. */
internal fun lunarGridDates(range: CalendarRange): List<LocalDate> {
    val leading = weekLeadingOffset(range.start, CalendarMode.LUNAR)
    return (leading downTo 1).map { range.start.minusDays(it.toLong()) } + range.dates()
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
    require(sacredDay in 1..30 && pyata in 1..6 && monthIndex in genesisMonthRomans.indices)
    val dayInsidePyata = (sacredDay - 1) % 5 + 1
    return "${genesisRoman(dayInsidePyata)}/$pyata/${genesisMonthRomans[monthIndex]}"
}

@Composable
private fun LunarCalendarDay(calendar: GenesisCalendar, date: LocalDate, selected: Boolean,
    onChoose: (LocalDate) -> Unit, modifier: Modifier, taskCount: Int, adjacent: Boolean,
    adjacentAlpha: Float, onTaskBadgeClick: (LocalDate) -> Unit, solarLocation: SolarLocation?) {
    val lunar = calendar.lunarDate(date)
    val moon = calendar.moonInfo(date)
    val sacred = calendar.sacredDate(date)
    val locale = if (LocalGenesisLanguage.current == "en") Locale.ENGLISH else ru
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
            Column(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 6.dp),
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
                val taskDescription = genesisTranslate("$taskCount задач на ${date.format(dateLabel(locale))}. Открыть список.")
                Surface(onClick = { onTaskBadgeClick(date) }, modifier = Modifier.align(Alignment.BottomEnd)
                    .padding(end = 3.dp, bottom = 3.dp).sizeIn(minWidth = 24.dp, minHeight = 24.dp)
                    .testTag("calendar-task-count-$date").semantics { contentDescription = taskDescription },
                    shape = CircleShape, color = Color(0xffb63b42)) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(if (taskCount > 99) "99+" else taskCount.toString(), color = Color.White,
                            style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}

@Composable
private fun CalendarDay(calendar: GenesisCalendar, date: LocalDate, number: Int, sublabel: String?, fullName: String,
    selected: Boolean, onChoose: (LocalDate) -> Unit, modifier: Modifier,
    moon: MoonInfo?, crossDate: String?, taskCount: Int, solar: SolarEvent?,
    patron: WeekdayPatronMark? = null, adjacent: Boolean = false,
    onTaskBadgeClick: (LocalDate) -> Unit = {}, solarLocation: SolarLocation? = null) {
    val today = !adjacent && date == LocalDate.now()
    val locale = if (LocalGenesisLanguage.current == "en") Locale.ENGLISH else ru
    val solarLabels = solarLocation?.let { solarTimeLabels(date, it, calendar) }
    val dayDescription = genesisTranslate("$number · $fullName · ${date.format(dateLabel(locale))}" +
        (patron?.let { " · ${it.symbol} ${it.patrons}" } ?: "") +
        (moon?.let { " · ${it.day} лунный день · ${it.phase}, ${it.illumination}%" } ?: "") +
        (if (taskCount > 0) " · $taskCount задач" else "") +
        (solar?.let { " · ${it.name}" } ?: "") +
        (solarLabels?.let { " · Восход ${it.first}, закат ${it.second}" } ?: "") +
        (if (adjacent) " · Другой месяц, только просмотр" else ""))
    val taskDescription = genesisTranslate("$taskCount задач на ${date.format(dateLabel(locale))}. Открыть список.")
    val foreground = if (selected && patron != null) patron.selectedForeground else MaterialTheme.colorScheme.onSurface
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
            patron != null -> patron.wash
            else -> MaterialTheme.colorScheme.surface
        },
        border = if (today) BorderStroke(2.dp, patron?.accent ?: MaterialTheme.colorScheme.primary) else null) {
        Box(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(start = 5.dp, top = 5.dp, end = 34.dp, bottom = 5.dp),
            verticalArrangement = Arrangement.Center) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Text(number.toString(), style = MaterialTheme.typography.titleSmall, color = foreground)
                if (taskCount == 0) patron?.let { Text(it.symbol, style = MaterialTheme.typography.titleSmall,
                    color = if (selected) foreground else it.accent) }
            }
            Text(if (adjacent) date.month.getDisplayName(TextStyle.SHORT_STANDALONE, locale)
                else sublabel ?: date.dayOfWeek.getDisplayName(TextStyle.SHORT, locale),
                style = MaterialTheme.typography.labelSmall, color = foreground)
            if (moon != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    MoonPhaseIcon(moon.phaseStep, size = 15.dp)
                    Text(moon.day.toString(), style = MaterialTheme.typography.labelSmall, color = foreground)
                }
                if (crossDate != null) Text(crossDate, style = MaterialTheme.typography.labelSmall,
                    maxLines = 1, color = if (selected && patron != null) foreground else MaterialTheme.colorScheme.onSurfaceVariant)
                if (solar != null || (patron != null && taskCount > 0)) Text(listOfNotNull(
                    solar?.symbol, patron?.takeIf { taskCount > 0 }?.symbol).joinToString(" "),
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
            Surface(onClick = { onTaskBadgeClick(date) }, modifier = Modifier.align(Alignment.TopEnd)
                .padding(top = 3.dp, end = 3.dp).sizeIn(minWidth = 26.dp, minHeight = 26.dp)
                .testTag("calendar-task-count-$date")
                .semantics { contentDescription = taskDescription },
                shape = CircleShape, color = Color(0xffb63b42), shadowElevation = 3.dp) {
                Box(contentAlignment = Alignment.Center) {
                    Text(if (taskCount > 99) "99+" else taskCount.toString(),
                        Modifier.padding(horizontal = 5.dp), color = Color.White,
                        style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        }
    }
}

@Composable
private fun CalendarTaskListDialog(date: LocalDate, tasks: List<LocalTask>, onDismiss: () -> Unit,
    onOpenDay: () -> Unit) {
    val locale = if (LocalGenesisLanguage.current == "en") Locale.ENGLISH else ru
    Dialog(onDismissRequest = onDismiss) {
        Surface(Modifier.fillMaxWidth().heightIn(max = 560.dp).testTag("calendar-task-list-dialog"),
            shape = RoundedCornerShape(24.dp), color = Color(0xfffffbf2),
            border = BorderStroke(1.dp, Color(0x66b28a4a)), shadowElevation = 18.dp) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Surface(Modifier.size(44.dp), shape = CircleShape, color = Color(0xffb63b42)) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(tasks.size.toString(), color = Color.White,
                                style = MaterialTheme.typography.titleMedium)
                        }
                    }
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
                    items(tasks, key = { it.id }) { task ->
                        Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp),
                            color = if (task.done) Color(0xffe8f0ea) else Color(0xfff4ecdc)) {
                            Row(Modifier.fillMaxWidth().padding(12.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                Text(if (task.done) "✓" else "○", color = if (task.done)
                                    Color(0xff255b59) else Color(0xffb63b42),
                                    style = MaterialTheme.typography.titleMedium)
                                Column(Modifier.weight(1f)) {
                                    androidx.compose.material3.Text(task.title,
                                        style = MaterialTheme.typography.titleSmall, maxLines = 2)
                                    Text(listOfNotNull(task.time.takeIf { it.isNotBlank() },
                                        task.project.takeIf { it.isNotBlank() }).joinToString(" · ").ifBlank { "Без времени" },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant)
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
}

@Composable
private fun SelectedDayCard(calendar: GenesisCalendar, date: LocalDate, mode: CalendarMode,
    onOpenDay: (LocalDate) -> Unit, experimental: Boolean, tasks: List<LocalTask>,
    solarLocation: SolarLocation) {
    if (experimental) {
        ExperimentalSelectedDayCard(calendar, date, mode, onOpenDay, tasks, solarLocation)
        return
    }
    val sacred = calendar.sacredDate(date)
    val month = SacredCatalog.months[sacred.monthIndex]
    val day = month.days[sacred.day - 1]
    val locale = if (LocalGenesisLanguage.current == "en") Locale.ENGLISH else ru
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
                tasks.take(5).forEach { task -> Text("${if (task.done) "✓" else "○"} ${task.title}",
                    style = MaterialTheme.typography.bodySmall, maxLines = 1) }
                if (tasks.size > 5) Text("И ещё ${tasks.size - 5}…", style = MaterialTheme.typography.labelSmall)
            }
            Button(onClick = { onOpenDay(date) }) { Text("Открыть день и задачи") }
        }
    }
}

@Composable
private fun ExperimentalSelectedDayCard(calendar: GenesisCalendar, date: LocalDate, mode: CalendarMode,
    onOpenDay: (LocalDate) -> Unit, tasks: List<LocalTask>, solarLocation: SolarLocation) {
    val sacred = calendar.sacredDate(date)
    val month = SacredCatalog.months[sacred.monthIndex]
    val day = month.days[sacred.day - 1]
    val lunar = calendar.lunarDate(date)
    val locale = if (LocalGenesisLanguage.current == "en") Locale.ENGLISH else ru
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

                CalendarSelectedDayFacts(date, calendar, solarLocation)
                Surface(color = MaterialTheme.colorScheme.surfaceContainerHigh,
                    shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text("Задачи дня · ${tasks.size}", style = MaterialTheme.typography.titleSmall)
                        if (tasks.isEmpty()) Text("На этот день задач нет.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        tasks.take(5).forEach { task -> Text("${if (task.done) "✓" else "○"} ${task.title}",
                            style = MaterialTheme.typography.bodySmall, maxLines = 1) }
                        if (tasks.size > 5) Text("И ещё ${tasks.size - 5}…", style = MaterialTheme.typography.labelSmall)
                    }
                }
                Button(onClick = { onOpenDay(date) }, modifier = Modifier.fillMaxWidth()) {
                    Text("Открыть день и задачи")
                }
            }
        }
    }
}

@Composable
private fun CalendarYearOverview(calendar: GenesisCalendar, shown: LocalDate, mode: CalendarMode,
    experimental: Boolean, tasks: List<LocalTask>,
    onMonth: (LocalDate) -> Unit, onYear: (LocalDate) -> Unit) {
    val locale = if (LocalGenesisLanguage.current == "en") Locale.ENGLISH else ru
    val sacredYear = calendar.sacredDate(shown).sacredYear
    val yearLabel = if (mode == CalendarMode.PROFANE) shown.year.toString() else sacredYear.toString()
    val entries = remember(shown, mode) { runCatching {
        when (mode) {
            CalendarMode.SACRED -> SacredCatalog.months.map { month ->
                Triple(calendar.gregorianDate(sacredYear, month.index, 1), month.name, month.title)
            }
            CalendarMode.PROFANE -> (1..12).map { ordinal ->
                Triple(LocalDate.of(shown.year, ordinal, 1), Month.of(ordinal)
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
        Text("Этот год вне диапазона офлайн-календаря.", Modifier.padding(16.dp),
            color = MaterialTheme.colorScheme.error)
        return
    }
    val months = entries.getOrThrow()
    LazyColumn(Modifier.fillMaxSize().testTag("calendar-year"),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { onYear(if (mode == CalendarMode.PROFANE) shown.minusYears(1)
                    else LocalDate.of(sacredYear - 1, 3, 20)) },
                    modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)) { Text("←") }
                Text("Год $yearLabel", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
                TextButton(onClick = { onYear(if (mode == CalendarMode.PROFANE) shown.plusYears(1)
                    else LocalDate.of(sacredYear + 1, 3, 20)) },
                    modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)) { Text("→") }
            }
        }
        if (experimental) item {
            val events = calendar.solarEvents(if (mode == CalendarMode.PROFANE) shown.year else sacredYear)
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Солнечные точки года", style = MaterialTheme.typography.titleMedium)
                events.chunked(2).forEach { pair ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        pair.forEach { event ->
                            SolarPointTile(event, calendar, onMonth, Modifier.weight(1f))
                        }
                    }
                }
            }
        }
        items(months, key = { it.first.toString() }) { (start, name, title) ->
            val index = if (mode == CalendarMode.SACRED) calendar.sacredDate(start).monthIndex else -1
            Card(onClick = { onMonth(start) },
                modifier = Modifier.fillMaxWidth().testTag(if (index >= 0) "sacred-year-month-$index"
                    else "calendar-year-month-$start")) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (index >= 0) OriginalImage(sacredMonthArtPath(index), "Иллюстрация месяца $name",
                        Modifier.width(76.dp).height(112.dp))
                    Column(Modifier.weight(1f).padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(name, style = MaterialTheme.typography.titleMedium)
                        Text(title, style = MaterialTheme.typography.bodySmall, maxLines = 3)
                        Text(start.format(dateLabel(locale)), style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (experimental) {
                            if (mode == CalendarMode.LUNAR) Row(verticalAlignment = Alignment.CenterVertically) {
                                MoonPhaseIcon(calendar.moonInfo(start).phaseStep, size = 22.dp)
                                Text(" ${calendar.lunarDate(start).monthLength} дней",
                                    style = MaterialTheme.typography.labelSmall)
                            }
                            val monthRange = calendar.monthRange(start, mode)
                            val count = TaskOccurrences.countInRange(tasks, monthRange.start, monthRange.end)
                            if (count > 0) Text("$count задач", style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary)
                        }
                    }
                    Text("›", Modifier.padding(end = 12.dp), style = MaterialTheme.typography.titleLarge)
                }
            }
        }
        item { CalendarYearDescriptionCard(calendar, shown, mode) }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun SolarPointTile(event: SolarEvent, calendar: GenesisCalendar,
    onMonth: (LocalDate) -> Unit, modifier: Modifier = Modifier) {
    val locale = if (LocalGenesisLanguage.current == "en") Locale.ENGLISH else ru
    Surface(onClick = { onMonth(event.date) }, modifier = modifier.heightIn(min = 126.dp)
        .testTag("solar-point-${event.date}"), shape = MaterialTheme.shapes.medium,
        color = Color(0xfff5ecd6), border = BorderStroke(1.dp, Color(0xffd7bd79))) {
        Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(9.dp),
            verticalAlignment = Alignment.Top) {
            Text(event.symbol, style = MaterialTheme.typography.titleLarge, color = Color(0xff8b6727))
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(event.shortName, style = MaterialTheme.typography.labelMedium, color = Color(0xff715923))
                Text(event.date.dayOfWeek.getDisplayName(TextStyle.FULL, locale),
                    style = MaterialTheme.typography.bodySmall)
                Text(event.date.format(DateTimeFormatter.ofPattern("d MMMM yyyy", locale)),
                    style = MaterialTheme.typography.titleSmall)
                Text(event.instant.atZone(calendar.zoneId).format(DateTimeFormatter.ofPattern("HH:mm z", locale)),
                    style = MaterialTheme.typography.labelSmall, color = Color(0xff715923))
            }
        }
    }
}
