package ru.genesis.calendar.reminders

import java.time.*
import ru.genesis.calendar.data.LocalHabitWorkspace
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.habits.HabitEngine
import ru.genesis.calendar.domain.habits.habitReminderOccurrences
import ru.genesis.calendar.domain.habits.habitIntervalMarks

internal data class PlannedHabitNotification(val date: LocalDate, val at: Instant, val kind: String,
    val habitId: String?, val title: String, val body: String) {
    val key get() = "$date/$kind/${habitId ?: "daily-goal"}/${at.toEpochMilli()}"
}

internal fun planHabitNotifications(workspace: LocalHabitWorkspace, today: LocalDate, now: Instant,
    zone: ZoneId, language: String, days: Int = 8): List<PlannedHabitNotification> {
    val settings = workspace.settings.notifications
    if (!workspace.settings.enabled) return emptyList()
    val engine = HabitEngine(GenesisCalendar(zone))
    val start = LocalTime.parse(settings.quietHoursStart)
    val end = LocalTime.parse(settings.quietHoursEnd)
    fun quiet(at: Instant): Boolean {
        val time = at.atZone(zone).toLocalTime()
        return if (start == end) false else if (start < end) time >= start && time < end else time >= start || time < end
    }
    return (0 until days).flatMap { offset ->
        val date = today.plusDays(offset.toLong())
        val planned = workspace.habits.filter { runCatching { engine.isScheduled(it, date) }.getOrDefault(false) }
        val completed = workspace.completions.filter { it.date == date && it.completed }.mapTo(hashSetOf()) { it.habitId }
        val candidates = planned.filter { it.reminder.enabled && it.id !in completed }.flatMap { habit ->
            val marks = habitIntervalMarks(habit,workspace.completions.firstOrNull { it.habitId == habit.id && it.date == date })
            habitReminderOccurrences(habit,date).mapNotNull { (time, scheduled) ->
            val at = scheduled.toInstant()
            if (at <= now || !habit.reminder.allowDuringQuietHours && quiet(at)
                || habit.reminder.timing != "custom" && habit.intervalSchedule?.completionMode == "each" && time.toString() in marks) return@mapNotNull null
            PlannedHabitNotification(date, at, "habit", habit.id, habit.title,
                habitNotificationBody(settings.tone, "habit", 1, language,
                    "$date:${habit.id}:${at.toEpochMilli()}", "«${habit.title}»"))
        } }.toMutableList()
        val completedCount = planned.count { it.id in completed }
        val target = workspace.goals.firstOrNull { it.date == date }?.targetCount ?: planned.size
        val remaining = (target - completedCount).coerceAtLeast(0)
        val perfectRemaining = planned.size - completedCount
        if (settings.enabled && settings.motivational && target > 0 && (remaining > 0 || perfectRemaining == 1)) {
            val at = date.atTime(LocalTime.parse(settings.dailyGoalTime)).atZone(zone).toInstant()
            if (at > now && !quiet(at)) candidates += PlannedHabitNotification(date, at, "goal", null,
                "GENESIS", habitNotificationBody(settings.tone, "goal", maxOf(remaining, perfectRemaining.takeIf { remaining == 0 } ?: 0),
                    language, "$date:goal"))
        }
        candidates
    }.sortedBy { it.at }
}

internal fun planHabitNotifications(workspace: LocalHabitWorkspace, today: LocalDate, now: Instant,
    zone: ZoneId, english: Boolean, days: Int = 8): List<PlannedHabitNotification> =
    planHabitNotifications(workspace, today, now, zone, if (english) "en" else "ru", days)
