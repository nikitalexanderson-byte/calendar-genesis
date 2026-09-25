package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.CalendarRange
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.SacredCatalog
import ru.genesis.calendar.domain.SacredMonth
import ru.genesis.calendar.domain.MoonInfo
import ru.genesis.calendar.domain.SolarEvent
import ru.genesis.calendar.data.LocalTask
import ru.genesis.calendar.data.TaskOccurrences
import java.time.LocalDate
import java.time.Month
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

private val ru = Locale.forLanguageTag("ru")
private val dateLabel = DateTimeFormatter.ofPattern("d MMM yyyy", ru)

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
            onChoose = { selected = it.toString() }, onOpenDay = onSelect)
    }
}

@Composable
private fun CalendarMonthContent(calendar: GenesisCalendar, range: CalendarRange, mode: CalendarMode,
    selected: LocalDate, experimental: Boolean, tasks: List<LocalTask>,
    onNavigate: (LocalDate) -> Unit, onChoose: (LocalDate) -> Unit,
    onOpenDay: (LocalDate) -> Unit) {
    val firstSacred = calendar.sacredDate(range.start)
    val locale = if (LocalGenesisLanguage.current == "en") Locale.ENGLISH else ru
    val sacredMonth = SacredCatalog.months[firstSacred.monthIndex]
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
        Text("${range.start.format(dateLabel)} — ${range.end.format(dateLabel)}",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        val tasksByDate = remember(tasks, range) { TaskOccurrences.byDate(tasks, range.start, range.end) }
        if (mode == CalendarMode.SACRED) SacredDayGrid(calendar, range, selected, choose, experimental, tasksByDate)
        else SevenDayGrid(calendar, range, mode, selected, choose, experimental, tasksByDate)
        SelectedDayCard(calendar, selected, mode, onOpenDay, experimental, tasksByDate[selected.toString()].orEmpty())
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
    onChoose: (LocalDate) -> Unit, experimental: Boolean, tasksByDate: Map<String, List<LocalTask>>) {
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
                CalendarDay(date, sacred.day, listOf("I", "II", "III", "IIII", "V")[(sacred.day - 1) % 5],
                    definition.name, date == selected, onChoose, Modifier.weight(1f),
                    if (experimental) calendar.moonInfo(date) else null,
                    if (experimental) "${date.dayOfMonth}.${date.monthValue}" else null,
                    if (experimental) tasksByDate[date.toString()].orEmpty().size else 0,
                    if (experimental) calendar.solarEvent(date) else null)
            }
            repeat(5 - dates.size) { Spacer(Modifier.weight(1f)) }
        }
    }
}

@Composable
private fun SevenDayGrid(calendar: GenesisCalendar, range: CalendarRange, mode: CalendarMode,
    selected: LocalDate, onChoose: (LocalDate) -> Unit, experimental: Boolean,
    tasksByDate: Map<String, List<LocalTask>>) {
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
    val days = List<LocalDate?>(weekLeadingOffset(range.start, mode)) { null } + range.dates()
    days.chunked(7).forEach { week ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(1.dp)) {
            week.forEach { date ->
                if (date == null) Spacer(Modifier.weight(1f))
                else CalendarDay(date,
                    if (mode == CalendarMode.LUNAR) calendar.lunarDate(date).day else date.dayOfMonth,
                    null, calendar.formatDate(date, mode), date == selected, onChoose, Modifier.weight(1f),
                    if (experimental) calendar.moonInfo(date) else null,
                    if (experimental) calendar.sacredDate(date).let { "${it.day} · ${SacredCatalog.months[it.monthIndex].name}" } else null,
                    if (experimental) tasksByDate[date.toString()].orEmpty().size else 0,
                    if (experimental) calendar.solarEvent(date) else null)
            }
            repeat(7 - week.size) { Spacer(Modifier.weight(1f)) }
        }
    }
}

internal fun weekLeadingOffset(date: LocalDate, mode: CalendarMode): Int =
    if (mode == CalendarMode.PROFANE) date.dayOfWeek.value % 7 else date.dayOfWeek.value - 1

