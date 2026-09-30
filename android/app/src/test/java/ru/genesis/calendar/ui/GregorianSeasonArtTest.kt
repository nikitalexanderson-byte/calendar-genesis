package ru.genesis.calendar.ui

import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.genesis.calendar.data.UiPreferences

class GregorianSeasonArtTest {
    @Test fun northernAndSouthernRegionsChooseDifferentSeasonPalettes() {
        assertEquals(SeasonArtRegion.BOREAL, seasonArtRegion(ZoneId.of("Europe/Helsinki")))
        assertEquals(SeasonArtRegion.MEDITERRANEAN, seasonArtRegion(ZoneId.of("Europe/Rome")))
        assertEquals(SeasonArtRegion.ARID, seasonArtRegion(ZoneId.of("Asia/Riyadh")))
        assertEquals(SeasonArtRegion.TROPICAL, seasonArtRegion(ZoneId.of("Asia/Singapore")))
        assertTrue(isSouthernSeasonRegion(ZoneId.of("Australia/Sydney")))
        assertTrue(isSouthernSeasonRegion(ZoneId.of("America/Argentina/Buenos_Aires")))
        assertTrue(isSouthernSeasonRegion(ZoneId.of("Pacific/Auckland")))
        assertEquals(SeasonArtRegion.SOUTHERN, seasonArtRegion(ZoneId.of("Australia/Sydney")))
        assertEquals(SeasonArtRegion.MEDITERRANEAN, seasonArtRegion(ZoneId.of("Australia/Perth")))
        assertEquals(SeasonArtRegion.TROPICAL, seasonArtRegion(ZoneId.of("Australia/Darwin")))
        assertFalse(isSouthernSeasonRegion(ZoneId.of("America/New_York")))
    }

    @Test fun selectedSourceControlsPaletteAndMissingIpFallsBackToDevice() {
        val manual = UiPreferences(regionSource = "manual", manualRegionZone = "Australia/Sydney")
        assertEquals("Australia/Sydney", selectedSeasonZone(manual).id)
        assertEquals("gregorian-seasons/southern/summer.jpg",
            gregorianSeasonArtPath("summer", selectedSeasonZone(manual), true))
        assertEquals("gregorian-seasons/summer.jpg",
            gregorianSeasonArtPath("summer", selectedSeasonZone(manual), false))
        assertEquals(ZoneId.systemDefault(), selectedSeasonZone(UiPreferences(regionSource = "ip")))
    }
}
