package ru.genesis.calendar.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONObject
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.SacredCatalog
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.roundToInt

private val ganttCellWidth = 96.dp
private val ganttNameWidth = 184.dp
private val ganttRowHeight = 64.dp

/** Uses the same filtered, paginated task reader and revision checks as the other project views. */
@Composable internal fun SharedGanttView(tasks: List<JSONObject>, statuses: List<JSONObject>,
    calendarMode: CalendarMode, inputCalendarMode: CalendarMode, use24: Boolean, canEdit: Boolean,
    busy: Boolean, onOpen: (JSONObject) -> Unit, onSchedule: suspend (JSONObject, JSONObject) -> Unit) {
    val calendar = remember { GenesisCalendar() }
    val scope = rememberCoroutineScope()
    var anchorValue by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var scaleValue by rememberSaveable { mutableStateOf(SharedGanttScale.WEEKS.name) }
    val anchor = LocalDate.parse(anchorValue)
    val scale = SharedGanttScale.valueOf(scaleValue)
    val periods = remember(anchor, scale, calendarMode) { sharedGanttPeriods(anchor, scale, calendarMode, calendar) }
    val done = statuses.filter { it.optInt("isDone") == 1 || it.optBoolean("isDone") }.map { it.optString("id") }.toSet()
    val active = tasks.filter { it.optString("statusId") !in done }
    val scheduled = active.filter { sharedGanttSpan(it)?.let { span -> scale != SharedGanttScale.HOURS || span.timed } == true }
    val rows = scheduled.filter { sharedGanttSpan(it)!!.let { span -> span.end > periods.first().start && span.start < periods.last().end } }
    val unscheduled = active.filter { it !in scheduled }
    val completed = tasks.filter { it.optString("statusId") in done }
    var editingJson by rememberSaveable { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val timelineScroll = rememberScrollState()
    val locale = Locale.forLanguageTag(LocalGenesisLanguage.current)
    LaunchedEffect(anchor, scale, calendarMode) { timelineScroll.scrollTo(0) }
    val save: suspend (JSONObject, JSONObject) -> Boolean = { task, changes ->
        if (saving || busy || !canEdit || task.optBoolean("pending")) false
        else {
            saving = true
            error = ""
            try {
                onSchedule(task, changes)
                true
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                error = "Не удалось сохранить сроки. Обновите задачи и повторите попытку."
                false
            } finally {
                saving = false
            }
        }
    }
    Column(Modifier.fillMaxWidth().testTag("shared-gantt"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ImportChoice("Масштаб времени", scale.name, SharedGanttScale.entries.map {
            it.name to genesisTranslate(if (it == SharedGanttScale.WEEKS) when (calendarMode) {
                CalendarMode.SACRED -> "Пяты"; CalendarMode.LUNAR -> "Декады"; else -> it.label
            } else it.label)
        }, !saving, "gantt-scale") { scaleValue = it }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AffairsIconButton("Предыдущий период", AffairsAction.BACK, {
                anchorValue = sharedGanttShift(anchor, scale, calendarMode, calendar, -1).toString()
            }, Modifier.testTag("gantt-previous"), !saving)
            AuthorDatePicker(anchorValue, calendarMode, enabled = !saving,
                modifier = Modifier.weight(1f).testTag("gantt-anchor")) { anchorValue = it }
            AffairsIconButton("Следующий период", AffairsAction.NEXT, {
                anchorValue = sharedGanttShift(anchor, scale, calendarMode, calendar, 1).toString()
            }, Modifier.testTag("gantt-next"), !saving)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton({ anchorValue = LocalDate.now().toString() }, Modifier.weight(1f)) { Text("Сегодня") }
            TextButton({ scheduled.mapNotNull(::sharedGanttSpan).minOfOrNull { it.start }?.let {
                anchorValue = LocalDate.ofEpochDay(floor(it).toLong()).toString()
            } }, Modifier.weight(1f), enabled = scheduled.isNotEmpty()) { Text("К первой задаче") }
        }
        if (canEdit) Text("Удерживайте полосу и перемещайте сроки. Кнопка календаря меняет начало, окончание и длительность.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (error.isNotEmpty()) Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("gantt-error"))
        if (saving) LinearProgressIndicator(Modifier.fillMaxWidth())
        Surface(shape = AffairsLayout.shape, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
            Column(Modifier.horizontalScroll(timelineScroll).width(ganttNameWidth + ganttCellWidth * periods.size)) {
                Row(Modifier.heightIn(min = 56.dp).background(MaterialTheme.colorScheme.surfaceContainerHigh),
                    verticalAlignment = Alignment.CenterVertically) {
                    Text("Задача", Modifier.width(ganttNameWidth).padding(12.dp), style = MaterialTheme.typography.labelLarge)
                    periods.forEach { period ->
                        val date = LocalDate.ofEpochDay(floor(period.start + 1e-7).toLong())
                        val title = when (scale) {
                            SharedGanttScale.HOURS -> timeLabel("%02d:00".format(Locale.ROOT, ((period.start - anchor.toEpochDay()) * 24).roundToInt()), use24)
                            SharedGanttScale.MONTHS -> when (calendarMode) {
                                CalendarMode.PROFANE -> date.format(DateTimeFormatter.ofPattern("LLL yyyy", locale))
                                CalendarMode.SACRED -> SacredCatalog.months[calendar.sacredDate(date).monthIndex].name
                                CalendarMode.LUNAR -> calendar.lunarDate(date).month.name
                            }
                            else -> calendar.formatDate(date, calendarMode)
                        }
                        Text(title, Modifier.width(ganttCellWidth).padding(8.dp), style = MaterialTheme.typography.labelSmall,
                            maxLines = 3, overflow = TextOverflow.Ellipsis)
                    }
                }
                HorizontalDivider()
                Box {
                    GanttDependencies(rows, periods)
                    Column {
                        rows.forEach { task -> key(task.getString("id")) {
                            GanttTaskRow(task, periods, scale, calendarMode, calendar,
                                editable = canEdit && !busy && !saving && !task.optBoolean("pending"),
                                onOpen = { onOpen(task) }, onEdit = { editingJson = task.toString() },
                                onMove = { changes -> scope.launch { save(task, changes) } })
                        } }
                    }
                }
            }
        }
        if (rows.isEmpty()) Text("На выбранный период задач нет.", style = MaterialTheme.typography.bodySmall)
        if (scheduled.size > rows.size) Text(genesisTranslate("Задачи вне периода") + ": ${scheduled.size - rows.size}",
            style = MaterialTheme.typography.bodySmall)
        if (unscheduled.isNotEmpty()) {
            Text("Неразмеченные задачи", style = MaterialTheme.typography.titleSmall)
            unscheduled.forEach { task ->
                val taskKey = task.optString("id")
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                TextButton({ onOpen(task) }, Modifier.weight(1f)) {
                    androidx.compose.material3.Text(task.optString("title"), Modifier.fillMaxWidth(), maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                if (canEdit) AffairsIconButton("Запланировать задачу", AffairsAction.CALENDAR,
                    { error = ""; editingJson = task.toString() }, Modifier.testTag("gantt-schedule-$taskKey"),
                    !busy && !saving && !task.optBoolean("pending"))
            } }
        }
        if (completed.isNotEmpty()) AffairsDisclosure("Завершённые", Modifier.testTag("gantt-completed")) {
            completed.forEach { task -> TextButton({ onOpen(task) }, Modifier.fillMaxWidth()) {
                androidx.compose.material3.Text(task.optString("title"), Modifier.fillMaxWidth())
            } }
        }
    }
    if (editingJson.isNotBlank()) {
        val task = remember(editingJson) { JSONObject(editingJson) }
        GanttScheduleDialog(task, anchor, inputCalendarMode, use24, !saving && !busy && canEdit,
            error, onDismiss = { if (!saving) editingJson = "" },
            onSave = { changes -> scope.launch { if (save(task, changes)) editingJson = "" } })
    }
}

@Composable private fun GanttTaskRow(task: JSONObject, periods: List<SharedGanttPeriod>, scale: SharedGanttScale,
    mode: CalendarMode, calendar: GenesisCalendar, editable: Boolean, onOpen: () -> Unit, onEdit: () -> Unit,
    onMove: (JSONObject) -> Unit) {
    val span = sharedGanttSpan(task)!!
    val taskKey = task.optString("id")
    var dragCells by remember { mutableDoubleStateOf(0.0) }
    val cellPixels = with(LocalDensity.current) { ganttCellWidth.toPx() }
    val move by rememberUpdatedState(onMove)
    val start = sharedGanttAxis(periods, span.start)
    val preview = if (dragCells == 0.0) span else {
        val changes = sharedGanttMove(task, sharedGanttPoint(periods, (start + dragCells).coerceIn(0.0, periods.size - .000001)), scale)
        sharedGanttSpan(JSONObject(task.toString()).apply { changes.keys().forEach { put(it, changes.get(it)) } })!!
    }
    val x = sharedGanttAxis(periods, preview.start).coerceIn(0.0, periods.size.toDouble())
    val end = sharedGanttAxis(periods, preview.end).coerceIn(0.0, periods.size.toDouble())
    val trackWidth = ganttCellWidth * periods.size
    val touchX = (x * ganttCellWidth.value).toFloat().coerceIn(0f, trackWidth.value - 48f)
    val stroke = MaterialTheme.colorScheme.outlineVariant
    val todayInk = MaterialTheme.colorScheme.secondary
    val today = sharedGanttAxis(periods, LocalDate.now().toEpochDay().toDouble())
    val label = task.optString("title") + ": " + calendar.formatDate(LocalDate.ofEpochDay(floor(preview.start).toLong()), mode) +
        " — " + calendar.formatDate(LocalDate.ofEpochDay(floor(preview.end - (if (preview.timed) 0.0 else 1.0)).toLong()), mode)
    Row(Modifier.height(ganttRowHeight).testTag("gantt-task-$taskKey"), verticalAlignment = Alignment.CenterVertically) {
        Row(Modifier.width(ganttNameWidth), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onOpen, Modifier.weight(1f).fillMaxHeight()) {
                androidx.compose.material3.Text(task.optString("title"), Modifier.fillMaxWidth(), maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            if (editable) AffairsIconButton("Изменить сроки задачи", AffairsAction.CALENDAR, onEdit,
                Modifier.testTag("gantt-edit-$taskKey"))
        }
        Box(Modifier.width(trackWidth).fillMaxHeight(), contentAlignment = Alignment.CenterStart) {
            Canvas(Modifier.matchParentSize()) {
                repeat(periods.size + 1) { index ->
                    val left = index * ganttCellWidth.toPx()
                    drawLine(stroke.copy(alpha = .6f), Offset(left, 0f), Offset(left, size.height), 1.dp.toPx())
                }
                if (today in 0.0..periods.size.toDouble()) drawLine(todayInk,
                    Offset((today * ganttCellWidth.toPx()).toFloat(), 0f), Offset((today * ganttCellWidth.toPx()).toFloat(), size.height), 2.dp.toPx())
            }
            Box(Modifier.offset(x = touchX.dp)
                .width(max(48f, ((end * ganttCellWidth.value) - touchX).toFloat()).dp).height(48.dp)
                .pointerInput(task.optString("id"), task.optInt("revision"), periods, editable) {
                    if (editable) detectDragGesturesAfterLongPress(onDragStart = { dragCells = 0.0 },
                        onDrag = { change, delta -> change.consume(); dragCells += delta.x / cellPixels },
                        onDragCancel = { dragCells = 0.0 }, onDragEnd = {
                            if (dragCells != 0.0) {
                                val changes = sharedGanttMove(task, sharedGanttPoint(periods, (start + dragCells).coerceIn(0.0, periods.size - .000001)), scale)
                                if (changes.keys().asSequence().any { changes.optString(it) != task.optString(it) }) move(changes)
                            }
                            dragCells = 0.0
                        })
                }, contentAlignment = Alignment.CenterStart) {
                Surface(onClick = onOpen, modifier = Modifier.fillMaxWidth().height(48.dp).semantics { contentDescription = label },
                    shape = AffairsLayout.controlShape, color = Color.Transparent) {
                    Box(contentAlignment = Alignment.CenterStart) {
                        Box(Modifier.offset(x = ((x * ganttCellWidth.value) - touchX).toFloat().dp)
                            .width(max(4f, ((end - x) * ganttCellWidth.value).toFloat()).dp).height(32.dp)
                            .background(MaterialTheme.colorScheme.primaryContainer, AffairsLayout.controlShape)
                            .border(BorderStroke(1.dp, MaterialTheme.colorScheme.primary), AffairsLayout.controlShape))
                    }
                }
            }
        }
    }
}

@Composable private fun GanttDependencies(tasks: List<JSONObject>, periods: List<SharedGanttPeriod>) {
    val ink = MaterialTheme.colorScheme.primary
    Canvas(Modifier.width(ganttNameWidth + ganttCellWidth * periods.size).height(ganttRowHeight * tasks.size)) {
        val positions = tasks.withIndex().associateBy { it.value.optString("id") }
        tasks.forEachIndexed { index, task ->
            val dependencies = task.optJSONArray("dependsOnIds") ?: return@forEachIndexed
            for (dependency in 0 until dependencies.length()) {
                val prior = positions[dependencies.optString(dependency)] ?: continue
                val from = sharedGanttSpan(prior.value) ?: continue
                val to = sharedGanttSpan(task) ?: continue
                val left = ganttNameWidth.toPx()
                val fromX = left + (sharedGanttAxis(periods, from.end) * ganttCellWidth.toPx()).toFloat()
                val toX = left + (sharedGanttAxis(periods, to.start) * ganttCellWidth.toPx()).toFloat()
                if (fromX !in left..size.width || toX !in left..size.width) continue
                val fromY = (prior.index + .5f) * ganttRowHeight.toPx()
                val toY = (index + .5f) * ganttRowHeight.toPx()
                val elbow = max(fromX + 8.dp.toPx(), toX - 8.dp.toPx())
                val path = Path().apply {
                    moveTo(fromX, fromY); lineTo(elbow, fromY); lineTo(elbow, toY); lineTo(toX, toY)
                    moveTo(toX + 4.dp.toPx(), toY - 3.dp.toPx()); lineTo(toX, toY); lineTo(toX + 4.dp.toPx(), toY + 3.dp.toPx())
                }
                drawPath(path, ink, style = Stroke(1.dp.toPx()))
            }
        }
    }
}

@Composable private fun GanttScheduleDialog(task: JSONObject, anchor: LocalDate, inputMode: CalendarMode, use24: Boolean,
    enabled: Boolean, error: String, onDismiss: () -> Unit, onSave: (JSONObject) -> Unit) {
    fun date(key: String) = task.optString(key).takeUnless { it.isBlank() || it == "null" }
    var start by rememberSaveable(task.optString("id")) { mutableStateOf(date("startDate") ?: date("dueDate") ?: anchor.toString()) }
    var end by rememberSaveable(task.optString("id")) { mutableStateOf(date("dueDate") ?: start) }
    var timed by rememberSaveable(task.optString("id")) { mutableStateOf(!task.isNull("startTime") && !task.isNull("endTime")) }
    var startTime by rememberSaveable(task.optString("id")) { mutableStateOf(task.optString("startTime").takeUnless { it.isBlank() || it == "null" } ?: "09:00") }
    var endTime by rememberSaveable(task.optString("id")) { mutableStateOf(task.optString("endTime").takeUnless { it.isBlank() || it == "null" } ?: "10:00") }
    val changes = runCatching { sharedGanttChanges(LocalDate.parse(start), LocalDate.parse(end),
        startTime.takeIf { timed }, endTime.takeIf { timed }) }.getOrNull()
    AlertDialog(onDismissRequest = { if (enabled) onDismiss() }, title = { Text("Сроки задачи") },
        text = { Column(Modifier.fillMaxWidth().heightIn(max = 440.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            androidx.compose.material3.Text(task.optString("title"), style = MaterialTheme.typography.titleSmall)
            Text("Начало")
            AuthorDatePicker(start, inputMode, enabled = enabled, modifier = Modifier.fillMaxWidth().testTag("gantt-start-date")) { start = it }
            Text("Окончание")
            AuthorDatePicker(end, inputMode, enabled = enabled, modifier = Modifier.fillMaxWidth().testTag("gantt-end-date")) { end = it }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(timed, { timed = it }, enabled = enabled)
                Text("Указать время")
            }
            if (timed) {
                Text("Время начала")
                if (enabled) AuthorTimePicker(startTime, use24) { startTime = it } else Text(timeLabel(startTime, use24))
                Text("Время окончания")
                if (enabled) AuthorTimePicker(endTime, use24) { endTime = it } else Text(timeLabel(endTime, use24))
            }
            if (changes == null) Text("Окончание должно быть позже начала.", color = MaterialTheme.colorScheme.error)
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
            OutlinedButton({ onSave(sharedGanttClear()) }, enabled = enabled, modifier = Modifier.fillMaxWidth().testTag("gantt-unschedule")) {
                Text("Вернуть задачу в список")
            }
        } }, confirmButton = { Button({ changes?.let(onSave) }, enabled = enabled && changes != null,
            modifier = Modifier.testTag("gantt-save-schedule")) { Text("Сохранить") } },
        dismissButton = { TextButton(onDismiss, enabled = enabled) { Text("Отмена") } })
}
