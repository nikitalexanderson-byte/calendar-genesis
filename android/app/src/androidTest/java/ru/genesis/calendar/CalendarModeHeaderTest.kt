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
        compose.onNodeWithTag("calendar-mode-icon-profane", useUnmergedTree = true).assertExists()
        compose.waitForIdle()
        val monthWidth = compose.onNodeWithTag("calendar-month-panel-profane")
            .fetchSemanticsNode().boundsInRoot.width
        val monthHeaderWidth = compose.onNodeWithTag("genesis-page-header")
            .fetchSemanticsNode().boundsInRoot.width
        assertTrue("month header=$monthHeaderWidth panel=$monthWidth",
            kotlin.math.abs(monthHeaderWidth - monthWidth) < 2f)
        assertTrue(device.takeScreenshot(File(context.getExternalFilesDir(null), "calendar-month-before-click.png")))
        compose.onNodeWithTag("genesis-page-header").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("calendar-mode-icon-sacred", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() }
        assertTrue(device.takeScreenshot(File(context.getExternalFilesDir(null), "calendar-month-after-click.png")))
        compose.onNodeWithTag("genesis-page-header").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("calendar-mode-icon-lunar", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("genesis-page-header").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("calendar-mode-icon-profane", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() }
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
        assertTrue(solarTiles.map { it.size.height }.max() -
            solarTiles.map { it.size.height }.min() < 2)
        compose.onNodeWithTag("genesis-page-header").assertExists()
        val yearWidth = compose.onNodeWithTag("calendar-year-panel")
            .fetchSemanticsNode().boundsInRoot.width
        val yearHeaderWidth = compose.onNodeWithTag("genesis-page-header")
            .fetchSemanticsNode().boundsInRoot.width
        assertTrue("year header=$yearHeaderWidth panel=$yearWidth",
            kotlin.math.abs(yearHeaderWidth - yearWidth) < 2f)
        if (compose.activity.resources.configuration.screenWidthDp < 840) {
            assertTrue("year panel=$yearWidth month panel=$monthWidth",
                kotlin.math.abs(yearWidth - monthWidth) < 2f)
        }
        assertTrue(device.takeScreenshot(File(context.getExternalFilesDir(null), "calendar-year-after.png")))
        compose.onNodeWithTag("genesis-page-header").performTouchInput { swipeLeft() }
        compose.onNodeWithTag("calendar-year-period").assertTextContains("2026")
        compose.onNodeWithTag("calendar-year-navigation").performTouchInput { swipeLeft() }
        compose.waitUntil(5_000) {
            runCatching { compose.onNodeWithTag("calendar-year-period").assertTextContains("2027") }.isSuccess
        }
        compose.onNodeWithTag("calendar-mode-icon-profane", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("gregorian-season-summer", useUnmergedTree = true).performScrollTo()
        compose.onNodeWithTag("gregorian-season-summer", useUnmergedTree = true).assertIsDisplayed()
        compose.onNodeWithTag("genesis-page-header").assert(!hasAnyAncestor(hasTestTag("calendar-year-panel")))
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
        if (compose.activity.resources.configuration.screenWidthDp < 840) {
            assertTrue("evening year panel=$yearWidth month panel=$monthWidth",
                kotlin.math.abs(yearWidth - monthWidth) < 2f)
        }
        assertTrue(device.takeScreenshot(File(context.getExternalFilesDir(null), "calendar-year-evening.png")))
    }

    @Test fun springYearSuggestionCanBeDismissed() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val preferences = context.getSharedPreferences("genesis.calendar-suggestions", android.content.Context.MODE_PRIVATE)
        preferences.edit().remove("spring-year-dismissed").commit()
        compose.setContent { MaterialTheme(colorScheme = standart) {
            CalendarScreen(LocalDate.of(2026, 9, 30), CalendarMode.PROFANE,
                onSelect = {}, experimental = true)
        } }
        compose.onNodeWithText("Год").performClick()
        compose.onNodeWithTag("spring-year-suggestion").assertExists()
        compose.onNodeWithTag("spring-year-dismiss").performClick()
        compose.onNodeWithTag("spring-year-suggestion").assertDoesNotExist()
        assertTrue(preferences.getBoolean("spring-year-dismissed", false))
    }

    @Test fun springYearSuggestionSwitchesDisplayToMarch() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        context.getSharedPreferences("genesis.calendar-suggestions", android.content.Context.MODE_PRIVATE)
            .edit().remove("spring-year-dismissed").commit()
        var startsInMarch by mutableStateOf(false)
        compose.setContent { MaterialTheme(colorScheme = standart) {
            CalendarScreen(LocalDate.of(2026, 9, 30), CalendarMode.PROFANE,
                onSelect = {}, experimental = true,
                gregorianYearStartsInMarch = startsInMarch,
                onStartGregorianYearInMarch = { startsInMarch = true })
        } }
        compose.onNodeWithText("Год").performClick()
        compose.onNodeWithTag("spring-year-switch").performClick()
        compose.onNodeWithTag("spring-year-suggestion").assertDoesNotExist()
        compose.onNodeWithTag("calendar-year-period").assertTextContains("2026–2027")
    }
}
