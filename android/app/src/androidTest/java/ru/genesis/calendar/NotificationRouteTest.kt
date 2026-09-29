package ru.genesis.calendar

import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import ru.genesis.calendar.reminders.habitNotificationBody
import ru.genesis.calendar.reminders.habitNotificationOpenIntent

class NotificationRouteTest {
    @Test fun habitNotificationUsesPlainCopyAndOpensHabits() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        val intent = habitNotificationOpenIntent(app, app.workspaceScope)
        assertEquals("habits", requestedSection(intent, app.workspaceScope))
        assertFalse(habitNotificationBody("heroic", "habit", 1, false)
            .contains(Regex("\\(\\d+\\)")))
    }
}
