package ru.genesis.calendar

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import org.junit.Rule
import org.junit.Test
import org.junit.Before
import androidx.test.uiautomator.UiDevice
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import androidx.compose.ui.geometry.Offset
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import java.util.UUID

class NativeUiTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Before fun requireIsolatedDebug() {
        check(BuildConfig.DEBUG && compose.activity.packageName.endsWith(".debug"))
        compose.runOnUiThread { compose.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
    }
    @Test fun nativeTaskFormPersistsEntry() {
        val title = "UI synthetic validation ${UUID.randomUUID()}"
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        compose.runOnUiThread { compose.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
        compose.onNodeWithTag("create-task").performClick()
        compose.onNodeWithTag("task-title").performTextInput(title)
        compose.onNodeWithTag("save-task").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            runBlocking { app.repository.tasks.first().any { it.title == title } }
        }
        compose.onNodeWithTag("today-list").performScrollToNode(hasText(title))
        compose.onNodeWithText(title).assertIsDisplayed()
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
        compose.onNodeWithText("Привычки").performScrollTo().performClick()
        compose.onNodeWithText("Сон и настроение").performClick()
        val label=ru.genesis.calendar.domain.trackers.MoodTracker.option(1.0).label
        compose.onNode(hasText("Выбрать настроение") or hasText("Изменить настроение")).performScrollTo().performClick()
        compose.onNode(hasText(label,substring=true) and hasClickAction()).performScrollTo().performClick()
        compose.onNodeWithText("Сохранить").performScrollTo().performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Изменить настроение").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText(label,substring=true).assertExists()
    }

    @Test fun prioritySupportsHoldAndHorizontalDrag() {
        compose.onNodeWithTag("create-task").performClick()
        compose.onNodeWithTag("priority-scale").performScrollTo().performTouchInput {
            down(Offset(center.x * .24f, center.y))
            advanceEventTime(700)
            moveTo(Offset(center.x * 1.82f, center.y))
            advanceEventTime(100)
            up()
        }
        compose.onNodeWithText("Приоритет · Горит · 10 из 10").assertExists()
        compose.onNodeWithText("Отмена").performScrollTo().performClick()
    }
}
