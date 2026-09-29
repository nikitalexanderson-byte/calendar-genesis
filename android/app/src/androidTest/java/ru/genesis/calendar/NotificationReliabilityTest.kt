package ru.genesis.calendar

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import ru.genesis.calendar.ui.appBatterySettingsIntent
import ru.genesis.calendar.ui.samsungNeverSleepingAppsIntent

/** Arm and verify run in separate instrumentation processes with `am kill` between them. */
class NotificationReliabilityTest {
    private val app get() = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
    private val fixture get() = app.getSharedPreferences("genesis.notification.reliability.test", Context.MODE_PRIVATE)

    @Test fun armDiagnosticAlarm() {
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        assertTrue("Notification permission must be granted", app.scheduler.notificationsAllowed())
        val manager = app.getSystemService(NotificationManager::class.java)
        manager.cancel("notification-diagnostic", 7303)
        // Leave enough time for instrumentation teardown and `am kill` on older emulators.
        val scheduledAt = requireNotNull(app.scheduler.scheduleDiagnosticNotification(15_000))
        fixture.edit().putLong("scheduledAt", scheduledAt).commit()
        assertEquals(scheduledAt, app.scheduler.lastDiagnosticScheduledAt())
    }

    @Test fun verifyDiagnosticAfterProcessDeath() {
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val scheduledAt = fixture.getLong("scheduledAt", 0)
        assertTrue("Run armDiagnosticAlarm first", scheduledAt > 0)
        val delivered = app.getSystemService(NotificationManager::class.java).activeNotifications
            .single { it.id == 7303 && it.tag == "notification-diagnostic" }
        assertTrue("Diagnostic title must be localized without changing its meaning",
            delivered.notification.extras.getString(Notification.EXTRA_TITLE) in setOf(
                "GENESIS · Проверка уведомлений", "GENESIS · Notification test"))
        assertTrue(app.scheduler.lastDiagnosticDeliveredAt() >= scheduledAt)
    }

    @Test fun batterySettingsIntentsAreScopedAndSamsungAware() {
        val generic = appBatterySettingsIntent("ru.genesis.calendar")
        assertEquals("package:ru.genesis.calendar", generic.dataString)
        val samsung = requireNotNull(samsungNeverSleepingAppsIntent("Samsung"))
        assertEquals("com.samsung.android.lool", samsung.`package`)
        assertEquals(2, samsung.getIntExtra("activity_type", -1))
        assertNull(samsungNeverSleepingAppsIntent("Google"))
    }
}
