package ru.genesis.calendar

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.ui.HabitsScreen
import ru.genesis.calendar.ui.standart

class HabitsVisualTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()

    @Test fun dailyHabitsLeadAndRankArtStaysInLabeledSection() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.workspaceScope == "internal-validation-v1")
        compose.setContent { MaterialTheme(colorScheme = standart) { HabitsScreen(app, true) } }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("ЕЖЕДНЕВНЫЙ РИТМ").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Обычные привычки").assertExists()
        compose.onNodeWithText("Путь Героя и награды").assertExists()
        compose.onNodeWithContentDescription("Путь героических рангов").assertDoesNotExist()
        assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            .takeScreenshot(File(app.getExternalFilesDir(null), "habits-refined.png")))
    }
}
