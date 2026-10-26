package ru.genesis.calendar

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.key
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.ui.CalendarScreen
import ru.genesis.calendar.ui.CalendarModeSwitcher
import ru.genesis.calendar.ui.mobileCalendarCopy
import ru.genesis.calendar.ui.calendarName
import ru.genesis.calendar.ui.standart
import ru.genesis.calendar.ui.evening
import ru.genesis.calendar.ui.LocalEveningTheme

class CalendarModeHeaderTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()

    @Test fun calendarModeChangesBeforeDecorativeAnimationAndSmallIconKeeps48dpTarget() {
        var mode by mutableStateOf(CalendarMode.PROFANE)
        compose.setContent { MaterialTheme(colorScheme = standart) {
            CalendarModeSwitcher(mode, { mode = when (mode) {
                CalendarMode.PROFANE -> CalendarMode.SACRED
                CalendarMode.SACRED -> CalendarMode.LUNAR
                CalendarMode.LUNAR -> CalendarMode.PROFANE
            } }, size = 42.dp)
        } }
        val target = compose.onNodeWithTag("calendar-mode-icon-profane").fetchSemanticsNode()
        val density = target.layoutInfo.density.density
        assertTrue(target.boundsInRoot.width + 1 >= 48 * density)
        assertTrue(target.boundsInRoot.height + 1 >= 48 * density)
        compose.mainClock.autoAdvance = false
        try {
            compose.onNodeWithTag("calendar-mode-icon-profane").performClick()
            compose.mainClock.advanceTimeByFrame()
            compose.runOnIdle { assertEquals(CalendarMode.SACRED, mode) }
        } finally { compose.mainClock.autoAdvance = true }
    }

    @Test fun selectingMonthFromYearSurvivesScreenRecreationInEveryCalendar() {
        var mode by mutableStateOf(CalendarMode.PROFANE)
        var selected by mutableStateOf(LocalDate.of(2026, 10, 4))
        compose.setContent {
            key(mode, selected) {
                MaterialTheme(colorScheme = standart) {
                    CalendarScreen(selected, mode, onSelect = { selected = it }, experimental = true)
                }
            }
        }
        val sacredYear = GenesisCalendar().sacredDate(LocalDate.of(2026, 10, 4)).sacredYear
        val cases = listOf(
            Triple(CalendarMode.PROFANE, "calendar-year-month-2026-01-01", LocalDate.of(2026, 1, 1)),
            Triple(CalendarMode.SACRED, "sacred-year-month-0", GenesisCalendar().gregorianDate(sacredYear, 0, 1)),
            Triple(CalendarMode.LUNAR, "lunar-year-month-1", GenesisCalendar().lunarYear(sacredYear).startDate),
        )
        cases.forEach { (calendarMode, monthTag, monthStart) ->
            compose.runOnIdle { mode = calendarMode; selected = LocalDate.of(2026, 10, 4) }
            compose.onNodeWithText("Год").performClick()
            compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag(monthTag))
            compose.onNodeWithTag(monthTag).performClick()
            compose.onNode(hasText(mobileCalendarCopy("ru").calendarName(calendarMode)) and
                hasAnyAncestor(hasTestTag("genesis-page-header"))).assertExists()
            assertEquals(monthStart, selected)
            compose.onNodeWithTag("calendar-day-$monthStart").assertExists()
        }
    }

    @Test fun monthAndYearIconsCycleModesAndYearHeaderScrollsWithContent() {
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
        compose.onNodeWithTag("calendar-year-solar-points").assertDoesNotExist()
        compose.onNodeWithTag("calendar-year-solar-toggle").performScrollTo().performClick()
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
        compose.onNodeWithTag("calendar-year-navigation").performTouchInput { swipeLeft() }
        compose.waitUntil(5_000) {
            runCatching { compose.onNodeWithTag("calendar-year-period").assertTextContains("2027") }.isSuccess
        }
        compose.onNodeWithTag("calendar-mode-icon-profane", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag("gregorian-season-summer"))
        compose.onNodeWithTag("gregorian-season-summer", useUnmergedTree = true).assertIsDisplayed()
        compose.onNodeWithTag("genesis-page-header").assertDoesNotExist()
        assertTrue(device.takeScreenshot(File(context.getExternalFilesDir(null), "calendar-year-header-scrolled-away.png")))
        compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag("genesis-page-header"))
        compose.onNodeWithTag("genesis-page-header").assertIsDisplayed()
        compose.onNodeWithTag("genesis-page-header").performClick()
        compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag("sacred-season-summer"))
        compose.onNodeWithTag("genesis-page-header").assertDoesNotExist()
        compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag("genesis-page-header"))
        compose.onNodeWithTag("genesis-page-header").performClick()
        compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag("lunar-year-month-5"))
        compose.onNodeWithTag("genesis-page-header").assertDoesNotExist()
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
        for (season in listOf("winter", "spring", "summer", "autumn")) {
            compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag("gregorian-season-$season"))
            compose.waitForIdle()
            assertTrue(device.takeScreenshot(File(context.getExternalFilesDir(null), "calendar-year-evening-$season.png")))
        }
    }

    @Test fun yearDescriptionEndsWithoutLargeBlankSpace() {
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
        compose.onNodeWithText("Год").performClick()
        val year = compose.onNodeWithTag("calendar-year")
        year.performScrollToNode(hasTestTag("calendar-year-description-profane"))
        year.performTouchInput { swipeUp() }
        compose.waitForIdle()
        val descriptionBottom = compose.onNodeWithTag("calendar-year-description-profane")
            .fetchSemanticsNode().boundsInRoot.bottom
        val viewportBottom = year.fetchSemanticsNode().boundsInRoot.bottom
        val gapDp = (viewportBottom - descriptionBottom) / compose.activity.resources.displayMetrics.density
        assertTrue("year trailing space=$gapDp dp", gapDp in 0f..32f)
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        assertTrue(device.takeScreenshot(File(context.getExternalFilesDir(null), "calendar-year-bottom-251.png")))
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
        compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag("spring-year-suggestion"))
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
        compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag("spring-year-suggestion"))
        compose.onNodeWithTag("spring-year-switch").performClick()
        compose.onNodeWithTag("spring-year-suggestion").assertDoesNotExist()
        compose.onNodeWithTag("calendar-year-period").assertTextContains("2026–2027")
    }
}
