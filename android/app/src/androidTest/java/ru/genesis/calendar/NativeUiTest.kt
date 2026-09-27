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
    @get:Rule val compose = createAndroidComposeRule<TestWorkspaceActivity>()
    @Before fun requireIsolatedDebug() {
        check(BuildConfig.DEBUG && compose.activity.packageName.endsWith(".debug"))
        compose.runOnUiThread { compose.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
    }
    @Test fun nativeTaskFormPersistsEntry() {
        val title = "UI synthetic validation ${UUID.randomUUID()}"
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        compose.runOnUiThread { compose.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
        compose.onNodeWithTag("today-list").performScrollToNode(hasTestTag("create-task"))
        compose.onNodeWithTag("create-task").performClick()
        compose.onNodeWithTag("task-title").performTextInput(title)
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack()
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

    @Test fun prioritySupportsImmediateHorizontalDragAndTap() {
        compose.onNodeWithTag("today-list").performScrollToNode(hasTestTag("create-task"))
        compose.onNodeWithTag("create-task").performClick()
        compose.onNodeWithTag("priority-scale").performScrollTo().performTouchInput {
            down(Offset(center.x * .24f, center.y))
            advanceEventTime(30)
            moveTo(Offset(center.x * 1.82f, center.y))
            advanceEventTime(50)
            up()
        }
        compose.onNodeWithText("Приоритет · Горит · 10 из 10").assertExists()
        compose.onNodeWithTag("priority-scale").performTouchInput {
            click(Offset(center.x * .24f, center.y))
        }
        compose.onNodeWithText("Приоритет · Низкий · 2 из 10").assertExists()
        compose.onNodeWithText("Отмена").performScrollTo().performClick()
    }

    @Test fun accountSettingsAlwaysShowThreeExternalLinks() {
        compose.onNodeWithText("Настройки").performScrollTo().performClick()
        compose.onNodeWithTag("account-link-telegram").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("account-link-donate").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("account-link-web").performScrollTo().assertIsDisplayed()
    }

    @Test fun settingsExposeWebsiteHabitControlsAsSeparateCards() {
        compose.onNodeWithText("Настройки").performScrollTo().performClick()
        compose.onNodeWithTag("habit-tracking-settings").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("habit-notification-settings").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("habit-feedback-settings").performScrollTo().assertIsDisplayed()
    }

    @Test fun selectedCalendarHeroIsNotDuplicatedInKnowledgeCards() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        val preferences = ru.genesis.calendar.data.LocalPreferences(app, app.workspaceScope)
        val initial = runBlocking { preferences.values.first().display }
        try {
            runBlocking { preferences.set("display", "profane") }
            compose.waitUntil(5_000) {
                compose.onAllNodesWithText("ГРИГОРИАНСКИЙ КАЛЕНДАРЬ", substring = true)
                    .fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("today-list").performScrollToNode(hasTestTag("day-knowledge"))
            compose.onAllNodesWithTag("gregorian-calendar-card").assertCountEquals(0)
            compose.onAllNodesWithTag("sacred-calendar-card").assertCountEquals(1)
            compose.onAllNodesWithTag("lunar-calendar-card").assertCountEquals(1)
            compose.onNodeWithText("САКРАЛЬНЫЙ КАЛЕНДАРЬ · СМЫСЛ ДНЯ").assertExists()
        } finally {
            runBlocking { preferences.set("display", initial.wireValue) }
        }
    }

    @Test fun settingsLanguageSwitchesWithoutLeavingWorkspace() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        val preferences = ru.genesis.calendar.data.LocalPreferences(app, app.workspaceScope)
        val initial = runBlocking { preferences.values.first().language }
        try {
            runBlocking { preferences.set("language", "ru") }
            compose.waitUntil(5_000) { compose.onAllNodesWithText("Настройки").fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithText("Настройки").performScrollTo().performClick()
            compose.onNodeWithTag("language-en").performClick()
            compose.onAllNodesWithText("Settings").onFirst().assertExists()
            compose.onNodeWithTag("language-ru").performClick()
            compose.onAllNodesWithText("Настройки").onFirst().assertExists()
        } finally {
            runBlocking { preferences.set("language", initial) }
        }
    }
}
