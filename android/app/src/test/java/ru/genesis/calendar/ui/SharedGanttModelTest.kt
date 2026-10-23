package ru.genesis.calendar.ui

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.GenesisCalendar
import java.time.LocalDate

class SharedGanttModelTest {
    private fun task(start: String?, end: String?, from: String? = null, until: String? = null) = JSONObject()
        .put("startDate", start ?: JSONObject.NULL).put("dueDate", end ?: JSONObject.NULL)
        .put("startTime", from ?: JSONObject.NULL).put("endTime", until ?: JSONObject.NULL)

    @Test fun deadlineOnlyIsOneInclusiveDayAndUnscheduledTasksHaveNoSpan() {
        val span = sharedGanttSpan(task(null, "2026-10-23"))!!
        assertEquals(1.0, span.end - span.start, .000001)
        assertFalse(span.timed)
        assertNull(sharedGanttSpan(task(null, null)))
        assertNull(sharedGanttSpan(task("broken", null)))
    }
    @Test fun draggingPreservesInclusiveDurationWithoutChangingTheSource() {
        val source = task("2026-10-23", "2026-10-25")
        val moved = sharedGanttMove(source, LocalDate.parse("2026-11-01").toEpochDay().toDouble(), SharedGanttScale.DAYS)
        assertEquals("2026-11-01", moved.getString("startDate"))
        assertEquals("2026-11-03", moved.getString("dueDate"))
        assertEquals("2026-10-23", source.getString("startDate"))
        assertEquals(3.0, sharedGanttSpan(moved)!!.let { it.end - it.start }, .000001)
    }
    @Test fun hourlyDraggingKeepsOvernightDurationAcrossTheDstDate() {
        val source = task("2026-10-24", "2026-10-25", "23:30", "01:30")
        val point = LocalDate.parse("2026-10-25").toEpochDay() + 23.5 / 24
        val moved = sharedGanttMove(source, point, SharedGanttScale.HOURS)
        assertEquals("2026-10-25", moved.getString("startDate"))
        assertEquals("2026-10-26", moved.getString("dueDate"))
        assertEquals("23:30", moved.getString("startTime"))
        assertEquals("01:30", moved.getString("endTime"))
        assertEquals(2.0 / 24, sharedGanttSpan(moved)!!.let { it.end - it.start }, .000001)
    }
    @Test fun lunarMonthsAndShortApeironUseTheirActualCalendarBoundaries() {
        val calendar = GenesisCalendar()
        val months = sharedGanttPeriods(LocalDate.parse("2026-10-23"), SharedGanttScale.MONTHS, CalendarMode.LUNAR, calendar)
        assertEquals(6, months.size)
        months.zipWithNext().forEach { (first, next) -> assertEquals(first.end, next.start, .000001) }
        val apeiron = sharedGanttPeriods(LocalDate.parse("2026-03-18"), SharedGanttScale.WEEKS, CalendarMode.SACRED, calendar)
        assertEquals(1, apeiron.size)
        assertTrue(apeiron.single().end - apeiron.single().start in 5.0..6.0)
    }
    @Test fun unequalCalendarPeriodsKeepEqualVisualWidthAndDragRoundTrips() {
        val periods = listOf(SharedGanttPeriod(0.0, 30.0), SharedGanttPeriod(30.0, 35.0))
        assertEquals(1.0, sharedGanttAxis(periods, 30.0), .000001)
        assertEquals(1.5, sharedGanttAxis(periods, 32.5), .000001)
        for (point in listOf(0.0, 7.5, 30.0, 31.0, 34.9))
            assertEquals(point, sharedGanttPoint(periods, sharedGanttAxis(periods, point)), .000001)
    }
    @Test fun invalidRangesAreRejectedAndUnschedulingOnlyClearsTimelineFields() {
        assertThrows(IllegalArgumentException::class.java) {
            sharedGanttChanges(LocalDate.parse("2026-10-24"), LocalDate.parse("2026-10-23"))
        }
        assertThrows(IllegalArgumentException::class.java) {
            sharedGanttChanges(LocalDate.parse("2026-10-23"), LocalDate.parse("2026-10-23"), "10:00", "09:00")
        }
        val clear = sharedGanttClear()
        assertEquals(setOf("startDate", "dueDate", "startTime", "endTime"), clear.keys().asSequence().toSet())
        clear.keys().forEach { assertTrue(clear.isNull(it)) }
    }
}
