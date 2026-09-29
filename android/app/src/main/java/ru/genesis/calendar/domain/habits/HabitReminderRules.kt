package ru.genesis.calendar.domain.habits

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

fun habitReminderTime(habit: Habit): LocalTime? = runCatching {
    LocalTime.parse(if (habit.reminder.timing != "custom" && habit.preferredTime.isNotBlank())
        habit.preferredTime else habit.reminder.time)
}.getOrNull()

fun habitReminderAt(habit: Habit, date: LocalDate): ZonedDateTime? = habitReminderTime(habit)?.let { time ->
    runCatching { date.atTime(time).atZone(ZoneId.of(habit.schedule.timezone))
        .minusMinutes(habit.reminder.minutesBefore.coerceIn(0, 1440).toLong()) }.getOrNull()
}
