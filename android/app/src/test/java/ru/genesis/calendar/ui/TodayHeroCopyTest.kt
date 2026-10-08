package ru.genesis.calendar.ui

import java.time.LocalDate
import org.junit.Assert.*
import org.junit.Test
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.SacredCatalog

class TodayHeroCopyTest {
    @Test fun yearPositionUsesIsoWeekAndLeapYearLength() {
        assertEquals("Неделя года · 40\n271 из 365 дней года", gregorianYearPosition(LocalDate.of(2026, 9, 28)))
        assertEquals("Week of the year · 9\n60 of 366 days in the year", gregorianYearPosition(LocalDate.of(2028, 2, 29), "en"))
    }
    private val calendar = GenesisCalendar()
    private val date = LocalDate.of(2026, 9, 24)

    @Test fun sacredHeroKeepsCompleteDayTextOnOriginalArtwork() {
        val sacred = calendar.sacredDate(date)
        val day = SacredCatalog.months[sacred.monthIndex].days.first { it.day == sacred.day }
        val copy = todayHeroCopy(date, CalendarMode.SACRED, calendar)
        assertEquals(day.description, copy.description)
        assertEquals("day-art-v1/month-07/day-09.webp", copy.imagePath)
        assertEquals("Триге Акаматос", copy.title)
        assertEquals("(Триге Неутомимое)", copy.subtitle)
    }

    @Test fun gregorianHeroUsesWeekdayPatronTextAndMatchingImage() {
        val copy = todayHeroCopy(date, CalendarMode.PROFANE, calendar)
        assertEquals("Четверг", copy.title)
        assertEquals("День Зевса и Геры", copy.description)
        assertEquals("weekday-art/weekday-4-thursday-zeus-hera.webp", copy.imagePath)
        assertEquals(2, copy.details.size)
        assertTrue(copy.details[1].startsWith("Части тела: Печень"))
    }

    @Test fun lunarHeroKeepsMonthMeaningAndUniqueMonthDetailsOverDayArt() {
        val copy = todayHeroCopy(date, CalendarMode.LUNAR, calendar)
        assertTrue(copy.title.endsWith("лунный день"))
        assertEquals(calendar.lunarDate(date).month.description, copy.description)
        assertEquals(calendar.lunarDate(date).month.title, copy.details.first())
        assertNull(copy.subtitle)
        assertTrue(copy.imagePath.startsWith("day-art-v1/month-"))
    }
}
