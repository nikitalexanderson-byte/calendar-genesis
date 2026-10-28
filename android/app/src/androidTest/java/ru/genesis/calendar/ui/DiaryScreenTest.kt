package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.PagerTestActivity
import ru.genesis.calendar.captureNativeWindow
import ru.genesis.calendar.auth.AuthFailure
import ru.genesis.calendar.auth.DiaryGateway
import ru.genesis.calendar.auth.DiaryProtocol
import ru.genesis.calendar.data.*
import java.io.File
import java.util.Base64

private class DiaryUiStore : DiaryStore {
    var ciphertext: String? = null
    var failWrites = false
    override suspend fun read() = ciphertext
    override suspend fun write(ciphertext: String) { check(!failWrites) { "Synthetic storage failure" }; this.ciphertext = ciphertext }
}
private class DiaryUiGateway : DiaryGateway {
    val key = ByteArray(32) { it.toByte() }
    val rows = mutableMapOf<String, JSONObject>()
    override fun check() = Unit
    override suspend fun workspace() = JSONObject().put("workspace", JSONObject().put("keyMode", "account").put("key", Base64.getEncoder().encodeToString(key)))
    override suspend fun request(path: String, body: JSONObject?): JSONObject {
        if (body == null) return JSONObject().put("notes", JSONArray(rows.values.toList()))
        val id = path.substringAfterLast('/'); val previous = rows[id]
        val same = previous != null && previous.getString("ciphertext") == body.getString("ciphertext") && previous.getString("iv") == body.getString("iv")
        if (!same) {
            if ((previous?.getLong("revision") ?: 0) != body.getLong("expectedRevision")) throw AuthFailure(AuthFailure.Kind.CONFLICT, 409)
            rows[id] = JSONObject(body.toString()).put("id", id).put("revision", body.getLong("expectedRevision") + 1).put("updatedAt", "2026-10-26T12:00:00Z")
        }
        return JSONObject().put("revision", rows.getValue(id).getLong("revision")).put("updatedAt", "2026-10-26T12:00:00Z")
    }
}

/** Standalone synthetic account: no user session, app workspace, device data or production API. */
class DiaryScreenTest {
    @get:Rule val compose = createAndroidComposeRule<PagerTestActivity>()
    private val store = DiaryUiStore()
    private val gateway = DiaryUiGateway()
    private val repository = DiaryRepository("diary-ui-fixture", gateway, store, DiaryKeystoreCipher("diary-ui-fixture", "diary-ui-fixture"))
    private val width get() = InstrumentationRegistry.getArguments().getString("genesisWidth")?.toIntOrNull() ?: 390
    private val dark get() = InstrumentationRegistry.getArguments().getString("genesisEvening") == "true"
    @Composable private fun Content() {
        val scale = InstrumentationRegistry.getArguments().getString("genesisFontScale")?.toFloatOrNull() ?: LocalDensity.current.fontScale
        val density = Density(compose.activity.resources.displayMetrics.widthPixels.toFloat() / width, scale)
        CompositionLocalProvider(LocalDensity provides density, LocalGenesisLanguage provides "ru", LocalEveningTheme provides dark) {
            MaterialTheme(colorScheme = if (dark) evening else standart, typography = GenesisTypography, shapes = GenesisShapes) {
                Surface(Modifier.fillMaxSize()) {
                    MobileWorkspaceShell("Дневник", null, emptyList(), "Synthetic fixture", true,
                        onNavigate = {}, actions = {
                            CalendarModeSwitcher(ru.genesis.calendar.domain.CalendarMode.PROFANE, {}, size = 48.dp)
                        }, footerActions = {
                            WorkspaceAccountRefreshButton("Обновить аккаунт", onClick = {})
                        }) { DiaryScreen(repository, {}) }
                }
            }
        }
    }
    private fun await(tag: String) { compose.waitUntil(20_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }; compose.waitForIdle() }
    private fun capture(name: String, tag: String = "diary-screen") {
        compose.waitForIdle()
        compose.onNodeWithTag(tag).assertExists()
        captureNativeWindow(File(compose.activity.getExternalFilesDir(null), "diary-${width}-${if (dark) "dark" else "light"}-$name.png"))
    }

