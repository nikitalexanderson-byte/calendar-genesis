package ru.genesis.calendar

import android.content.Context
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.room.withTransaction
import androidx.test.platform.app.InstrumentationRegistry
import java.util.UUID
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.data.*

/** These phases are deliberately separated by an adb force-stop in the acceptance harness. */
class HabitBackupProcessRecoveryTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()
    private fun guarded(): GenesisApplication {
        assumeTrue(InstrumentationRegistry.getArguments().getString("genesisE5ProcessRecovery") == "true")
        val app = compose.activity.application as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName == "ru.genesis.calendar.ghttps.debug")
        val recoveryUid = app.getSharedPreferences("e5-process-recovery", Context.MODE_PRIVATE).getString("uid", null)
        check(app.workspaceScope == "internal-validation-v1" || recoveryUid != null &&
            app.workspaceScope == ru.genesis.calendar.auth.CloudAccountSnapshot.scopeFor(recoveryUid))
        return app
    }
    @Test fun stageBeforeProcessDeath() = runBlocking {
        val app = guarded(); val uid = UUID.randomUUID().toString(); app.activateAccount(uid)
        val service = HabitBackupService(app)
        val text = InstrumentationRegistry.getInstrumentation().context.assets.open("habit-backup-web.json").bufferedReader().use { it.readText() }
        val source = HabitBackups.parse(text).workspace()
        app.database.withTransaction { app.database.dao().putDocument(DocumentRecord(app.workspaceScope, "habits",
            LocalCipher().encrypt(HabitDocument.encode(source.copy(habits = source.habits.map { it.copy(title = "Current " + it.title) })), "${app.workspaceScope}/habits"), 1)) }
        var draft = service.prepare(text, "После перезапуска.json")
        for (row in draft.preview.habits) draft = service.choose(draft.id, row.id, "copy")
        check(app.getSharedPreferences("e5-process-recovery", Context.MODE_PRIVATE).edit().putString("uid", uid).putString("draft", draft.id).commit())
        assertEquals(2, service.load()!!.choices.size)
    }
    @Test fun reopenAfterProcessDeathAndApplyExactlyOnce() = runBlocking {
        val app = guarded(); val preferences = app.getSharedPreferences("e5-process-recovery", Context.MODE_PRIVATE)
        val uid = requireNotNull(preferences.getString("uid", null)); val id = requireNotNull(preferences.getString("draft", null))
        app.activateAccount(uid); val scope = app.workspaceScope
        try {
            val service = HabitBackupService(app); val draft = service.load()!!
            assertEquals(id, draft.id); assertEquals("После перезапуска.json", draft.filename)
            assertTrue(draft.choices.values.all { it == "copy" }); assertFalse(draft.stale)
            val before = service.current(); service.apply(id)
            val after = service.current(); assertEquals(4, after.habits.size)
            assertEquals(before.progress, after.progress); assertEquals(before.rewards, after.rewards)
            val document = app.database.dao().document(scope, "habits"); val outbox = app.database.dao().outbox(scope)
            HabitBackupService(app).apply(id)
            assertEquals(document, app.database.dao().document(scope, "habits")); assertEquals(outbox, app.database.dao().outbox(scope))
            assertNull(service.load())
        } finally {
            app.database.withTransaction {
                app.database.openHelper.writableDatabase.execSQL("DELETE FROM documents WHERE scope=?", arrayOf(scope))
                app.database.openHelper.writableDatabase.execSQL("DELETE FROM outbox WHERE scope=?", arrayOf(scope))
            }
            preferences.edit().clear().commit(); app.activateAccount(null)
        }
    }
}
