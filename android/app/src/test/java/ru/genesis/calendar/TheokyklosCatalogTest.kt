package ru.genesis.calendar

import java.io.File
import org.junit.Assert.*
import org.junit.Test
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.TheokyklosCatalogSource
import ru.genesis.calendar.domain.habits.HabitEngine
import ru.genesis.calendar.ui.toHabit
import java.time.LocalDate

class TheokyklosCatalogTest {
    private val catalog by lazy {
        TheokyklosCatalogSource.parse(File("src/main/assets/catalogs/theokyklos.json").readText(Charsets.UTF_8))
    }

    @Test fun allOriginalSectorsAndPracticesAreLinked() {
        assertEquals(TheokyklosCatalogSource.ids, catalog.sectors.map { it.id })
        assertEquals(28, catalog.practices.size)
        for (sector in catalog.sectors) {
            assertEquals(4, sector.words.size)
            assertTrue(sector.title.ru.isNotBlank())
            assertTrue(sector.description.ru.isNotBlank())
            assertTrue(File("../../public/${sector.art}").isFile)
            assertTrue(File("../../public/${sector.symbolArt}").isFile)
            assertEquals(2, catalog.practicesFor(sector.id).size)
        }
    }

    @Test fun invalidCatalogCannotSilentlyDropMandalaMarkers() {
        val missingZenith = File("src/main/assets/catalogs/theokyklos.json").readText(Charsets.UTF_8)
            .replaceFirst("\"id\": \"zenith\"", "\"id\": \"missing\"")
        assertThrows(IllegalArgumentException::class.java) {
            TheokyklosCatalogSource.parse(missingZenith)
        }
    }

    @Test fun practiceBecomesTrackableHabitWithoutLosingSacredLinks() {
        val practice = catalog.practicesFor("zenith").first()
        val habit = practice.toHabit(CalendarMode.SACRED)
        assertEquals(practice.id, habit.sacredPracticeId)
        assertEquals("zenith", habit.sacredSectorId)
        assertEquals(practice.suggestedTime, habit.preferredTime)
        assertEquals(practice.priority, habit.priority)
        assertTrue(HabitEngine(GenesisCalendar()).isScheduled(habit, LocalDate.now()))
    }
}
