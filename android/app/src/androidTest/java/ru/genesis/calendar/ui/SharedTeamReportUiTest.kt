package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.unit.Density
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.PagerTestActivity
import ru.genesis.calendar.auth.*
import ru.genesis.calendar.domain.CalendarMode
import java.io.File
import java.time.LocalDate

private fun teamUiFile(name: String) = JSONObject(InstrumentationRegistry.getInstrumentation().context.assets.open("team-report/$name.json").bufferedReader().use { it.readText() })
private class TeamUiFixture : SharedWorkspaceGateway {
    val seed = teamUiFile("report"); val project = seed.getJSONObject("catalog").getJSONArray("projects").getJSONObject(0)
    var reports = 0; var pages = 0; var reads = 0; var changed = false; var offline = false
    var lastOptions: JSONObject? = null
    private fun check() { if (offline) throw AuthFailure(AuthFailure.Kind.NETWORK); if (changed) throw AuthApiError("REPORT_CHANGED") }
    override suspend fun sharedTeamReport(options: JSONObject): JSONObject {
        check(); reports++; lastOptions = JSONObject(options.toString())
        val value = JSONObject(seed.toString()).put("filter", JSONObject(options.getJSONObject("filter").toString()))
        val period = JSONObject(options.toString()).apply { remove("filter"); remove("cycleStartStatusIds") }; value.put("period", period)
        val from = LocalDate.parse(options.getString("from")); val to = LocalDate.parse(options.getString("to")); var day = from
        val template = seed.getJSONArray("daily").getJSONObject(0); val daily = JSONArray()
        while (day <= to) {
            val row = JSONObject(template.toString()).put("date", day.toString())
            for (kind in listOf("created", "completed", "reopened", "unknown")) row.getJSONObject(kind).put("key", "day:$day:$kind")
            daily.put(row); day = day.plusDays(1)
        }
        return value.put("daily", daily)
    }
    override suspend fun checkSharedTeamReport(token: String): JSONObject { check(); return JSONObject().put("unchanged", true) }
    override suspend fun sharedTeamReportTasks(token: String, metric: String, cursor: String?): JSONObject { check(); pages++; return teamUiFile(if (cursor == null) "first" else "last") }
    override suspend fun sharedSprintSourceTask(projectId: String, taskId: String, archived: Boolean): JSONObject {
        check(); reads++
        val source = importRows(teamUiFile("first").getJSONArray("tasks")).first { it.getString("id") == taskId }
        return JSONObject().put("task", JSONObject(source.toString()).put("priority", 0).put("parentTaskId", JSONObject.NULL)
            .put("checklists", JSONArray()).put("storyPoints", 0).put("estimateHours", JSONObject.NULL))
    }
}

