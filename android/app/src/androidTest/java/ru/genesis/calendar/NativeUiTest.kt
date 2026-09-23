package ru.genesis.calendar

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import org.junit.Rule
import org.junit.Test
import org.junit.Before
import androidx.test.uiautomator.UiDevice
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File

class NativeUiTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Before fun requireIsolatedDebug() {
        check(BuildConfig.DEBUG && compose.activity.packageName.endsWith(".debug"))
        compose.runOnUiThread { compose.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
    }
    @Test fun nativeTaskFormPersistsEntry() {
        compose.runOnUiThread { compose.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
        compose.onNodeWithTag("create-task").performClick()
        compose.onNodeWithTag("task-title").performTextInput("UI synthetic validation")
        compose.onNodeWithTag("save-task").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("UI synthetic validation").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onAllNodesWithText("UI synthetic validation").onFirst().performScrollTo().assertIsDisplayed()
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
            File(compose.activity.getExternalFilesDir(null),"native-ui-validation.png"))
    }

    @Test fun nativeHabitFormPersistsEntry() {
        compose.onNodeWithText("Привычки").performScrollTo().performClick()
        compose.onNodeWithText("Новая привычка").performScrollTo().performClick()
        compose.onAllNodes(hasSetTextAction()).onFirst().performTextInput("UI synthetic habit")
        compose.onNodeWithText("Сохранить").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("UI synthetic habit",substring=true).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onAllNodesWithText("UI synthetic habit",substring=true).onFirst().assertExists()
    }

    @Test fun nativeMoodFormPersistsSelection() {
        compose.onNodeWithText("Трекеры").performScrollTo().performClick()
        val label=ru.genesis.calendar.domain.trackers.MoodTracker.option(1.0).label
        compose.onNode(hasText("Выбрать настроение") or hasText("Изменить настроение")).performScrollTo().performClick()
        compose.onNode(hasText(label,substring=true) and hasClickAction()).performScrollTo().performClick()
        compose.onNodeWithText("Сохранить").performScrollTo().performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Изменить настроение").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText(label,substring=true).assertExists()
    }
}