@Composable
private fun CalendarDay(date: LocalDate, number: Int, sublabel: String?, fullName: String,
    selected: Boolean, onChoose: (LocalDate) -> Unit, modifier: Modifier,
    moon: MoonInfo?, crossDate: String?, taskCount: Int, solar: SolarEvent?) {
    val today = date == LocalDate.now()
    val locale = if (LocalGenesisLanguage.current == "en") Locale.ENGLISH else ru
    Surface(onClick = { onChoose(date) }, modifier = modifier.heightIn(min = if (moon == null) 64.dp else 96.dp)
        .semantics { contentDescription = "$number · $fullName · ${date.format(dateLabel)}" +
            (moon?.let { " · ${it.day} лунный день · ${it.phase}, ${it.illumination}%" } ?: "") +
            (if (taskCount > 0) " · $taskCount задач" else "") +
            (solar?.let { " · ${it.name}" } ?: "") }
        .testTag("calendar-day-$date"),
        shape = MaterialTheme.shapes.medium,
        color = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        border = if (today) BorderStroke(2.dp, MaterialTheme.colorScheme.primary) else null) {
        Column(Modifier.padding(5.dp), verticalArrangement = Arrangement.Center) {
            Text(number.toString(), style = MaterialTheme.typography.titleSmall)
            Text(sublabel ?: date.dayOfWeek.getDisplayName(TextStyle.SHORT, locale),
                style = MaterialTheme.typography.labelSmall)
            if (moon != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    MoonPhaseIcon(moon.phaseStep, size = 15.dp)
                    Text(moon.day.toString(), style = MaterialTheme.typography.labelSmall)
                }
                if (crossDate != null) Text(crossDate, style = MaterialTheme.typography.labelSmall,
                    maxLines = 1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (taskCount > 0 || solar != null) Text(listOfNotNull(
                    solar?.symbol, taskCount.takeIf { it > 0 }?.let { "•$it" }).joinToString(" "),
                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

@Composable
private fun SelectedDayCard(calendar: GenesisCalendar, date: LocalDate, mode: CalendarMode,
    onOpenDay: (LocalDate) -> Unit, experimental: Boolean, tasks: List<LocalTask>) {
    val sacred = calendar.sacredDate(date)
    val month = SacredCatalog.months[sacred.monthIndex]
    val day = month.days[sacred.day - 1]
    val locale = if (LocalGenesisLanguage.current == "en") Locale.ENGLISH else ru
    val weekday = if (mode == CalendarMode.PROFANE) todayHeroCopy(date, mode, calendar) else null
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
            weekday?.let {
                Text(it.description, style = MaterialTheme.typography.titleMedium)
                it.details.forEach { detail -> Text(detail, style = MaterialTheme.typography.bodySmall) }
            }
            if (mode != CalendarMode.PROFANE) Text(date.format(dateLabel), style = MaterialTheme.typography.labelMedium)
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
                Text("${date.dayOfWeek.getDisplayName(TextStyle.FULL_STANDALONE, ru)} · ${date.dayOfYear}-й день года",
                    style = MaterialTheme.typography.bodySmall)
                if (moon.event.isNotBlank()) Text(moon.event, color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.labelLarge)
                calendar.solarEvent(date)?.let { event ->
                    Text("${event.symbol} ${event.name} · ${event.instant.atZone(calendar.zoneId).format(DateTimeFormatter.ofPattern("HH:mm z", ru))}",
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
private fun CalendarYearOverview(calendar: GenesisCalendar, shown: LocalDate, mode: CalendarMode,
    experimental: Boolean, tasks: List<LocalTask>,
    onMonth: (LocalDate) -> Unit, onYear: (LocalDate) -> Unit) {
    val sacredYear = calendar.sacredDate(shown).sacredYear
    val yearLabel = if (mode == CalendarMode.PROFANE) shown.year.toString() else sacredYear.toString()
    val entries = remember(shown, mode) { runCatching {
        when (mode) {
            CalendarMode.SACRED -> SacredCatalog.months.map { month ->
                Triple(calendar.gregorianDate(sacredYear, month.index, 1), month.name, month.title)
            }
            CalendarMode.PROFANE -> (1..12).map { ordinal ->
                Triple(LocalDate.of(shown.year, ordinal, 1), Month.of(ordinal)
                    .getDisplayName(TextStyle.FULL_STANDALONE, ru).replaceFirstChar { it.titlecase(ru) }, "")
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
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Солнечные точки года", style = MaterialTheme.typography.titleMedium)
                calendar.solarEvents(if (mode == CalendarMode.PROFANE) shown.year else sacredYear)
                    .forEach { event ->
                        Text("${event.symbol} ${event.name} · ${event.date.format(dateLabel)} · ${event.instant.atZone(calendar.zoneId).format(DateTimeFormatter.ofPattern("HH:mm z", ru))}",
                            style = MaterialTheme.typography.bodySmall)
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
                        Text(start.format(dateLabel), style = MaterialTheme.typography.labelSmall,
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
        item { Spacer(Modifier.height(16.dp)) }
    }
}
