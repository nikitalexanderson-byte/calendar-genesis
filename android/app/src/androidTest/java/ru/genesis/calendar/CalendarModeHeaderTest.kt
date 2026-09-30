package ru.genesis.calendar

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import java.time.LocalDate
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.ui.CalendarScreen
import ru.genesis.calendar.ui.standart
import ru.genesis.calendar.ui.evening
import ru.genesis.calendar.ui.LocalEveningTheme

class CalendarModeHeaderTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()

    @Test fun monthAndYearIconsCycleModesAndYearHeaderStaysOutsideSwipe() {
        var mode by mutableStateOf(CalendarMode.PROFANE)
        compose.setContent {
            MaterialTheme(colorScheme = standart) {
                Surface(Modifier.fillMaxSize()) {
                    CalendarScreen(LocalDate.of(2026, 9, 30), mode, onSelect = {},
                        onModeChange = { mode = it }, experimental = true)
                }
            }
        }
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        compose.onNodeWithTag("calendar-mode-icon-profane").assertExists()
        compose.waitForIdle()
        val monthWidth = compose.onNodeWithTag("calendar-month-panel-profane")
            .fetchSemanticsNode().boundsInRoot.width
        val monthHeaderWidth = compose.onNodeWithTag("genesis-page-header")
            .fetchSemanticsNode().boundsInRoot.width
        assertTrue("month header=$monthHeaderWidth panel=$monthWidth",
            kotlin.math.abs(monthHeaderWidth - monthWidth) < 2f)
        assertTrue(device.takeScreenshot(File(context.getExternalFilesDir(null), "calendar-month-before-click.png")))
        compose.onNodeWithTag("calendar-mode-icon-profane").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("calendar-mode-icon-sacred").fetchSemanticsNodes().isNotEmpty() }
        assertTrue(device.takeScreenshot(File(context.getExternalFilesDir(null), "calendar-month-after-click.png")))
        compose.onNodeWithTag("calendar-mode-icon-sacred").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("calendar-mode-icon-lunar").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("calendar-mode-icon-lunar").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("calendar-mode-icon-profane").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Год").performClick()
        compose.onNodeWithTag("calendar-year-panel").assertExists()
        compose.waitForIdle()
        compose.onNodeWithTag("calendar-year-solar-points").assertExists()
        val solarTiles = compose.onAllNodes(SemanticsMatcher("solar point tiles") { node ->
            runCatching { node.config[SemanticsProperties.TestTag] }.getOrNull()
                ?.startsWith("solar-point-") == true
        }).fetchSemanticsNodes()
        assertEquals(4, solarTiles.size)
        assertTrue(solarTiles.map { it.boundsInRoot.width }.max() -
            solarTiles.map { it.boundsInRoot.width }.min() < 2f)
        assertTrue(solarTiles.map { it.boundsInRoot.height }.max() -
            solarTiles.map { it.boundsInRoot.height }.min() < 2f)
        compose.onNodeWithTag("genesis-page-header").assertExists()
        val yearWidth = compose.onNodeWithTag("calendar-year-panel")
            .fetchSemanticsNode().boundsInRoot.width
        val yearHeaderWidth = compose.onNodeWithTag("genesis-page-header")
            .fetchSemanticsNode().boundsInRoot.width
        assertTrue("year header=$yearHeaderWidth panel=$yearWidth",
            kotlin.math.abs(yearHeaderWidth - yearWidth) < 2f)
        assertTrue("year panel=$yearWidth month panel=$monthWidth",
            kotlin.math.abs(yearWidth - monthWidth) < 2f)
        assertTrue(device.takeScreenshot(File(context.getExternalFilesDir(null), "calendar-year-after.png")))
        compose.onNodeWithTag("genesis-page-header").performTouchInput { swipeLeft() }
        compose.onNodeWithTag("calendar-year-period").assertTextContains("2026")
        compose.onNodeWithTag("calendar-year-navigation").performTouchInput { swipeLeft() }
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("2027").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag("gregorian-season-summer"))
        compose.onNodeWithTag("genesis-page-header").assertIsNotDisplayed()
    }

    @Test fun monthAndYearKeepTheSameWidthInEveningTheme() {
        compose.setContent {
            MaterialTheme(colorScheme = evening) {
                CompositionLocalProvider(LocalEveningTheme provides true) {
                    Surface(Modifier.fillMaxSize()) {
                        CalendarScreen(LocalDate.of(2026, 9, 30), CalendarMode.PROFANE,
                            onSelect = {}, experimental = true)
                    }
                }
            }
        }
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        compose.waitForIdle()
        val monthWidth = compose.onNodeWithTag("calendar-month-panel-profane")
            .fetchSemanticsNode().boundsInRoot.width
        val monthHeaderWidth = compose.onNodeWithTag("genesis-page-header")
            .fetchSemanticsNode().boundsInRoot.width
        assertTrue("evening month header=$monthHeaderWidth panel=$monthWidth",
            kotlin.math.abs(monthHeaderWidth - monthWidth) < 2f)
        assertTrue(device.takeScreenshot(File(context.getExternalFilesDir(null), "calendar-month-evening.png")))
        compose.onNodeWithText("Год").performClick()
        compose.waitForIdle()
        val yearWidth = compose.onNodeWithTag("calendar-year-panel")
            .fetchSemanticsNode().boundsInRoot.width
        val yearHeaderWidth = compose.onNodeWithTag("genesis-page-header")
            .fetchSemanticsNode().boundsInRoot.width
        assertTrue("evening year header=$yearHeaderWidth panel=$yearWidth",
            kotlin.math.abs(yearHeaderWidth - yearWidth) < 2f)
        assertTrue("evening year panel=$yearWidth month panel=$monthWidth",
            kotlin.math.abs(yearWidth - monthWidth) < 2f)
        assertTrue(device.takeScreenshot(File(context.getExternalFilesDir(null), "calendar-year-evening.png")))
    }
}
