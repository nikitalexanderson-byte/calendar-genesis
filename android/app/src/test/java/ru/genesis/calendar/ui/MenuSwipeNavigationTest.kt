package ru.genesis.calendar.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MenuSwipeNavigationTest {
    @Test fun mainPagesIgnoreSubmenusWhenOptionIsOff() {
        val pages = menuSwipeSequence(false, true)
        assertEquals(listOf("Сегодня", "Проекты", "Календарь", "Привычки",
            "Сакральное", "Настройки"), pages.map { it.page })
        assertEquals(SwipeDestination("Календарь"),
            nextMenuSwipeDestination(pages, "Проекты", null, 1))
        assertNull(nextMenuSwipeDestination(pages, "Настройки", null, 1))
        assertNull(nextMenuSwipeDestination(pages, "Сегодня", null, -1))
    }

    @Test fun submenuOptionFlattensSectionsExceptProjectCategories() {
        val pages = menuSwipeSequence(true, true)
        assertEquals(SwipeDestination("Проекты", "personal-projects"),
            nextMenuSwipeDestination(pages, "Сегодня", null, 1))
        assertEquals(SwipeDestination("Проекты", "personal-tasks"),
            nextMenuSwipeDestination(pages, "Проекты", "personal-projects", 1))
        assertEquals(SwipeDestination("Проекты", "personal-lists"),
            nextMenuSwipeDestination(pages, "Проекты", "personal-tasks", 1))
        assertEquals(SwipeDestination("Календарь", "month"),
            nextMenuSwipeDestination(pages, "Проекты", "personal-lists", 1))
        assertEquals(SwipeDestination("Сегодня"),
            nextMenuSwipeDestination(pages, "Проекты", "work", -1))
        assertEquals(SwipeDestination("Календарь", "year"),
            nextMenuSwipeDestination(pages, "Календарь", "month", 1))
        assertEquals(SwipeDestination("Привычки", "Привычки"),
            nextMenuSwipeDestination(pages, "Календарь", "year", 1))
        assertEquals(SwipeDestination("Календарь", "year"),
            nextMenuSwipeDestination(pages, "Привычки", "Привычки", -1))
    }

    @Test fun disabledHabitsAreExcluded() {
        val pages = menuSwipeSequence(true, false)
        assertEquals(SwipeDestination("Сакральное", "stoicheion"),
            nextMenuSwipeDestination(pages, "Календарь", "year", 1))
    }

    @Test fun sharedProjectsAreAdjacentSwipeDestinationsWhenAvailable() {
        val pages = menuSwipeSequence(true, true, true)
        assertEquals(SwipeDestination("Проекты", "personal-projects"),
            nextMenuSwipeDestination(pages, "Сегодня", null, 1))
        assertEquals(SwipeDestination("Проекты", "shared"),
            nextMenuSwipeDestination(pages, "Проекты", "personal-lists", 1))
        assertEquals(SwipeDestination("Календарь", "month"),
            nextMenuSwipeDestination(pages, "Проекты", "shared", 1))
        assertEquals(SwipeDestination("Проекты", "personal-lists"),
            nextMenuSwipeDestination(pages, "Проекты", "shared", -1))
    }

    @Test fun hiddenSectionsAreSkippedWithoutBlankSwipePages() {
        val pages = menuSwipeSequence(true, true, true,
            hiddenMenuItems = setOf("stoicheion", "theokyklos"),
            hiddenSubmenus = setOf("tasks.lists", "projects.personal", "calendar.month", "habits.sleep"))
        assertEquals(listOf(SwipeDestination("Сегодня"),
            SwipeDestination("Проекты", "shared"), SwipeDestination("Календарь", "year"),
            SwipeDestination("Привычки", "Привычки")) + settingsSections.map { SwipeDestination("Настройки", it.id) }, pages)
        assertEquals(SwipeDestination("Настройки", "appearance"),
            nextMenuSwipeDestination(pages, "Привычки", "Привычки", 1))
    }

    @Test fun sacredSubsectionsSwipeInOrderAndRespectVisibility() {
        val pages = menuSwipeSequence(true, true)
        assertEquals(SwipeDestination("Сакральное", "theokyklos"),
            nextMenuSwipeDestination(pages, "Сакральное", "stoicheion", 1))
        assertEquals(SwipeDestination("Настройки", "appearance"),
            nextMenuSwipeDestination(pages, "Сакральное", "theokyklos", 1))
        val stoicheionHidden = menuSwipeSequence(true, true,
            hiddenSubmenus = setOf("sacred.stoicheion"))
        assertEquals(SwipeDestination("Сакральное", "theokyklos"),
            nextMenuSwipeDestination(stoicheionHidden, "Привычки", "Сон и настроение", 1))
    }

    @Test fun sequentialSettingsHaveOneSwipeDestination() {
        val pages = menuSwipeSequence(true, true, settingsSubmenuEnabled = false)
        assertEquals(listOf(SwipeDestination("Настройки")),
            pages.filter { it.page == "Настройки" })
        assertEquals(SwipeDestination("Настройки"),
            nextMenuSwipeDestination(pages, "Сакральное", "theokyklos", 1))
    }

    @Test fun primaryMenuTapReturnsToFirstVisibleSubmenu() {
        fun first(page: String, hidden: Set<String> = emptySet()) =
            firstVisibleSubmenu(page, true, true, emptySet(), hidden, true)
        assertNull(first("Задачи"))
        assertNull(first("Задачи", setOf("tasks.tasks")))
        assertEquals("personal-projects", first("Проекты"))
        assertEquals("shared", first("Проекты", setOf("projects.personal")))
        assertEquals("month", first("Календарь"))
        assertEquals("year", first("Календарь", setOf("calendar.month")))
        assertEquals("Привычки", first("Привычки"))
        assertEquals("stoicheion", first("Сакральное"))
        assertEquals("appearance", first("Настройки"))
        assertNull(first("Сегодня"))
    }
}
