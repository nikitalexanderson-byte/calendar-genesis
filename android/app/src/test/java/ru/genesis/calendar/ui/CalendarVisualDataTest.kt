package ru.genesis.calendar.ui

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test
import ru.genesis.calendar.domain.CalendarRange

class CalendarVisualDataTest {
    @Test fun gregorianGridShowsFadedNeighbouringDatesInSundayFirstRows() {
        val dates = gregorianGridDates(CalendarRange(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31)))
        assertEquals(LocalDate.of(2025, 12, 28), dates.first())
        assertEquals(LocalDate.of(2026, 1, 1), dates[4])
        assertEquals(LocalDate.of(2026, 1, 31), dates.last())
        assertEquals(35, dates.size)
    }

    @Test fun gregorianGridFillsNextMonthWithoutInventingSixthRow() {
        val dates = gregorianGridDates(CalendarRange(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30)))
        assertEquals(LocalDate.of(2026, 8, 30), dates.first())
        assertEquals(LocalDate.of(2026, 10, 3), dates.last())
        assertEquals(35, dates.size)
    }

    @Test fun patronSymbolsFollowWebsiteSundayFirstOrder() {
        val sunday = LocalDate.of(2026, 9, 27)
        assertEquals(listOf("☉", "☽", "♂", "☿", "♃", "♀", "♄"),
            (0L..6L).map { weekdayPatronMark(sunday.plusDays(it)).symbol })
        assertEquals("Гестия, Афродита и Дионис", weekdayPatronMark(LocalDate.of(2026, 9, 25)).patrons)
    }
}
