package ru.genesis.calendar

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.key
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.text.TextLayoutResult
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import java.time.LocalDate
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.json.JSONArray
import org.json.JSONObject
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
import ru.genesis.calendar.ui.LocalGenesisLanguage
import ru.genesis.calendar.ui.GenesisTypography
import ru.genesis.calendar.ui.GenesisShapes

class CalendarModeHeaderTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()

    @Test fun monthAndYearNameplatesAreIndependentAndScrollAwayAndBackInEveryCalendarAndTheme() {
        var mode by mutableStateOf(CalendarMode.PROFANE)
        var night by mutableStateOf(false)
        var epoch by mutableIntStateOf(0)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val checks = JSONArray()
        val completed = mutableListOf<String>()
        var checkpoint = "setup"
        var failure: Throwable? = null
        compose.setContent { key(epoch) {
            val density = Density(compose.activity.resources.displayMetrics.widthPixels / 360f, 1.3f)
            val configuration = android.content.res.Configuration(LocalConfiguration.current).apply {
                screenWidthDp = 360
                screenHeightDp = (compose.activity.resources.displayMetrics.heightPixels / density.density).toInt()
                fontScale = 1.3f
            }
            CompositionLocalProvider(LocalDensity provides density, LocalConfiguration provides configuration,
                LocalEveningTheme provides night, LocalGenesisLanguage provides "ru") {
                MaterialTheme(colorScheme = if (night) evening else standart,
                    typography = GenesisTypography, shapes = GenesisShapes) {
                    Surface(Modifier.fillMaxSize()) {
                        CalendarScreen(LocalDate.of(2026, 10, 4), mode, {}, experimental = true)
                    }
                }
            }
        } }
        fun capture(name: String) = captureNativeWindow(File(context.getExternalFilesDir(null), "calendar-flow-360-font130-$name.png"))
        fun assertIndependent(period: String, navigationTag: String, contentTag: String): JSONObject {
            compose.waitForIdle()
            val plate = compose.onNodeWithTag("calendar-flow-nameplate").assertIsDisplayed()
            plate.assert(hasAnyAncestor(hasTestTag(if (period == "month") "calendar-month-scroll" else "calendar-year")))
            compose.onNodeWithTag("calendar-flow-name").assertTextEquals(mobileCalendarCopy("ru").calendarName(mode))
            compose.onNodeWithTag("calendar-flow-icon").assertIsDisplayed()
                .assert(hasAnyAncestor(hasTestTag("calendar-flow-nameplate")))
            compose.onAllNodes(hasTestTag("calendar-mode-icon-${mode.wireValue}") and
                hasAnyAncestor(hasTestTag("calendar-flow-nameplate")), useUnmergedTree = true).assertCountEquals(0)
            val navigation = compose.onNodeWithTag(navigationTag).assertIsDisplayed()
            navigation.assert(hasAnyAncestor(hasTestTag("calendar-flow-nameplate")).not())
            plate.assert(hasAnyAncestor(hasTestTag(navigationTag)).not())
            compose.onNodeWithTag(contentTag).assert(hasAnyAncestor(hasTestTag("calendar-flow-nameplate")).not())
            compose.onNodeWithTag(contentTag).assert(hasAnyAncestor(hasTestTag(navigationTag)).not())
            val plateBounds = plate.fetchSemanticsNode().boundsInRoot
            val navigationBounds = navigation.fetchSemanticsNode().boundsInRoot
            assertTrue("$checkpoint: identity must precede the separate period controls", plateBounds.bottom <= navigationBounds.top)
            val layouts = mutableListOf<TextLayoutResult>()
            compose.onNodeWithTag("calendar-flow-name").performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
            val text = layouts.single()
            assertEquals("$checkpoint: compact name stays on one line", 1, text.lineCount)
            assertFalse("$checkpoint: complete name must fit", text.didOverflowWidth || text.didOverflowHeight ||
                text.multiParagraph.didExceedMaxLines || text.isLineEllipsized(0))
            return JSONObject().put("checkpoint", checkpoint).put("calendar", mode.wireValue).put("dark", night)
                .put("plateTopPx", plateBounds.top).put("plateBottomPx", plateBounds.bottom)
                .put("navigationTopPx", navigationBounds.top).put("nameFontSize", text.layoutInput.style.fontSize.toString())
        }
        try {
            for (dark in listOf(false, true)) for (choice in CalendarMode.entries) {
                val key = "${if (dark) "dark" else "light"}-${choice.wireValue}"
                compose.runOnIdle { night = dark; mode = choice; epoch++ }
                checkpoint = "$key/month"
                val monthPanel = if (choice == CalendarMode.SACRED) "sacred-month-pyatas" else "calendar-month-panel-${choice.wireValue}"
                val monthProof = assertIndependent("month", "calendar-month-navigation-card", monthPanel)
                capture("$key-month-top")
                compose.onNodeWithTag("calendar-selected-day").performScrollTo()
                compose.onNodeWithTag("calendar-flow-nameplate").assertIsNotDisplayed()
                capture("$key-month-away")
                compose.onNodeWithTag("calendar-flow-nameplate").performScrollTo().assertIsDisplayed()
                assertEquals("$checkpoint: scroll back restores month start", 0f,
                    compose.onNodeWithTag("calendar-month-scroll").fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange].value(), 1f)
                checks.put(monthProof.put("scrolledAway", true).put("restoredStart", true))
                compose.onNodeWithTag("submenu-year").performClick()
                checkpoint = "$key/year"
                val firstMonth = when (choice) {
                    CalendarMode.PROFANE -> "calendar-year-month-2026-01-01"
                    CalendarMode.SACRED -> "sacred-year-month-0"
                    CalendarMode.LUNAR -> "lunar-year-month-1"
                }
                val yearProof = assertIndependent("year", "calendar-year-navigation-card", firstMonth)
                capture("$key-year-top")
                val lastMonth = when (choice) {
                    CalendarMode.PROFANE -> "calendar-year-month-2026-12-01"
                    CalendarMode.SACRED -> "sacred-year-month-12"
                    CalendarMode.LUNAR -> "lunar-year-month-12"
                }
                compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag(lastMonth))
                compose.onNodeWithTag("calendar-flow-nameplate").assertIsNotDisplayed()
                capture("$key-year-away")
                compose.onNodeWithTag("calendar-year").performScrollToIndex(0)
                compose.onNodeWithTag("calendar-flow-nameplate").assertIsDisplayed()
                assertEquals("$checkpoint: scroll back restores year start", 0f,
                    compose.onNodeWithTag("calendar-year").fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange].value(), 1f)
                checks.put(yearProof.put("scrolledAway", true).put("restoredStart", true))
                completed += key
            }
            assertEquals(6, completed.size)
            assertEquals(12, checks.length())
        } catch (cause: Throwable) { failure = cause; throw cause }
        finally {
            File(context.getExternalFilesDir(null), "calendar-flow-360-font130-proof.json").writeText(JSONObject()
                .put("widthDp", 360).put("fontScale", 1.3).put("completed", JSONArray(completed)).put("checks", checks)
                .put("lastCheckpoint", checkpoint).put("failure", failure?.stackTraceToString() ?: JSONObject.NULL).toString(2))
        }
    }

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
            compose.onNodeWithTag("calendar-month").assertExists()
            compose.onNodeWithTag("calendar-flow-nameplate").assertIsDisplayed()
            assertEquals(monthStart, selected)
            compose.onNodeWithTag("calendar-day-$monthStart").assertExists()
        }
    }

    @Test fun monthInformationIsVisibleWithoutASecondCalendarSelector() {
        compose.setContent {
            MaterialTheme(colorScheme = standart) {
                Surface(Modifier.fillMaxSize()) {
                    CalendarScreen(LocalDate.of(2026, 9, 30), CalendarMode.PROFANE,
                        onSelect = {}, experimental = true)
                }
            }
        }
        compose.onNodeWithTag("calendar-flow-nameplate").assertIsDisplayed()
        compose.onNodeWithTag("calendar-mode-icon-profane", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("calendar-month-description").assertExists()
        compose.onNodeWithTag("calendar-month-info-toggle").assertDoesNotExist()
        compose.onNodeWithTag("submenu-year").performClick()
        compose.onNodeWithTag("calendar-year-panel").assertExists()
        compose.onNodeWithTag("calendar-flow-nameplate").assertIsDisplayed()
        compose.onNodeWithTag("calendar-year-solar-toggle").performScrollTo().performClick()
        compose.onNodeWithTag("calendar-year-solar-points").assertExists()
        val solarTiles = compose.onAllNodes(SemanticsMatcher("solar point tiles") { node ->
            runCatching { node.config[SemanticsProperties.TestTag] }.getOrNull()?.startsWith("solar-point-") == true
        }).fetchSemanticsNodes()
        assertEquals(4, solarTiles.size)
        assertTrue(solarTiles.map { it.boundsInRoot.width }.max() - solarTiles.map { it.boundsInRoot.width }.min() < 2f)
        compose.onNodeWithTag("calendar-year-navigation").performTouchInput { swipeLeft() }
        compose.waitUntil(5_000) { runCatching {
            compose.onNodeWithTag("calendar-year-period").assertTextContains("2027")
        }.isSuccess }
        compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag("gregorian-season-summer"))
        compose.onNodeWithTag("calendar-view-switch").assertIsDisplayed()
        compose.onNodeWithTag("calendar-flow-nameplate").assertIsNotDisplayed()
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
        compose.onNodeWithTag("calendar-flow-nameplate").assertIsDisplayed()
        assertTrue(device.takeScreenshot(File(context.getExternalFilesDir(null), "calendar-month-evening.png")))
        compose.onNodeWithText("Год").performClick()
        compose.waitForIdle()
        val yearWidth = compose.onNodeWithTag("calendar-year-panel")
            .fetchSemanticsNode().boundsInRoot.width
        compose.onNodeWithTag("calendar-flow-nameplate").assertIsDisplayed()
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