    @Test fun palettePresetsAreEqualAndCustomColorAppliesOnlyOnConfirmation() {
        compose.setContent { Content() }; await("diary-create")
        compose.onNodeWithTag("diary-create").performClick(); await("diary-editor")
        compose.onNodeWithTag("diary-body").performTextReplacement("Проверка собственной палитры")
        capture("preset-options", "diary-editor")
        val swatches = DiaryNote.colors.map { color -> compose.onNodeWithTag("diary-color-$color").performScrollTo()
            .assertHeightIsAtLeast(48.dp).fetchSemanticsNode().size }
        assertTrue("Preset layout sizes must match, independently of scroll clipping: $swatches",
            swatches.all { kotlin.math.abs(it.width - swatches.first().width) <= 1 && it.height == swatches.first().height })
        compose.onNodeWithTag("diary-color-custom").performScrollTo().performClick(); await("diary-color-picker")
        compose.onNodeWithTag("diary-swatch-#bb704b").performScrollTo().performClick()
        compose.onNode(hasText("Отмена") and hasAnyAncestor(hasTestTag("diary-color-picker")),
            useUnmergedTree = true).performClick()
        compose.onNodeWithTag("diary-color-sage").assertIsSelected()
        compose.onNodeWithTag("diary-color-custom").performScrollTo().performClick(); await("diary-color-picker")
        compose.onNodeWithTag("diary-swatch-#bb704b").performScrollTo().performClick()
        capture("custom-palette", "diary-color-picker")
        compose.onNodeWithTag("diary-color-apply").performClick()
        compose.onNodeWithTag("diary-color-custom").assertIsSelected()
        capture("custom-color-editor", "diary-editor")
        compose.onNodeWithTag("diary-save").performClick()
        compose.waitUntil(20_000) { repository.state.value.records.any { !it.draft && it.note.customColor == "#bb704b" } }
        val record = repository.state.value.records.single { !it.draft }
        compose.onNodeWithTag("diary-open-${record.note.id}").performScrollTo().performClick(); await("diary-editor")
        compose.onNodeWithTag("diary-color-custom").performScrollTo().assertIsSelected()
    }

    @Test fun failedLocalDraftDoesNotPromiseDurabilityAndCanBeRetried() {
        compose.setContent { Content() }; await("diary-create")
        val title = compose.onNodeWithTag("workspace-title").fetchSemanticsNode().boundsInRoot
        val create = compose.onNodeWithTag("diary-create").fetchSemanticsNode().boundsInRoot
        val actions = compose.onNodeWithTag("diary-actions").fetchSemanticsNode().boundsInRoot
        val calendar = compose.onNodeWithTag("calendar-mode-icon-profane").fetchSemanticsNode().boundsInRoot
        assertTrue(title.right <= create.left && create.right <= actions.left && actions.right <= calendar.left)
        compose.onNodeWithTag("diary-create").performClick(); await("diary-editor")
        store.failWrites = true
        compose.onNodeWithTag("diary-body").performTextReplacement("Текст должен остаться в форме при ошибке устройства")
        await("diary-editor-error")
        compose.onNodeWithTag("diary-editor-error").performScrollTo()
            .assertTextContains("Введённые данные остаются в форме.", substring = true)
        compose.onNodeWithContentDescription("Закрыть").performClick()
        compose.onNodeWithContentDescription("Сохранить черновик").performClick()
        compose.onNodeWithTag("diary-close-error").assertIsDisplayed()
        capture("local-storage-error", "diary-close-error")
        store.failWrites = false
        compose.onNodeWithContentDescription("Сохранить черновик").performClick()
        compose.waitUntil(20_000) { repository.state.value.records.any { it.draft } }
        compose.onNodeWithTag("diary-editor").assertDoesNotExist()
    }

