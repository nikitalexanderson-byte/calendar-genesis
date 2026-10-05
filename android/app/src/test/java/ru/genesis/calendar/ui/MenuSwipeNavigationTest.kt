package ru.genesis.calendar.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MenuSwipeNavigationTest {
    @Test fun mainPagesIgnoreSubmenusWhenOptionIsOff() {
        val pages = menuSwipeSequence(false, true)
        assertEquals(listOf("Сегодня", "Задачи", "Проекты", "Календарь", "Привычки",
            "Стойхейон", "Теокиклос", "Настройки"), pages.map { it.page })
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
        assertEquals(SwipeDestination("Стойхейон"),
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
}
