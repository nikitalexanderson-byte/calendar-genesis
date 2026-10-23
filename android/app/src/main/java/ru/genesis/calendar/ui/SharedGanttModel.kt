package ru.genesis.calendar.ui

import org.json.JSONObject
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.GenesisCalendar
import java.time.LocalDate
import java.time.LocalTime
import java.time.temporal.ChronoUnit
import kotlin.math.*

internal enum class SharedGanttScale(val label: String) {
    HOURS("Внутри дня"), DAYS("Дни"), WEEKS("Недели"), MONTHS("Месяцы")
}
internal data class SharedGanttPeriod(val start: Double, val end: Double)
internal data class SharedGanttSpan(val start: Double, val end: Double, val timed: Boolean)

private fun JSONObject.ganttDate(key: String) = optString(key).takeIf { it.isNotBlank() && it != "null" }
    ?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
private fun JSONObject.ganttTime(key: String) = optString(key).takeIf { it.isNotBlank() && it != "null" }
    ?.let { runCatching { LocalTime.parse(it) }.getOrNull() }

/** Local calendar days form the axis; DST and the device time zone never change a task's duration. */
internal fun sharedGanttSpan(task: JSONObject): SharedGanttSpan? {
    val first = task.ganttDate("startDate") ?: task.ganttDate("dueDate") ?: return null
    val last = task.ganttDate("dueDate") ?: first
    val startTime = task.ganttTime("startTime")
    val endTime = task.ganttTime("endTime")
    val timed = startTime != null && endTime != null
    val start = first.toEpochDay().toDouble() + if (timed) startTime!!.toSecondOfDay() / 86400.0 else 0.0
    val end = last.toEpochDay().toDouble() + if (timed) endTime!!.toSecondOfDay() / 86400.0 else 1.0
    return SharedGanttSpan(start, end, timed).takeIf { it.end > it.start }
}

internal fun sharedGanttPeriods(anchor: LocalDate, scale: SharedGanttScale, mode: CalendarMode,
    calendar: GenesisCalendar): List<SharedGanttPeriod> {
    fun period(start: LocalDate, end: LocalDate) = SharedGanttPeriod(start.toEpochDay().toDouble(), end.toEpochDay().toDouble())
    if (scale == SharedGanttScale.HOURS) return (0..23).map {
        SharedGanttPeriod(anchor.toEpochDay() + it / 24.0, anchor.toEpochDay() + (it + 1) / 24.0)
    }
    val month = calendar.monthRange(anchor, mode)
    if (scale == SharedGanttScale.MONTHS) {
        var cursor = month.start
        return (0..5).map {
            val range = calendar.monthRange(cursor, mode)
            val next = range.end.plusDays(1)
            period(cursor, next).also { cursor = next }
        }
    }
    if (scale == SharedGanttScale.WEEKS && mode != CalendarMode.PROFANE) {
        val step = if (mode == CalendarMode.SACRED) 5L else 10L
        val end = month.end.plusDays(1)
        val apeiron = mode == CalendarMode.SACRED && calendar.sacredDate(month.start).monthIndex == 12
        val result = mutableListOf<SharedGanttPeriod>()
        var cursor = month.start
        while (cursor < end) {
            val next = if (apeiron) end else minOf(cursor.plusDays(step), end)
            result += period(cursor, next); cursor = next
        }
        return result
    }
    val start = if (mode == CalendarMode.PROFANE) anchor.minusDays(anchor.dayOfWeek.value - 1L)
        else month.start.plusDays(ChronoUnit.DAYS.between(month.start, anchor) / (if (mode == CalendarMode.SACRED) 5 else 10) *
            (if (mode == CalendarMode.SACRED) 5 else 10))
    val step = if (scale == SharedGanttScale.WEEKS) 7L else 1L
    return (0 until if (scale == SharedGanttScale.WEEKS) 8 else 14).map { period(start.plusDays(it * step), start.plusDays((it + 1) * step)) }
}

/** Each calendar period occupies one cell, including a short lunar month or Apeiron. */
internal fun sharedGanttAxis(periods: List<SharedGanttPeriod>, point: Double): Double {
    if (periods.isEmpty()) return 0.0
    val index = periods.indexOfFirst { point < it.end }.let { if (it < 0) periods.lastIndex else it }
    val period = periods[index]
    return index + (point - period.start) / (period.end - period.start)
}
internal fun sharedGanttPoint(periods: List<SharedGanttPeriod>, cell: Double): Double {
    if (periods.isEmpty()) return 0.0
    val index = floor(cell).toInt().coerceIn(periods.indices)
    return periods[index].let { it.start + (cell - index) * (it.end - it.start) }
}

internal fun sharedGanttChanges(start: LocalDate, end: LocalDate, startTime: String? = null, endTime: String? = null): JSONObject {
    require(end >= start)
    require((startTime == null) == (endTime == null))
    if (startTime != null && endTime != null) require(end.atTime(LocalTime.parse(endTime)) > start.atTime(LocalTime.parse(startTime)))
    return JSONObject().put("startDate", start.toString()).put("dueDate", end.toString())
        .put("startTime", startTime ?: JSONObject.NULL).put("endTime", endTime ?: JSONObject.NULL)
}
internal fun sharedGanttClear(): JSONObject = JSONObject().apply {
    for (key in listOf("startDate", "dueDate", "startTime", "endTime")) put(key, JSONObject.NULL)
}
private fun ganttMinuteTime(value: Long) = LocalTime.ofSecondOfDay(Math.floorMod(value, 1440L) * 60).toString().take(5)

internal fun sharedGanttMove(task: JSONObject, point: Double, scale: SharedGanttScale): JSONObject {
    val span = sharedGanttSpan(task)
    if (scale == SharedGanttScale.HOURS) {
        val start = (point * 96).roundToLong() * 15
        val duration = if (span?.timed == true) max(15L, ((span.end - span.start) * 1440).roundToLong()) else 60L
        val end = start + duration
        return sharedGanttChanges(LocalDate.ofEpochDay(Math.floorDiv(start, 1440)), LocalDate.ofEpochDay(Math.floorDiv(end, 1440)),
            ganttMinuteTime(start), ganttMinuteTime(end))
    }
    val first = LocalDate.ofEpochDay(floor(point + 1e-7).toLong())
    val duration = if (span == null) 0L else floor(span.end - (if (span.timed) 0.0 else 1.0) + 1e-7).toLong() - floor(span.start).toLong()
    return sharedGanttChanges(first, first.plusDays(duration),
        if (span?.timed == true) task.getString("startTime") else null, if (span?.timed == true) task.getString("endTime") else null)
}

internal fun sharedGanttShift(anchor: LocalDate, scale: SharedGanttScale, mode: CalendarMode,
    calendar: GenesisCalendar, direction: Int): LocalDate {
    if (scale == SharedGanttScale.MONTHS || scale == SharedGanttScale.WEEKS && mode != CalendarMode.PROFANE) {
        var date = anchor
        repeat(if (scale == SharedGanttScale.MONTHS) 6 else 1) {
            val range = calendar.monthRange(date, mode)
            date = if (direction < 0) range.start.minusDays(1) else range.end.plusDays(1)
        }
        return calendar.monthRange(date, mode).start
    }
    return anchor.plusDays(direction * when (scale) { SharedGanttScale.HOURS -> 1L; SharedGanttScale.DAYS -> 14L; else -> 56L })
}
