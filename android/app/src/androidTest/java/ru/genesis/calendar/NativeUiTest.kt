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
        compose.scrollToTodayNode(hasTestTag("create-task"))
        compose.onNodeWithTag("create-task").performClick()
        compose.onNodeWithTag("task-title").performTextInput(title)
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack()
        compose.onNodeWithTag("save-task").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            runBlocking { app.repository.tasks.first().any { it.title == title } }
        }
        compose.scrollToTodayNode(hasText(title))
        compose.onNodeWithText(title).assertIsDisplayed()
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
            File(compose.activity.getExternalFilesDir(null),"native-ui-validation.png"))
    }

    @Test fun nativeHabitFormPersistsEntry() {
        compose.onNodeWithTag("navigation-Привычки").performClick()
        compose.onNodeWithText("Новая привычка").performScrollTo().performClick()
        compose.onAllNodes(hasSetTextAction()).onFirst().performTextInput("UI synthetic habit")
        compose.onNodeWithTag("habit-emoji-picker-open").performScrollTo().performClick()
        compose.onNodeWithText("Животные и природа").performScrollTo().performClick()
        compose.onNodeWithTag("habit-emoji-choice-🦋").performScrollTo().performClick()
        compose.onNodeWithTag("habit-emoji").assertTextContains("🦋")
        compose.onNodeWithText("Сохранить").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("UI synthetic habit",substring=true).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onAllNodesWithText("UI synthetic habit",substring=true).onFirst().assertExists()
    }

    @Test fun nativeMoodFormPersistsSelection() {
        compose.onNodeWithTag("navigation-Привычки").performClick()
        compose.onNodeWithText("Сон и настроение").performClick()
        val label=ru.genesis.calendar.domain.trackers.MoodTracker.option(1.0).label
        compose.onNode(hasText("Выбрать настроение") or hasText("Изменить настроение")).performScrollTo().performClick()
        compose.onNode(hasText(label,substring=true) and hasClickAction()).performScrollTo().performClick()
        compose.onNodeWithText("Сохранить").performScrollTo().performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Изменить настроение").fetchSemanticsNodes().isNotEmpty() }
        // The selected mood is shown in both the summary metric and its detail card.
        compose.onAllNodesWithText(label,substring=true).onFirst().assertExists()
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        compose.waitUntil(10_000) {
            runBlocking { ru.genesis.calendar.data.TrackersRepository(app).workspace.first()
                .moodEntries.any { it.date == java.time.LocalDate.now() && it.moodValue == 1 } }
        }
    }

    @Test fun customMoodNameAndEmojiCanBePickedOnDevice() {
        compose.onNodeWithTag("navigation-Привычки").performClick()
        compose.onNodeWithText("Сон и настроение").performClick()
        compose.onNode(hasText("Выбрать настроение") or hasText("Изменить настроение")).performScrollTo().performClick()
        compose.onNodeWithTag("custom-mood-choice").performScrollTo().performClick()
        compose.onNodeWithTag("custom-mood-label").performTextClearance()
        compose.onNodeWithTag("custom-mood-label").performTextInput("Вдохновение")
        compose.onNodeWithTag("mood-emoji-😌").performScrollTo().performClick()
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack()
        compose.onNodeWithText("Сохранить").performScrollTo().performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("custom-mood-choice").fetchSemanticsNodes().isEmpty() }
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        compose.waitUntil(10_000) {
            runBlocking { ru.genesis.calendar.data.TrackersRepository(app).workspace.first()
                .moodEntries.any { it.customLabel == "Вдохновение" && it.customEmoji == "😌" } }
        }
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
            File(app.getExternalFilesDir(null),"mood-custom-2.6.2.png"))
    }

    @Test fun monthReturnTodayButtonKeepsCalendarMonthOpen() {
        compose.onNodeWithTag("navigation-Календарь").performClick()
        compose.onNodeWithTag("calendar-month-next").performScrollTo().performClick()
        compose.onNodeWithTag("calendar-month-today").performScrollTo().performClick()
        compose.onNodeWithTag("calendar-month").assertExists()
        compose.onNodeWithTag("calendar-view-switch").assertExists()
        compose.onNodeWithTag("calendar-month-today").performScrollTo().assertIsDisplayed()
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
            File(compose.activity.getExternalFilesDir(null),"calendar-month-today-2.6.0.png"))
    }

    @Test fun lunarHabitEditorShowsNewCadencesAndFramedFields() {
        compose.onNodeWithTag("navigation-Привычки").performClick()
        compose.onNodeWithText("Новая привычка").performScrollTo().performClick()
        compose.onNodeWithText("Календарь и срок").assertExists()
        compose.onNodeWithText("Повторение").assertExists()
        compose.onNodeWithTag("habit-calendar-lunar").performScrollTo().performClick()
        compose.onNodeWithText("Повторение по лунному календарю").assertExists()
        compose.onNodeWithTag("habit-lunar-cadence-lunar-phases").performScrollTo().performClick()
        compose.onNodeWithText("Полнолуние").assertExists()
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
            File(compose.activity.getExternalFilesDir(null),"habit-lunar-editor-2.6.0.png"))
    }

    @Test fun prioritySupportsImmediateHorizontalDragAndTap() {
        compose.scrollToTodayNode(hasTestTag("create-task"))
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
        compose.onNodeWithTag("navigation-Настройки").performClick()
        compose.onNodeWithTag("settings-submenu")
            .performScrollToNode(hasTestTag("settings-submenu-links"))
        compose.onNodeWithTag("settings-submenu-links").performClick()
        compose.onNodeWithTag("account-link-telegram").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("account-link-donate").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("account-link-web").performScrollTo().assertIsDisplayed()
    }

    @Test fun settingsExposeWebsiteHabitControlsAsSeparateCards() {
        compose.onNodeWithTag("navigation-Настройки").performClick()
        compose.onNodeWithTag("settings-submenu-habits").performClick()
        compose.onNodeWithTag("habit-tracking-settings").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("habit-notification-settings").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("habit-feedback-settings").performScrollTo().assertIsDisplayed()
    }

    @Test fun weekStartSettingAppearsOnlyForGregorianDisplayAndPersists() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        val preferences = ru.genesis.calendar.data.LocalPreferences(app, app.workspaceScope)
        val initial = runBlocking { preferences.values.first() }
        try {
            runBlocking { preferences.set("display", "sacred") }
            compose.onNodeWithTag("navigation-Настройки").performClick()
            compose.onNodeWithTag("gregorian-week-start-setting").assertDoesNotExist()
            runBlocking { preferences.set("display", "profane") }
            compose.waitUntil(5_000) {
                compose.onAllNodesWithTag("gregorian-week-start-setting").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("gregorian-week-start-setting").performScrollTo().assertIsDisplayed()
            compose.onNodeWithTag("week-start-monday").performClick()
            compose.waitUntil(5_000) { !runBlocking { preferences.values.first().weekStartsOnSunday } }
            compose.onNodeWithTag("week-start-monday").assertIsSelected()
        } finally {
            runBlocking {
                preferences.set("display", initial.display.wireValue)
                preferences.set("weekStart", if (initial.weekStartsOnSunday) "sunday" else "monday")
            }
        }
    }

    @Test fun detailsOnlyContainSacredKnowledgeInSacredMode() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        val preferences = ru.genesis.calendar.data.LocalPreferences(app, app.workspaceScope)
        val initial = runBlocking { preferences.values.first().display }
        try {
            runBlocking { preferences.set("display", "sacred") }
            compose.onNodeWithTag("navigation-Сегодня").performClick()
            compose.scrollToTodayNode(hasTestTag("today-day-details-toggle"))
            compose.onNodeWithTag("today-day-details-toggle").performClick()
            compose.scrollToTodayNode(hasTestTag("sacred-calendar-card"))
            compose.onAllNodesWithTag("sacred-calendar-card").assertCountEquals(1)
            compose.onAllNodesWithTag("gregorian-calendar-card").assertCountEquals(0)
            compose.onAllNodesWithTag("lunar-calendar-card").assertCountEquals(0)
        } finally { runBlocking { preferences.set("display", initial.wireValue) } }
    }

    @Test fun settingsLanguageSwitchesWithoutLeavingWorkspace() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        val preferences = ru.genesis.calendar.data.LocalPreferences(app, app.workspaceScope)
        val initial = runBlocking { preferences.values.first().language }
        try {
            runBlocking { preferences.set("language", "ru") }
            compose.waitUntil(5_000) { compose.onAllNodesWithTag("navigation-Настройки").fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithTag("navigation-Настройки").performClick()
            compose.onNodeWithTag("appearance-language-toggle").performScrollTo().performClick()
            compose.onNodeWithTag("language-en").performScrollTo().performClick()
            compose.waitUntil(5_000) { compose.onAllNodesWithText("Settings - Appearance").fetchSemanticsNodes().isNotEmpty() }
            compose.onAllNodesWithText("Settings - Appearance").onFirst().assertExists()
            compose.onNodeWithTag("language-ru").performScrollTo().performClick()
            compose.waitUntil(5_000) { compose.onAllNodesWithText("Настройки - Оформление").fetchSemanticsNodes().isNotEmpty() }
            compose.onAllNodesWithText("Настройки - Оформление").onFirst().assertExists()
        } finally {
            runBlocking { preferences.set("language", initial) }
        }
    }
}
