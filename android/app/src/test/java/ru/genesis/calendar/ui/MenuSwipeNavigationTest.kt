package ru.genesis.calendar.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MenuSwipeNavigationTest {
    @Test fun mainPagesIgnoreSubmenusWhenOptionIsOff() {
        val pages = menuSwipeSequence(false, true)
        assertEquals(listOf("Сегодня", "Задачи", "Проекты", "Календарь", "Привычки",
            "Сакральное", "Настройки"), pages.map { it.page })
        assertEquals(SwipeDestination("Календарь"),
            nextMenuSwipeDestination(pages, "Проекты", null, 1))
        assertNull(nextMenuSwipeDestination(pages, "Настройки", null, 1))
        assertNull(nextMenuSwipeDestination(pages, "Сегодня", null, -1))
    }

    @Test fun submenuOptionFlattensSectionsExceptProjectCategories() {
        val pages = menuSwipeSequence(true, true)
        assertEquals(SwipeDestination("Задачи", "lists"),
            nextMenuSwipeDestination(pages, "Задачи", "tasks", 1))
        assertEquals(SwipeDestination("Проекты"),
            nextMenuSwipeDestination(pages, "Задачи", "lists", 1))
        assertEquals(SwipeDestination("Календарь", "month"),
            nextMenuSwipeDestination(pages, "Проекты", "life", 1))
        assertEquals(SwipeDestination("Задачи", "lists"),
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
        assertEquals(SwipeDestination("Проекты", "personal"),
            nextMenuSwipeDestination(pages, "Задачи", "lists", 1))
        assertEquals(SwipeDestination("Проекты", "shared"),
            nextMenuSwipeDestination(pages, "Проекты", "personal", 1))
        assertEquals(SwipeDestination("Календарь", "month"),
            nextMenuSwipeDestination(pages, "Проекты", "shared", 1))
        assertEquals(SwipeDestination("Проекты", "personal"),
            nextMenuSwipeDestination(pages, "Проекты", "shared", -1))
    }

    @Test fun hiddenSectionsAreSkippedWithoutBlankSwipePages() {
        val pages = menuSwipeSequence(true, true, true,
            hiddenMenuItems = setOf("stoicheion", "theokyklos"),
            hiddenSubmenus = setOf("tasks.lists", "projects.personal", "calendar.month", "habits.sleep"))
        assertEquals(listOf(SwipeDestination("Сегодня"), SwipeDestination("Задачи", "tasks"),
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
        assertEquals("tasks", first("Задачи"))
        assertEquals("lists", first("Задачи", setOf("tasks.tasks")))
        assertEquals("personal", first("Проекты"))
        assertEquals("shared", first("Проекты", setOf("projects.personal")))
        assertEquals("month", first("Календарь"))
        assertEquals("year", first("Календарь", setOf("calendar.month")))
        assertEquals("Привычки", first("Привычки"))
        assertEquals("stoicheion", first("Сакральное"))
        assertEquals("appearance", first("Настройки"))
        assertNull(first("Сегодня"))
    }
}
