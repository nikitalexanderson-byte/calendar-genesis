package ru.genesis.calendar.data

import java.time.LocalDate
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.RecurrenceEngine

/** One stored task is projected into calendar days; no duplicate task records are generated. */
object TaskOccurrences {
    private val engine = RecurrenceEngine(GenesisCalendar())

    fun occursOn(task: LocalTask, date: LocalDate): Boolean {
        if (!task.recurrence.enabled) return task.date == date.toString()
        return date.toString() !in task.recurrenceExcludedDates &&
            engine.matches(task.date, task.recurrence, date.toString())
    }

    fun byDate(tasks: List<LocalTask>, start: LocalDate, end: LocalDate): Map<String, List<LocalTask>> {
        if (end < start) return emptyMap()
        val rows = linkedMapOf<String, MutableList<LocalTask>>()
        tasks.forEach { task ->
            val dates = if (task.recurrence.enabled) runCatching {
                engine.datesForTask(task.date, task.recurrence, excludedDates = task.recurrenceExcludedDates.toSet())
            }.getOrDefault(emptyList()) else listOf(task.date)
            dates.forEach { dateValue ->
                val date = runCatching { LocalDate.parse(dateValue) }.getOrNull()
                if (date != null && date in start..end) rows.getOrPut(dateValue) { mutableListOf() }.add(task)
            }
        }
        return rows
    }

    fun countInRange(tasks: List<LocalTask>, start: LocalDate, end: LocalDate): Int =
        byDate(tasks, start, end).values.sumOf { it.size }

    /** Web-compatible occurrence deletion: retain the unified series unless no dates remain. */
    fun withoutDate(task: LocalTask, date: String): LocalTask? {
        require(task.recurrence.enabled) { "Это не повторяющаяся задача." }
        val dates = engine.datesForTask(task.date, task.recurrence,
            excludedDates = task.recurrenceExcludedDates.toSet())
        require(date in dates) { "Этот день не входит в серию." }
        val remaining = dates.filterNot { it == date }
        if (remaining.isEmpty()) return null
        return task.copy(date = if (date == task.date) remaining.first() else task.date,
            recurrenceExcludedDates = (task.recurrenceExcludedDates + date).distinct().sorted(),
            reminderAt = if (date == task.date) null else task.reminderAt)
    }
}
