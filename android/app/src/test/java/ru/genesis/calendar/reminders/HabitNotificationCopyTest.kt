package ru.genesis.calendar.reminders

import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HabitNotificationCopyTest {
    @Test fun notificationTonesProduceDistinctRussianAndEnglishPreviews() {
        val tones = listOf("calm", "heroic", "ironic")
        val russian = tones.map { habitNotificationBody(it, "habit", 1, false) }
        val english = tones.map { habitNotificationBody(it, "habit", 1, true) }
        assertTrue(russian.all(String::isNotBlank))
        assertTrue(english.all(String::isNotBlank))
        assertNotEquals(russian[0], russian[1])
        assertNotEquals(russian[1], russian[2])
        assertNotEquals(english[0], english[1])
        assertNotEquals(english[1], english[2])
    }

    @Test fun toneAlsoChangesDailyGoalAndPluralHabitMessages() {
        assertTrue(habitNotificationBody("heroic", "goal", 1, false).contains("Героический"))
        assertTrue(habitNotificationBody("ironic", "habit", 3, false).contains("3"))
        assertTrue(habitNotificationBody("calm", "habit", 3, true).contains("3"))
    }
}
