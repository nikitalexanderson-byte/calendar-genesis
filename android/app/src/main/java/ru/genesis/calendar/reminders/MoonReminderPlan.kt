package ru.genesis.calendar.reminders

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import ru.genesis.calendar.domain.LunarEphemeris

internal data class PlannedMoonReminder(val kind: String, val eventDate: LocalDate,
    val at: Instant) {
    val key get() = "$kind/$eventDate"
}

/** Phase instants share the exact ephemeris used by the calendar; reminders fire at 09:00 local. */
internal fun planMoonReminders(after: Instant, zone: ZoneId, fullLeadDays: Int,
    newLeadDays: Int, horizonDays: Long = 120): List<PlannedMoonReminder> {
    val horizon = after.plusSeconds(horizonDays * 86_400)
    fun phase(kind: String, instants: LongArray, leadDays: Int): List<PlannedMoonReminder> {
        if (leadDays !in 1..3) return emptyList()
        return instants.asSequence().map { Instant.ofEpochMilli(it).atZone(zone).toLocalDate() }
            .map { eventDate -> PlannedMoonReminder(kind, eventDate,
                eventDate.minusDays(leadDays.toLong()).atTime(LocalTime.of(9, 0)).atZone(zone).toInstant()) }
            .filter { it.at > after && it.at <= horizon }.toList()
    }
    return (phase("full", LunarEphemeris.fullMoons, fullLeadDays) +
        phase("new", LunarEphemeris.newMoons, newLeadDays)).sortedBy { it.at }
}
