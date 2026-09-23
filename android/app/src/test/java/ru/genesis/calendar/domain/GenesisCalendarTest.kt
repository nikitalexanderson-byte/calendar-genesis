package ru.genesis.calendar.domain

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

class GenesisCalendarTest {
    @Test fun matchesActualWebCalendarVectorsAcrossFourZones() {
        webCalendarVectors.forEach { line ->
            val v = line.split('|')
            val calendar = GenesisCalendar(ZoneId.of(v[0]))
            val date = LocalDate.parse(v[1])
            val sacred = calendar.sacredDate(date)
            val lunar = calendar.lunarDate(date)
            val actual = listOf(v[0],v[1],sacred.sacredYear,sacred.monthIndex,sacred.day,sacred.apeironDays,
                lunar.year.sacredYear,lunar.monthIndex,lunar.monthOrdinal,lunar.day,lunar.monthLength,lunar.isThreshold).joinToString("|")
            assertEquals(line, line, actual)
            assertEquals(date, calendar.gregorianDate(sacred.sacredYear,sacred.monthIndex,sacred.day))
        }
    }

    @Test fun allOriginalMonthAndDayDefinitionsArePresent() {
        assertEquals(13, SacredCatalog.months.size)
        assertEquals(366, SacredCatalog.months.sumOf { it.days.size })
        assertTrue(SacredCatalog.months.take(12).all { it.days.size == 30 })
        assertEquals(6,SacredCatalog.months.last().days.size)
        assertTrue(SacredCatalog.months.flatMap { it.days }.all { it.name.isNotBlank() && it.description.isNotBlank() })
    }

    @Test fun recurrenceMatchesActualWebVectors() {
        val engine = RecurrenceEngine(GenesisCalendar(ZoneId.of("Europe/Moscow")))
        webRecurrenceVectors.forEach { v ->
            assertEquals("${v.start}: ${v.config}",v.expected,engine.buildDates(v.start,v.config))
        }
    }

    @Test fun monthlyDoesNotInventFebruary31AndYearlyPreservesLeapDay() {
        val engine = RecurrenceEngine(GenesisCalendar())
        assertFalse(engine.matches("2024-01-31", RecurrenceConfig(true,"classic","monthly"),"2024-02-29"))
        assertTrue(engine.matches("2024-02-29", RecurrenceConfig(true,"classic","yearly"),"2028-02-29"))
        assertFalse(engine.matches("2024-02-29", RecurrenceConfig(true,"classic","yearly"),"2025-03-01"))
    }

    @Test fun sacredRecurrenceExcludesApeironAndRangeStartAnchorsIntervals() {
        val engine = RecurrenceEngine(GenesisCalendar())
        assertFalse(engine.matches("2026-03-01",RecurrenceConfig(true,days=listOf(1,2,3,4,5)),"2026-03-19"))
        val config = RecurrenceConfig(true,"classic","daily",interval=2,rangeStart="2026-09-25")
        assertFalse(engine.matches("2026-09-23",config,"2026-09-23"))
        assertTrue(engine.matches("2026-09-23",config,"2026-09-27"))
    }

    @Test fun displaySelectionDoesNotChangeTaskCalendar() {
        for (display in CalendarMode.entries) for (task in CalendarMode.entries) for (format in listOf(true,false)) {
            val original = CalendarPreferences(display,task,format)
            assertEquals(task,original.copy(displayCalendar=CalendarMode.LUNAR).taskCalendar)
            assertEquals(format,original.copy(displayCalendar=CalendarMode.LUNAR).use24HourTime)
        }
    }

    @Test fun excludedOccurrencesAndMaterializedSeriesFollowWebRules() {
        val engine = RecurrenceEngine(GenesisCalendar())
        val config = RecurrenceConfig(true,"classic","daily",rangeEnd="2026-09-25")
        assertEquals(listOf("2026-09-23","2026-09-25"),engine.datesForTask("2026-09-23",config,excludedDates=setOf("2026-09-24")))
        assertEquals(emptyList<String>(),engine.datesForTask("2026-09-23",config,excludedDates=setOf("2026-09-23","2026-09-24","2026-09-25")))
        assertEquals(listOf("2026-09-23"),engine.datesForTask("2026-09-23",config,recurrenceSeriesId="test-series"))
        assertEquals(listOf("2026-09-23"),engine.datesForTask("2026-09-23",config,googleTaskListId="test-list"))
    }

    @Test fun dateOnlyRemainsCivilAndDstPoliciesAreExplicit() {
        val zone = ZoneId.of("America/New_York")
        val day = LocalDate.of(2026,3,8)
        assertEquals("2026-03-09", day.plusDays(1).toString())
        assertThrows(IllegalArgumentException::class.java) { resolveReminderTime(LocalDateTime.of(2026,3,8,2,30),zone,DstOverlapPolicy.EARLIER_OFFSET) }
        val overlap = LocalDateTime.of(2026,11,1,1,30)
        val first = resolveReminderTime(overlap,zone,DstOverlapPolicy.EARLIER_OFFSET)
        val second = resolveReminderTime(overlap,zone,DstOverlapPolicy.LATER_OFFSET)
        assertEquals(3600,second.toEpochSecond()-first.toEpochSecond())
    }

    @Test fun exhaustedEphemerisIsExplicit() {
        assertThrows(IllegalArgumentException::class.java) { GenesisCalendar().lunarDate(LocalDate.of(2101,1,1)) }
    }
}
