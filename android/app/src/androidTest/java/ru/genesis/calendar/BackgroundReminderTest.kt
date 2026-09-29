package ru.genesis.calendar

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.WorkManager
import java.time.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import ru.genesis.calendar.auth.CloudAccountSnapshot
import ru.genesis.calendar.auth.*
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.*
import ru.genesis.calendar.domain.habits.*

/** Run arm and verify in separate instrumentation invocations, with `am kill` between them.
 * Only the debug package and a synthetic, network-isolated account are touched. */
class BackgroundReminderTest {
    private val app get() = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
    private val uid = "genesis-background-validation-v1"
    private val fixture get() = app.getSharedPreferences("genesis.validation.v1", Context.MODE_PRIVATE)
    private fun assertDebug() { check(BuildConfig.DEBUG && app.packageName.endsWith(".debug")) }

    @Test fun armAccountAlarmAndPersistOfflinePreferences() = runBlocking {
        assertDebug()
        check(!app.workspaceScope.startsWith("account-")) { "Fixture requires the isolated local debug workspace" }
        fixture.edit().putBoolean("isolated", true).putString("originalScope", app.workspaceScope).commit()
        WorkManager.getInstance(app).cancelUniqueWork("genesis-cloud-sync-v1").result.get()
        app.activateAccount(uid)
        CachedAccountEntry(app).save(ServerIdentity(uid, "Validation", "validation@example.invalid"),
            AccountSettings(listOf(LinkedGoogleAccount("validation", "validation@example.invalid", "Validation", true, false, false)),
                SyncRouting("fixed", listOf("validation"), emptyMap()), false, "standart", 0,
                "sacred", "profane", "24h", false, "ru"))
        assertTrue(app.scheduler.notificationsAllowed())
        assertTrue(app.scheduler.exactAllowed())
        val now = ZonedDateTime.now()
        val at = now.plusMinutes(2).withSecond(0).withNano(0)
        val repo = HabitsRepository(app)
        val current = repo.workspace.first()
        repo.updateSettings(current.settings.copy(notifications = current.settings.notifications.copy(
            enabled = false, motivational = false, tone = "heroic", quietHoursStart = "00:00", quietHoursEnd = "00:00")))
        repo.delete("background-reading")
        val habit = Habit(TrackerEntity.create("habit", id = "background-reading"),
            "Проверка чтения", at.toLocalDate(), HabitEngine(GenesisCalendar()).defaultSchedule(at.toLocalDate(), CalendarMode.PROFANE),
            preferredTime = at.toLocalTime().toString(), reminder = HabitReminder(enabled = true))
        repo.save(habit)
        assertFalse("A personal reminder must work with the general reminder disabled", repo.workspace.first().settings.notifications.enabled)
        val prefs = LocalPreferences(app, app.workspaceScope)
        prefs.setPending("display", "lunar")
        prefs.setRemote("display", "sacred")
        assertEquals(CalendarMode.LUNAR, prefs.values.first().display)
        prefs.setPending("time", "12h")
        prefs.acknowledge(mapOf("time" to "24h"))
        assertEquals("12h", prefs.pending.first()["time"])
        assertTrue(app.database.dao().outbox(app.workspaceScope).any { it.entityId == "habits" })
        fixture.edit().putLong("expectedAt", at.toInstant().toEpochMilli()).commit()
        println("GENESIS_BACKGROUND_ALARM_AT=${at.toInstant().toEpochMilli()}")
    }

    @Test fun verifyDeliveryAfterProcessDeathAndDurableLocalData() = runBlocking {
        assertDebug()
        try {
            assertEquals(CloudAccountSnapshot.scopeFor(uid), app.workspaceScope)
            assertEquals(uid, CachedAccountEntry(app).read(app.workspaceScope)?.identity?.uid)
            val repo = HabitsRepository(app)
            assertEquals("Проверка чтения", repo.workspace.first().habits.single { it.id == "background-reading" }.title)
            assertFalse(repo.workspace.first().settings.notifications.enabled)
            val prefs = LocalPreferences(app, app.workspaceScope)
            assertEquals(CalendarMode.LUNAR, prefs.values.first().display)
            assertEquals(false, prefs.values.first().use24)
            assertEquals(mapOf("display" to "lunar", "time" to "12h"), prefs.pending.first())
            val notification = app.getSystemService(NotificationManager::class.java).activeNotifications
                .single { it.notification.extras.getString(Notification.EXTRA_TITLE) == "Проверка чтения" }
            assertTrue(notification.postTime >= fixture.getLong("expectedAt", Long.MAX_VALUE))
            val verificationStartedAt = InstrumentationRegistry.getArguments().getString("verificationStartedAt")?.toLong()
            if (verificationStartedAt != null) assertTrue("The OS must deliver before the app/test is relaunched",
                notification.postTime < verificationStartedAt)
            val body = notification.notification.extras.getCharSequence(Notification.EXTRA_TEXT).toString()
            assertTrue(body.contains("Проверка чтения"))
            assertFalse(body.contains("Героический зов:"))
            assertTrue(app.database.dao().outbox(app.workspaceScope).any { it.entityId == "habits" })
            println("GENESIS_BACKGROUND_DELIVERED_AND_OFFLINE_STATE_PRESERVED")
        } finally {
            val manager = app.getSystemService(NotificationManager::class.java)
            manager.activeNotifications.filter { it.notification.extras.getString(Notification.EXTRA_TITLE) == "Проверка чтения" }
                .forEach { manager.cancel(it.tag, it.id) }
            app.scheduler.deactivate(app.workspaceScope)
            CachedAccountEntry(app).clear(app.workspaceScope)
            app.activateAccount(null)
            fixture.edit().remove("isolated").remove("expectedAt").remove("originalScope").commit()
            app.scheduler.restore(); app.scheduler.restoreHabitNotifications()
            ru.genesis.calendar.auth.CloudSyncWorker.enqueue(app)
        }
    }
}
