package ru.genesis.calendar

import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.WorkManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import ru.genesis.calendar.auth.*
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.*
import ru.genesis.calendar.domain.habits.*
import java.time.*

/** Anonymous production responses are exercised against synthetic device accounts only. */
class ExpiredSessionReminderTest {
    @Test fun expiredServerSessionPreservesEveryAccountLocalDataAndHabitAlarms() = runBlocking {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val fixture = app.getSharedPreferences("genesis.validation.v1", Context.MODE_PRIVATE)
        fixture.edit().putBoolean("isolated", true).commit()
        WorkManager.getInstance(app).cancelUniqueWork("genesis-cloud-sync-v1").result.get()
        app.activateAccount(null)
        val client = AuthSessionClient(app)
        client.clear(client.begin())
        val controller = AuthController.get(app)
        val uids = listOf("unlisted-consumer-account", "workspace-domain-account", "legacy-linked-account-000123")
        try {
            for(uid in uids) {
                app.activateAccount(uid)
                val scope = app.workspaceScope
                val settings = AccountSettings(listOf(LinkedGoogleAccount("test", "test@example.invalid", "Validation", true, false, false)),
                    SyncRouting("fixed", listOf("test"), emptyMap()), false, "standart", 0,
                    "sacred", "profane", "24h", false, "ru")
                CachedAccountEntry(app).save(ServerIdentity(uid, "Validation", "test@example.invalid"), settings)
                val repo = HabitsRepository(app)
                repo.delete("session-reading")
                val date = LocalDate.now()
                repo.save(Habit(TrackerEntity.create("habit", id="session-reading"), "Локальное чтение", date,
                    HabitEngine(GenesisCalendar()).defaultSchedule(date, CalendarMode.PROFANE),
                    preferredTime=LocalTime.now().plusHours(1).withSecond(0).withNano(0).toString(),
                    reminder=HabitReminder(enabled=true,allowDuringQuietHours=true)))
                LocalPreferences(app, scope).setPending("display", "lunar")
                val before = app.getSharedPreferences("genesis_habit_alarm_registry", Context.MODE_PRIVATE)
                    .getStringSet("alarms", emptySet()).orEmpty().toSet()
                assertTrue(before.isNotEmpty())
                assertTrue(controller.synchronizeInBackground())
                assertEquals(scope, app.workspaceScope)
                assertEquals(uid, controller.state.value.user?.uid)
                assertTrue(controller.state.value.ready)
                assertTrue(controller.state.value.requiresSignIn)
                assertEquals(uid, CachedAccountEntry(app).read(scope)?.identity?.uid)
                assertEquals("Локальное чтение", repo.workspace.first().habits.single { it.id=="session-reading" }.title)
                assertEquals("lunar", LocalPreferences(app, scope).pending.first()["display"])
                assertEquals(before, app.getSharedPreferences("genesis_habit_alarm_registry", Context.MODE_PRIVATE)
                    .getStringSet("alarms", emptySet()).orEmpty())
                assertTrue(app.database.dao().outbox(scope).any { it.entityId=="habits" })
                app.scheduler.deactivate(scope)
                CachedAccountEntry(app).clear(scope)
            }
        } finally {
            app.activateAccount(null)
            fixture.edit().remove("isolated").commit()
            CloudSyncWorker.enqueue(app)
        }
    }
}
