package ru.genesis.calendar.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Duration
import java.time.LocalDate
import java.time.ZoneId

class SolarTimesTest {
    @Test
    fun `Moscow fallback produces local sunrise before sunset`() {
        val zone = ZoneId.of("Europe/Moscow")
        val location = SolarTimes.fallbackLocation(zone)
        val times = requireNotNull(SolarTimes.sunriseSunset(LocalDate.of(2026, 9, 27), location, zone))
        val sunrise = times.sunrise.atZone(zone)
        val sunset = times.sunset.atZone(zone)

        assertEquals(LocalDate.of(2026, 9, 27), sunrise.toLocalDate())
        assertEquals(LocalDate.of(2026, 9, 27), sunset.toLocalDate())
        assertTrue(sunrise.hour in 4..9)
        assertTrue(sunset.hour in 16..21)
        assertTrue(Duration.between(sunrise, sunset).toHours() in 8..16)
    }
}
