package ru.genesis.calendar

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Density
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import java.time.LocalDate
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.data.LocalTask
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.ui.CalendarScreen
import ru.genesis.calendar.ui.LocalGenesisLanguage
import ru.genesis.calendar.ui.StoicheionScreen
import ru.genesis.calendar.ui.standart

/** Checks the installed native layout and touch bounds, with no account or server data. */
class CalendarMobileLayoutTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()
    private val requestedWidth = InstrumentationRegistry.getArguments().getString("genesisWidth")?.toIntOrNull()
    private fun viewportModifier() = Modifier.safeDrawingPadding().heightIn(max = 760.dp).then(
        requestedWidth?.let { Modifier.width(it.dp) } ?: Modifier)
    private fun setViewportContent(content: @Composable () -> Unit) {
        compose.setContent {
            val originalDensity = LocalDensity.current
            val viewportDensity = requestedWidth?.let {
                Density(compose.activity.resources.displayMetrics.widthPixels.toFloat() / it, originalDensity.fontScale)
            } ?: originalDensity
            CompositionLocalProvider(LocalDensity provides viewportDensity) { content() }
        }
    }

    private fun capture(name: String) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        compose.waitForIdle()
        val device = UiDevice.getInstance(instrumentation)
        device.waitForIdle(2_000)
        assertTrue(device.takeScreenshot(
            File(instrumentation.targetContext.getExternalFilesDir(null),
                "2.3.3-${requestedWidth?.let { "${it}dp-" } ?: ""}$name.png")))
    }

    @Test fun viewSwitchPrecedesScrollingMonthAndYearHeadingsInEveryCalendar() {
        var mode by mutableStateOf(CalendarMode.SACRED)
        val date = LocalDate.of(2026, 9, 28)
        setViewportContent {
            MaterialTheme(colorScheme = standart) {
                Surface(Modifier.fillMaxSize(), color = standart.background) {
                    Column(viewportModifier()) {
                        CalendarScreen(date, mode, onSelect = {}, experimental = true)
                    }
                }
            }
        }
        CalendarMode.entries.forEach { nextMode ->
            compose.runOnIdle { mode = nextMode }
            compose.onNodeWithText("Месяц").performClick()
            compose.onNodeWithText("Календарь - месяц").assertIsDisplayed()
            val switch = compose.onNodeWithTag("calendar-view-switch").fetchSemanticsNode().boundsInRoot
            val header = compose.onNodeWithTag("genesis-page-header").fetchSemanticsNode().boundsInRoot
            assertTrue("View controls must precede the heading", switch.bottom <= header.top)
            capture("${nextMode.name.lowercase()}-month-top")
            compose.onNodeWithTag("calendar-selected-day").performScrollTo()
            if ((requestedWidth ?: 360) < 768) {
                compose.onNodeWithText("Календарь - месяц").assertIsNotDisplayed()
            }
            compose.onNodeWithTag("calendar-view-switch").assertIsDisplayed()
            capture("${nextMode.name.lowercase()}-month-scrolled")
            compose.onNodeWithText("Год").performClick()
            compose.onNodeWithText("Календарь - год").assertIsDisplayed()
            val firstTag = when (nextMode) {
                CalendarMode.SACRED -> "sacred-year-month-0"
                CalendarMode.LUNAR -> "lunar-year-month-1"
                CalendarMode.PROFANE -> "calendar-year-month-2026-01-01"
            }
            compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag(firstTag))
            if (nextMode == CalendarMode.SACRED) compose.waitUntil(10_000) {
                compose.onAllNodesWithContentDescription("Иллюстрация месяца АРЕЙОС").fetchSemanticsNodes().isNotEmpty()
            }
            capture("${nextMode.name.lowercase()}-year-months")
            val lastTag = when (nextMode) {
                CalendarMode.SACRED -> "sacred-year-month-12"
                CalendarMode.LUNAR -> "lunar-year-month-12"
                CalendarMode.PROFANE -> "calendar-year-month-2026-11-01"
            }
            compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag(lastTag))
            if ((requestedWidth ?: 360) < 768) {
                compose.onNodeWithTag("genesis-page-header").assertDoesNotExist()
            }
            compose.onNodeWithTag("calendar-view-switch").assertIsDisplayed()
            compose.onNodeWithTag(lastTag).performClick()
            compose.onNodeWithText("Календарь - месяц").assertIsDisplayed()
        }
    }

    @Test fun gregorianYearShowsSeasonsDayAndTaskCountsWithoutDuplicateHeadings() {
        setViewportContent {
            MaterialTheme(colorScheme = standart) {
                Surface(Modifier.fillMaxSize(), color = standart.background) {
                    Column(viewportModifier()) {
                        CalendarScreen(LocalDate.of(2028, 2, 14), CalendarMode.PROFANE, onSelect = {}, experimental = true)
                    }
                }
            }
        }
        compose.onNodeWithText("Год").performClick()
        compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag("calendar-year-month-2028-02-01"))
        compose.onNodeWithTag("gregorian-year-number-2", useUnmergedTree = true).assert(hasText("2"))
        compose.onNodeWithTag("gregorian-year-start-2", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("gregorian-year-end-2", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithText("ГРИГОРИАНСКИЙ МЕСЯЦ 2").assertDoesNotExist()
        compose.onNodeWithTag("calendar-year-task-count-2", useUnmergedTree = true).assert(hasText("0 задач"))
        compose.onNodeWithTag("gregorian-season-winter").assertExists()
        compose.onNodeWithTag("calendar-year-days-2", useUnmergedTree = true).assert(hasText("29 дней"))
        capture("gregorian-leap-year")
        compose.onNodeWithTag("calendar-year-month-2028-02-01").performClick()
        compose.onNodeWithTag("calendar-day-2028-02-29").performScrollTo().assertIsEnabled()
    }

    @Test fun choosingADayStopsAtItsFirstIllustratedBlockInEachCalendar() {
        var mode by mutableStateOf(CalendarMode.PROFANE)
        val date = LocalDate.of(2026, 9, 28)
        setViewportContent {
            MaterialTheme(colorScheme = standart) {
                Surface(Modifier.fillMaxSize(), color = standart.background) {
                    Column(viewportModifier()) { CalendarScreen(date, mode, onSelect = {}, experimental = true) }
                }
            }
        }
        CalendarMode.entries.forEach { next ->
            compose.runOnIdle { mode = next }
            compose.onNodeWithTag("calendar-day-2026-09-26").performScrollTo().performClick()
            compose.waitUntil(10_000) {
                val card = compose.onNodeWithTag("calendar-selected-day").fetchSemanticsNode().boundsInRoot
                val viewport = compose.onNodeWithTag("calendar-month").fetchSemanticsNode().boundsInRoot
                card.top >= viewport.top - 3 && card.top <= viewport.top + 12
            }
            capture("${next.name.lowercase()}-selected-day-start")
        }
    }

    @Test fun gregorianBadgeHasLargerVisibleDiscAndFullFingerTarget() {
        val date = LocalDate.of(2026, 9, 26)
        setViewportContent {
            MaterialTheme(colorScheme = standart) {
                Surface(Modifier.fillMaxSize(), color = standart.background) {
                    Column(viewportModifier()) {
                        CalendarScreen(date, CalendarMode.PROFANE, onSelect = {}, experimental = true,
                            tasks = listOf(LocalTask(id = "finger-target", title = "Задача для проверки", date = date.toString())))
                    }
                }
            }
        }
        val badge = compose.onNodeWithTag("calendar-task-count-$date").performScrollTo()
        badge.assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp)
        compose.onNodeWithTag("calendar-task-count-disc-$date", useUnmergedTree = true)
            .assertWidthIsAtLeast(28.dp)
        capture("gregorian-task-target")
        badge.performClick()
        compose.onNodeWithTag("calendar-task-list-dialog").assertIsDisplayed()
        capture("day-task-actions")
    }

    @Test fun stoicheionHeaderScrollsWithOriginalLetterCards() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        setViewportContent {
            MaterialTheme(colorScheme = standart) {
                Surface(Modifier.fillMaxSize(), color = standart.background) {
                    Column(viewportModifier()) { StoicheionScreen(app, divinationDisabled = true) }
                }
            }
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("stoicheion-letter-alpha").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("genesis-page-header").assertIsDisplayed()
        capture("stoicheion-top")
        compose.onNodeWithTag("stoicheion-grid").performScrollToNode(hasTestTag("stoicheion-letter-omega"))
        compose.onNodeWithTag("genesis-page-header").assertDoesNotExist()
        compose.onNodeWithTag("stoicheion-letter-omega").assertIsDisplayed()
        capture("stoicheion-scrolled")
    }

    @Test fun englishYearHeadingAndGregorianDatesStayLocalized() {
        setViewportContent {
            CompositionLocalProvider(LocalGenesisLanguage provides "en") {
                MaterialTheme(colorScheme = standart) {
                    Surface(Modifier.fillMaxSize(), color = standart.background) {
                        Column(viewportModifier()) {
                            CalendarScreen(LocalDate.of(2026, 9, 28), CalendarMode.PROFANE, onSelect = {})
                        }
                    }
                }
            }
        }
        compose.onNodeWithText("Calendar - month").assertIsDisplayed()
        compose.onNodeWithText("Year").performClick()
        compose.onNodeWithText("Calendar - year").assertIsDisplayed()
        compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag("calendar-year-month-2026-01-01"))
        compose.onNodeWithTag("gregorian-year-start-1", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("gregorian-year-end-1", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithText("Winter").assertExists()
        capture("gregorian-english-year")
    }
}