class SharedTeamReportUiTest {
    @get:Rule val compose = createAndroidComposeRule<PagerTestActivity>()
    private var fixture by mutableStateOf<TeamUiFixture?>(null); private var epoch by mutableIntStateOf(0)
    private var dark by mutableStateOf(false); private var language by mutableStateOf("ru")
    private var installed = false; private var density: Density? = null; private var closed = false
    private fun show(value: TeamUiFixture) {
        if (!installed) {
            compose.setContent { fixture?.let { current -> key(epoch) {
                val actualDensity = LocalDensity.current; SideEffect { density = actualDensity }
                CompositionLocalProvider(LocalGenesisUserId provides "team-report-ui-account", LocalGenesisLanguage provides language, LocalEveningTheme provides dark) {
                    MaterialTheme(colorScheme = if (dark) evening else standart) {
                        Surface(Modifier.fillMaxSize().testTag("team-test-window")) {
                            SharedTeamReportScreen(current, current.project.getString("spaceId"), current.project.getString("id"), "Проект команды · осенний план",
                                JSONObject().put("projectIds", JSONArray().put(current.project.getString("id"))), CalendarMode.PROFANE,
                                importRows(current.seed.getJSONObject("catalog").getJSONArray("statuses")), { closed = true }, { closed = true })
                        }
                    }
                }
            } } }; installed = true
        }
        compose.runOnIdle { fixture = value; epoch++; closed = false }
        compose.waitUntil(10000) { runCatching { compose.onNodeWithTag("team-open-all").assertIsEnabled() }.isSuccess }
    }
    private fun click(tag: String) {
        if (compose.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes().isEmpty())
            compose.onNodeWithTag("team-content").performScrollToNode(hasTestTag(tag))
        val node = compose.onNodeWithTag(tag, useUnmergedTree = true)
        if (runCatching { node.assertIsDisplayed() }.isFailure) node.performScrollTo()
        node.assertIsEnabled().performClick(); compose.waitForIdle()
    }
    private fun pane(name: String) {
        if (compose.onAllNodesWithTag("team-section-$name").fetchSemanticsNodes().isEmpty()) click("team-section")
        click("team-section-$name")
    }
    private fun awaitSources() {
        compose.waitUntil(10000) { compose.onAllNodesWithTag("team-source-count").fetchSemanticsNodes().isNotEmpty() || compose.onAllNodesWithTag("team-error").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("team-error").assertDoesNotExist()
    }
    @Test fun fullSourcePagesOpenARecheckedTaskAndSystemBackReturnsThroughTheFlow() {
        val f = TeamUiFixture(); show(f); click("team-open-all")
        awaitSources()
        compose.onNodeWithTag("team-source-count").assertTextEquals("100 / 121"); click("team-sources-more")
        compose.onNodeWithTag("team-content").performScrollToIndex(0)
        compose.waitUntil(10000) { runCatching { compose.onNodeWithTag("team-source-count").assertTextEquals("121 / 121") }.isSuccess }
        compose.onNodeWithTag("team-source-count").assertTextEquals("121 / 121")
        val id = teamUiFile("first").getJSONArray("tasks").getJSONObject(0).getString("id"); click("team-source-$id")
        compose.waitUntil(10000) { compose.onAllNodesWithTag("team-task").fetchSemanticsNodes().isNotEmpty() }; assertEquals(1, f.reads)
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()); device.pressBack(); compose.waitForIdle()
        compose.onNodeWithTag("team-source-count").assertExists(); device.pressBack(); compose.waitForIdle()
        compose.onNodeWithTag("team-open-all").assertExists(); device.pressBack(); compose.waitForIdle(); assertTrue(closed)
    }
    @Test fun changingPeriodOrTimeZoneKeepsConditionsAndRemovesOldTaskLinks() {
        val f = TeamUiFixture(); show(f); pane("conditions")
        compose.onNodeWithTag("team-time-zone").performScrollTo().performTextReplacement("America/New_York")
        pane("summary"); compose.onNodeWithTag("team-open-all").assertDoesNotExist()
        pane("conditions"); compose.onNodeWithTag("team-time-zone").assertTextContains("America/New_York")
        click("team-apply"); pane("summary"); compose.onNodeWithTag("team-open-all").assertExists(); assertEquals(2, f.reports)
        assertEquals("America/New_York", f.lastOptions!!.getJSONObject("calendarContext").getString("timeZone"))
    }
    @Test fun aChangedReportCannotOpenAnOldTaskAndOfflineClearsResults() {
        val f = TeamUiFixture(); show(f); click("team-open-all")
        awaitSources()
        compose.runOnIdle { f.changed = true }
        val id = teamUiFile("first").getJSONArray("tasks").getJSONObject(0).getString("id"); click("team-source-$id")
        compose.onNodeWithTag("team-error").assertExists(); compose.onNodeWithTag("team-source-count").assertDoesNotExist(); assertEquals(0, f.reads)
        compose.runOnIdle { f.changed = false; f.offline = true }; click("team-refresh")
        compose.onNodeWithTag("team-error").assertTextEquals("Для отчёта подключитесь к интернету.")
        compose.onNodeWithTag("team-open-all").assertDoesNotExist()
    }
    @Test fun allThreePeriodCalendarsPreserveTheSelectedCivilBounds() {
        val f = TeamUiFixture(); show(f)
        val from = f.lastOptions!!.getString("from"); val to = f.lastOptions!!.getString("to")
        pane("conditions")
        for ((index, mode) in listOf("sacred", "lunar", "profane").withIndex()) {
            click("team-calendar"); click("team-calendar-$mode"); click("team-apply")
            compose.waitUntil(10000) { f.reports == index + 2 && runCatching { compose.onNodeWithTag("team-refresh").assertIsEnabled() }.isSuccess }
            assertEquals(mode, f.lastOptions!!.getString("calendarMode"))
            assertEquals(from, f.lastOptions!!.getString("from")); assertEquals(to, f.lastOptions!!.getString("to"))
            compose.onNodeWithTag("team-error").assertDoesNotExist()
        }
    }
    @Test fun captureTeamReport() {
        val args = InstrumentationRegistry.getArguments(); assumeTrue(args.getString("genesisTeamCapture") == "true")
        val all = args.getString("genesisTeamLanguages") == "true"
        val languages = if (all) listOf("ru", "en", "el", "de", "fr", "es", "it", "pt", "pl", "sr", "uk", "zh", "tr", "ja") else listOf("ru")
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()); val rotate = args.getString("genesisTeamRotateLeft") == "true"
        if (rotate) device.setOrientationLeft()
        fun capture(name: String) {
            compose.waitForIdle(); val actual = requireNotNull(density)
            val width = compose.onNodeWithTag("team-test-window").fetchSemanticsNode().boundsInRoot.width / actual.density
            assertEquals(args.getString("genesisTeamWidth")!!.toFloat(), width, 1f)
            assertEquals(args.getString("genesisTeamFontScale")!!.toFloat(), actual.fontScale, .01f)
            val phase = args.getString("genesisTeamPhase") ?: "initial"
            val file = File(InstrumentationRegistry.getInstrumentation().targetContext.filesDir, "team-$phase-${args.getString("genesisTeamWidth")}-${actual.fontScale}-${if (dark) "dark" else "light"}-$language-$name.png")
            assertTrue(device.takeScreenshot(file)); println("QA team width=$width font=${actual.fontScale} locale=$language pane=$name")
        }
        try {
            for (locale in languages) for (night in listOf(false, true)) {
                compose.runOnIdle { language = locale; dark = night }
                val f = TeamUiFixture(); show(f); capture("summary")
                if (!all) {
                    pane("conditions"); capture("conditions"); pane("members"); click("team-members"); capture("members")
                    pane("time"); capture("time"); pane("daily"); capture("daily"); pane("estimates"); click("team-estimates"); capture("estimates")
                    pane("summary"); click("team-open-all"); compose.waitUntil(10000) { compose.onAllNodesWithTag("team-source-count").fetchSemanticsNodes().isNotEmpty() }; capture("sources")
                }
            }
        } finally { if (rotate) device.setOrientationNatural() }
    }
}