    @Test fun noteSaveRemainsVisibleWithKeyboardAndLongText() {
        compose.setContent { Content() }; await("diary-create")
        compose.onNodeWithTag("diary-create").performClick(); await("diary-editor")
        compose.onNodeWithTag("diary-body").performClick()
        compose.onNodeWithTag("diary-body").performTextReplacement("Длинный текст записи. ".repeat(100))
        compose.waitUntil(10_000) {
            androidx.test.uiautomator.UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
                .executeShellCommand("dumpsys input_method").contains("mInputShown=true")
        }
        compose.onNodeWithTag("diary-save").assertIsDisplayed().assertIsEnabled()
        capture("keyboard", "diary-editor")
        val device = androidx.test.uiautomator.UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        val close = requireNotNull(device.findObject(androidx.test.uiautomator.By.desc("Закрыть").pkg(compose.activity.packageName))) {
            "Close remains accessible with a long note and IME"
        }
        val statusBarHeight = compose.runOnIdle {
            requireNotNull(androidx.core.view.ViewCompat.getRootWindowInsets(compose.activity.window.decorView))
                .getInsets(androidx.core.view.WindowInsetsCompat.Type.statusBars()).top
        }
        val closeBounds = close.visibleBounds
        assertTrue("Close bounds=$closeBounds must stay below status bar=$statusBarHeight", closeBounds.top >= statusBarHeight)
        compose.onNodeWithTag("diary-save").performClick()
        compose.waitUntil(20_000) { repository.state.value.records.any { !it.draft } }
        assertTrue(repository.state.value.records.single { !it.draft }.note.body.length > 1000)
    }
    @Test fun createEditSearchPinArchiveAndRestorePersistEncryptedNotes() {
        compose.setContent { Content() }; await("diary-create")
        compose.onNodeWithTag("diary-create").performClick(); await("diary-editor")
        compose.onNodeWithTag("diary-title").performTextReplacement("Личная мысль — день 1")
        compose.onNodeWithTag("diary-body").performTextReplacement("Исходная личная заметка. Не переводить этот текст.")
        compose.onNodeWithTag("diary-body").assertTextContains("Исходная личная заметка.", substring = true)
        capture("editor", "diary-editor")
        compose.onNodeWithTag("diary-save").performClick()
        compose.waitUntil(20_000) { repository.state.value.records.any { !it.draft } }
        val id = repository.state.value.records.first { !it.draft }.note.id
        await("diary-note-$id"); capture("board")
        compose.onNodeWithTag("diary-tab-board").assertDoesNotExist()
        compose.onNodeWithTag("diary-tab-favorites").assertDoesNotExist()
        compose.onNodeWithTag("diary-actions").performClick()
        compose.onNodeWithTag("diary-favorites-open").performClick()
        compose.onNodeWithTag("diary-note-$id").assertDoesNotExist()
        compose.onNodeWithText("Избранных советов пока нет.").assertExists()
        compose.onNodeWithTag("diary-back-to-board").assertWidthIsAtLeast((width - 26).dp).assertHeightIsAtLeast(48.dp)
        capture("favorites")
        compose.onNodeWithTag("diary-back-to-board").performClick()
        compose.onNodeWithTag("diary-back-to-board").assertDoesNotExist()
        await("diary-note-$id")
        assertFalse(store.ciphertext!!.contains("Личная мысль"))
        compose.onNodeWithTag("diary-pin-$id").performClick()
        compose.waitUntil(20_000) { repository.state.value.records.any { !it.draft && it.note.pinned } }
        compose.onNodeWithTag("diary-open-$id").performClick(); await("diary-body")
        compose.onNodeWithTag("diary-body").performTextReplacement("Отредактированный текст сохранён")
        compose.onNodeWithTag("diary-save").performClick()
        compose.waitUntil(20_000) { repository.state.value.records.any { !it.draft && it.note.body == "Отредактированный текст сохранён" } }
        compose.onNodeWithTag("diary-search-open").performClick(); await("diary-search")
        val search = compose.onNodeWithTag("diary-search").fetchSemanticsNode().boundsInRoot
        val closeSearch = compose.onNodeWithTag("diary-search-close").fetchSemanticsNode().boundsInRoot
        org.junit.Assert.assertEquals("Diary search controls share a vertical center", search.center.y, closeSearch.center.y, 1f)
        assertTrue(search.right <= closeSearch.left)
        compose.onNodeWithTag("diary-search-close").assertHeightIsAtLeast(48.dp).assertWidthIsAtLeast(48.dp)
        capture("search")
        compose.onNodeWithTag("diary-search").performTextReplacement("нет такой записи")
        compose.onNodeWithTag("diary-note-$id").assertDoesNotExist()
        compose.onNodeWithTag("diary-search").performTextClearance()
        await("diary-archive-$id"); compose.onNodeWithTag("diary-archive-$id").performClick()
        compose.waitUntil(20_000) { repository.state.value.records.any { !it.draft && it.note.archived } }
        compose.onNodeWithContentDescription("Действия дневника").performClick(); compose.onNodeWithText("Архив").performClick()
        await("diary-archive-$id"); capture("archive")
        compose.onNodeWithTag("diary-archive-$id").performClick()
        compose.waitUntil(20_000) { repository.state.value.records.any { !it.draft && !it.note.archived } }
        compose.onNodeWithTag("diary-back-to-board").performClick(); await("diary-note-$id")
        val reopened = DiaryRepository("diary-ui-fixture", gateway, store, DiaryKeystoreCipher("diary-ui-fixture", "diary-ui-fixture"))
        runBlocking { reopened.loadCached() }
        assertEquals("Отредактированный текст сохранён", reopened.state.value.records.single { !it.draft }.note.body)
    }
    @Test fun encryptedEditorRestoresAndDirtyExitKeepsRecoverableDraft() {
        val restoration = StateRestorationTester(compose)
        restoration.setContent { Content() }; await("diary-create")
        compose.onNodeWithTag("diary-create").performClick(); await("diary-editor")
        compose.onNodeWithTag("diary-title").performTextReplacement("Незаконченная мысль")
        compose.onNodeWithTag("diary-body").performTextReplacement("Текст до поворота экрана")
        restoration.emulateSavedInstanceStateRestore(); await("diary-body")
        compose.onNodeWithTag("diary-body").assertTextContains("Текст до поворота экрана")
        compose.onNodeWithContentDescription("Закрыть").performClick(); compose.onNodeWithContentDescription("Сохранить черновик").performClick()
        compose.waitUntil(20_000) { repository.state.value.records.any { it.draft } }
        val row = repository.state.value.records.single { it.draft }
        assertEquals("Текст до поворота экрана", row.note.body)
        assertTrue(gateway.rows.isEmpty()); assertFalse(store.ciphertext!!.contains("Текст до поворота"))
    }
    @Test fun staleEditOffersCopyAndPreservesOtherDeviceVersion() {
        val note = DiaryNote.create("Первоначальный текст", "Общая заметка")
        runBlocking { repository.save(note) }
        compose.setContent { Content() }; await("diary-open-${note.id}")
        compose.onNodeWithTag("diary-open-${note.id}").performClick(); await("diary-body")
        compose.onNodeWithTag("diary-body").performTextReplacement("Моя несохранённая версия")
        runBlocking { gateway.request("/diary/${note.id}", DiaryProtocol.seal("diary-ui-fixture", note.changed { put("body", "Текст другого устройства") }, 1, gateway.key)) }
        compose.onNodeWithTag("diary-save").performClick(); await("diary-editor-error")
        compose.onNodeWithText("Сохранить копию").assertExists(); capture("conflict", "diary-editor")
        compose.onNodeWithTag("diary-save").performClick()
        compose.waitUntil(20_000) { repository.state.value.records.count { !it.draft } == 2 }
        runBlocking { repository.refresh() }
        assertEquals(setOf("Моя несохранённая версия", "Текст другого устройства"), repository.state.value.records.filterNot { it.draft }.map { it.note.body }.toSet())
    }
    @Test fun roomEntryPointsShareOneJournalAndPersistOnlyCiphertext() {
        val database = androidx.room.Room.inMemoryDatabaseBuilder(compose.activity, GenesisDatabase::class.java).build()
        try {
            val one = DiaryRepository.room(database, "diary-room-fixture", "diary-ui-fixture", gateway)
            val two = DiaryRepository.room(database, "diary-room-fixture", "diary-ui-fixture", gateway)
            assertSame(one, two)
            runBlocking {
                one.keepDraft(DiaryNote.create("Never plaintext in Room or WAL", "Private Room fixture"))
                val row = database.dao().document("diary-room-fixture", "diary-v1")
                assertNotNull(row); assertFalse(row!!.encrypted.contains("Never plaintext"))
                assertTrue(two.state.value.records.single().draft)
            }
        } finally { database.close() }
    }

}
