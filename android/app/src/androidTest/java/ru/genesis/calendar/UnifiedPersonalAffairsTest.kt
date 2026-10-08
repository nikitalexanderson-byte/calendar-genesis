package ru.genesis.calendar

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.time.LocalDate
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.ui.*

class UnifiedPersonalAffairsTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()

    @Test fun requiredUpdateCannotBeDismissedWithLaterOrBack() {
        var dismissed = false
        compose.setContent { MaterialTheme(colorScheme = standart) {
            AndroidUpdateDialog(compose.activity, AndroidRelease(77, "2.7.1", "a".repeat(64), required = true)) {
                dismissed = true
            }
        } }
        compose.onNodeWithTag("android-update-dialog").assertExists()
        compose.onNodeWithText("Позже").assertDoesNotExist()
        androidx.test.uiautomator.UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack()
        compose.waitForIdle()
        compose.onNodeWithTag("android-update-dialog").assertExists()
        assertFalse(dismissed)
    }

    @Test fun chaosListsExpandInPlaceAndCreateInTheOriginalAccount() {
        val app = compose.activity.application as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        app.activateAccount(null)
        val list = GoogleTaskList("qa-unified-list", "План чтения", "qa-google", "qa@example.invalid")
        val listed = LocalTask("qa-listed-task", "Прочитать главу", date = LocalDate.now().toString(),
            sourceFieldsJson = listTaskFields(list, CalendarMode.LUNAR).toString())
        val loose = LocalTask("qa-loose-task", "Записать идею", date = LocalDate.now().toString())
        val dark = InstrumentationRegistry.getArguments().getString("genesisEvening") == "true"
        val width = InstrumentationRegistry.getArguments().getString("genesisWidth")?.toIntOrNull() ?: 390
        var selectedList: GoogleTaskList? = null
        var requestedTaskProject: String? = "unset"
        var listRequested = false
        var openedTask: String? = null
        compose.setContent {
            val density = Density(compose.activity.resources.displayMetrics.widthPixels.toFloat() / width,
                LocalDensity.current.fontScale)
            CompositionLocalProvider(LocalEveningTheme provides dark, LocalDensity provides density) {
                MaterialTheme(colorScheme = if (dark) evening else standart) {
                    Surface(Modifier.fillMaxSize()) {
                        ProjectsScreen(app, listOf(listed, loose), true,
                            onOpenTask = { openedTask = it }, onCreateTask = { requestedTaskProject = it },
                            taskLists = listOf(list), onCreateList = { listRequested = true },
                            onCreateListTask = { selectedList = it })
                    }
                }
            }
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("projects-screen").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("personal-create-task").performClick()
        assertNull(requestedTaskProject)
        compose.onNodeWithTag("personal-create-list").performClick()
        assertTrue(listRequested)
        val screen = compose.onNodeWithTag("projects-screen")
        // On tablets the Chaos box is in the adjacent tools pane.
        if (compose.onAllNodesWithTag("project-tools-pane").fetchSemanticsNodes().isEmpty())
            screen.performScrollToNode(hasTestTag("personal-task-list-${list.id}"))
        compose.onNodeWithTag("personal-task-list-${list.id}")
            .assert(hasAnyAncestor(hasTestTag("project-inbox")))
        compose.onNodeWithTag("task-${listed.id}").assertDoesNotExist()
        compose.onNodeWithTag("toggle-task-list-${list.id}").performClick()
        compose.onAllNodesWithText(listed.title).assertCountEquals(1)
        compose.onNodeWithTag("task-${listed.id}").assertExists()
        compose.onNodeWithTag("add-list-task-${list.id}").performScrollTo().performClick()
        assertEquals(list, selectedList)
        compose.onNodeWithTag("task-title-${listed.id}", useUnmergedTree = true).performScrollTo().performClick()
        assertEquals(listed.id, openedTask)
        val label = InstrumentationRegistry.getArguments().getString("qaLabel") ?: "phone"
        File(app.getExternalFilesDir(null), "android-270-$label-${if (dark) "dark" else "light"}-chaos-list.png")
            .outputStream().use { compose.onRoot().captureToImage().asAndroidBitmap()
                .compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
    }
}
