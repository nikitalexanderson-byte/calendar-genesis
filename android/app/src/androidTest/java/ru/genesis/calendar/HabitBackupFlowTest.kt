package ru.genesis.calendar

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.room.withTransaction
import androidx.test.platform.app.InstrumentationRegistry
import java.util.UUID
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.*
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.*
import ru.genesis.calendar.domain.habits.*
import ru.genesis.calendar.ui.*

class HabitBackupFlowTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()
    private lateinit var app: GenesisApplication
    private lateinit var scope: String
    private fun file() = InstrumentationRegistry.getInstrumentation().context.assets.open("habit-backup-web.json").bufferedReader().use { it.readText() }
    private fun source() = HabitBackups.parse(file()).workspace()
    private fun write(value: LocalHabitWorkspace) = runBlocking { app.database.withTransaction {
        app.database.dao().putDocument(DocumentRecord(scope, "habits", LocalCipher().encrypt(HabitDocument.encode(value), "$scope/habits"), 1))
    } }
    @Before fun setup() {
        app = compose.activity.application as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug") && app.workspaceScope == "internal-validation-v1")
        app.activateAccount(UUID.randomUUID().toString()); scope = app.workspaceScope
        check(scope.startsWith("account-"))
    }
    @After fun cleanup() {
        runBlocking { app.database.withTransaction {
            app.database.openHelper.writableDatabase.execSQL("DELETE FROM documents WHERE scope=?", arrayOf(scope))
            app.database.openHelper.writableDatabase.execSQL("DELETE FROM outbox WHERE scope=?", arrayOf(scope))
        } }
        app.activateAccount(null)
    }
    @Test fun cleanWebRestoreIsAtomicRetainsLedgerAndColdReplayDoesNotRewriteOutbox() = runBlocking {
        val service = HabitBackupService(app); val draft = service.prepare(file(), "web.json")
        assertNull(app.database.dao().document(scope, "habits")); service.apply(draft.id)
        val result = service.current(); assertEquals(2, result.habits.size)
        assertEquals("paused", HabitLifecycle.state(result.habits.first()).status)
        assertEquals("archived", HabitLifecycle.state(result.habits.last()).status)
        assertEquals(source().rewards, result.rewards); assertEquals(source().progress, result.progress)
        val record = app.database.dao().document(scope, "habits")!!; val outbox = app.database.dao().outbox(scope)
        assertEquals(1, outbox.size); assertNull(HabitBackupService(app).load())
        HabitBackupService(app).apply(draft.id)
        assertEquals(record, app.database.dao().document(scope, "habits")); assertEquals(outbox, app.database.dao().outbox(scope))
    }
    @Test fun encryptedDraftAndExplicitChoicesSurviveRepositoryReopening() = runBlocking {
        val source = source(); write(source.copy(habits = source.habits.map { it.copy(title = "Current " + it.title) }))
        val service = HabitBackupService(app); var draft = service.prepare(file(), "Собственное имя.json")
        for (row in draft.preview.habits) draft = service.choose(draft.id, row.id, "copy")
        val cold = HabitBackupService(app).load()!!
        assertEquals(draft.id, cold.id); assertEquals(draft.choices, cold.choices); assertEquals(draft.filename, cold.filename)
        assertFalse(app.database.dao().document(scope, "habit-restore-draft")!!.encrypted.contains("Собственное имя"))
        HabitBackupService(app).apply(cold.id)
        val result = service.current(); assertEquals(4, result.habits.size); assertEquals(source.progress, result.progress)
        assertEquals(source.rewards, result.rewards); assertEquals(0, result.completions.last().xpAwarded)
        val again = service.prepare(file(), "again.json"); assertTrue(again.preview.habits.all { it.kind == "restored" })
        service.cancel(again.id)
    }
    @Test fun changedDataRejectsOldPreviewPreservesDraftAndNeedsExplicitRenewal() = runBlocking {
        val service = HabitBackupService(app); val draft = service.prepare(file(), "web.json")
        write(source()); val before = app.database.dao().document(scope, "habits")!!
        assertThrows(IllegalArgumentException::class.java) { runBlocking { service.apply(draft.id) } }
        assertEquals(before, app.database.dao().document(scope, "habits")); assertTrue(service.load()!!.stale)
        val refreshed = service.refresh(draft.id); assertFalse(refreshed.stale); assertTrue(refreshed.choices.isEmpty())
    }
    @Test fun damagedFileKeepsAnExistingValidDraftAndCurrentEncryptedDocument() = runBlocking {
        write(source()); val service = HabitBackupService(app); val draft = service.prepare(file(), "valid.json")
        val before = app.database.dao().document(scope, "habits")!!
        assertThrows(Exception::class.java) { runBlocking { service.prepare("{bad", "broken.json") } }
        assertEquals(draft.id, service.load()!!.id); assertEquals(before, app.database.dao().document(scope, "habits"))
    }
    @Test fun failedTransactionRetainsAllDraftChunksAndDoesNotCreatePartialHistoryOrOutbox() = runBlocking {
        val service = HabitBackupService(app); val draft = service.prepare(file(), "valid.json")
        assertThrows(IllegalStateException::class.java) { runBlocking { HabitBackupService(app) { error("injected durable write failure") }.apply(draft.id) } }
        assertNull(app.database.dao().document(scope, "habits")); assertTrue(app.database.dao().outbox(scope).isEmpty())
        assertEquals(draft.id, HabitBackupService(app).load()!!.id)
        service.apply(draft.id); assertEquals(2, service.current().habits.size)
    }
    @Test fun portableFileLargerThanCursorWindowSurvivesEncryptedChunkRecovery() = runBlocking {
        val service = HabitBackupService(app); val text = " ".repeat(2_200_000) + file()
        val draft = service.prepare(text, "large.json"); val cold = HabitBackupService(app).load()!!
        assertEquals(draft.preview.backup.checksum, cold.preview.backup.checksum)
        assertEquals(draft.id, cold.id); service.apply(cold.id); assertEquals(2, service.current().habits.size)
    }
    @Test fun actualNativeScreenShowsSavedConflictsAndAppliesChosenCopies() {
        val source = source(); write(source.copy(habits = source.habits.map { it.copy(title = "Current " + it.title) },
            settings = HabitSettings(feedback = HabitFeedbackSettings(animations = false, achievementPopups = false, questsEnabled = false, gamificationWidgets = false))))
        val service = HabitBackupService(app); val draft = runBlocking { service.prepare(file(), "web.json") }
        compose.setContent { CompositionLocalProvider(LocalGenesisLanguage provides "ru", LocalEveningTheme provides false) {
            MaterialTheme(colorScheme = standart) { Surface(Modifier.fillMaxSize()) {
                Column { HabitsScreen(app, true, CalendarMode.PROFANE, CalendarMode.PROFANE) }
            } }
        } }
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("habit-workspace-menu").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("habit-workspace-menu").performClick()
        compose.onNodeWithTag("habit-open-data").performClick()
        compose.onNodeWithTag("habit-data-dialog").assertIsDisplayed()
        compose.waitUntil(30_000) { compose.onAllNodesWithTag("habit-restore-preview").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("habit-restore-apply").performScrollTo().assertIsNotEnabled()
        // Opening the workspace may finish its normal reconciliation after this draft was
        // prepared. Renew that preview explicitly, as the user does after a real sync.
        compose.onNodeWithTag("habit-restore-refresh").performScrollTo().performClick()
        compose.waitUntil(15_000) { runBlocking { service.load()?.stale == false } }
        for (row in draft.preview.habits) {
            compose.waitUntil(15_000) { compose.onNodeWithTag("habit-restore-copy-${row.id}").fetchSemanticsNode().config
                .getOrNull(androidx.compose.ui.semantics.SemanticsProperties.Disabled) == null }
            compose.onNodeWithTag("habit-restore-copy-${row.id}").performScrollTo().performClick()
            compose.waitUntil(15_000) { compose.onNodeWithTag("habit-restore-copy-${row.id}").fetchSemanticsNode().config
                .getOrNull(androidx.compose.ui.semantics.SemanticsProperties.Selected) == true }
        }
        compose.waitUntil(15_000) { compose.onNodeWithTag("habit-restore-apply").fetchSemanticsNode().config
            .getOrNull(androidx.compose.ui.semantics.SemanticsProperties.Disabled) == null }
        compose.onNodeWithTag("habit-restore-apply").performScrollTo().assertIsEnabled().performClick()
        compose.waitUntil(30_000) { runBlocking { service.current().habits.size == 4 } }
        assertNull(runBlocking { service.load() }); assertEquals(source.rewards, runBlocking { service.current().rewards })
    }
}
