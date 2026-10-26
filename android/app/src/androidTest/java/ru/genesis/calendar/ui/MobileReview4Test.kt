package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.Density
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.awaitCancellation
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.PagerTestActivity
import ru.genesis.calendar.auth.SharedWorkspaceGateway
import ru.genesis.calendar.captureNativeWindow
import ru.genesis.calendar.domain.GenesisCalendar
import java.io.File
import android.graphics.BitmapFactory
import java.time.LocalDate
import java.util.concurrent.atomic.AtomicInteger

/** Local SVG, real gesture engine and synthetic gateway only; never uses a user account. */
class MobileReview4Test {
    @get:Rule val compose = createAndroidComposeRule<PagerTestActivity>()
    private val args get() = InstrumentationRegistry.getArguments()
    private val width get() = args.getString("genesisWidth")?.toIntOrNull() ?: 390
    private val dark get() = args.getString("genesisDark") == "true"
    @Composable private fun Theme(content: @Composable () -> Unit) {
        val density = compose.activity.resources.displayMetrics.widthPixels.toFloat() / width
        CompositionLocalProvider(LocalDensity provides Density(density, args.getString("genesisFontScale")?.toFloatOrNull() ?: 1f),
            LocalGenesisLanguage provides "ru", LocalEveningTheme provides dark) {
            MaterialTheme(colorScheme = if (dark) evening else standart, typography = GenesisTypography, shapes = GenesisShapes) {
                Surface(Modifier.fillMaxSize()) { content() }
            }
        }
    }
    private fun capture(name: String): File {
        val file = File(compose.activity.getExternalFilesDir(null), "review4-$width-${if (dark) "dark" else "light"}-$name.png")
        captureNativeWindow(file)
        return file
    }
    private fun assertModelPainted(file: File) {
        val bitmap = BitmapFactory.decodeFile(file.absolutePath)
        val colors = mutableSetOf<Int>()
        for (y in bitmap.height*4/10 until bitmap.height*65/100 step 4)
            for (x in bitmap.width/4 until bitmap.width*3/4 step 4) colors += bitmap.getPixel(x,y)
        bitmap.recycle()
        assertTrue("The SVG must be painted, not only present in the DOM: ${colors.size} colors",colors.size>12)
    }

    @Test fun exactOfflineCircleSupportsZoomSelectionAndOpeningTheCivilDate() {
        val calendar = GenesisCalendar()
        val shown = LocalDate.of(2026,10,26)
        var opened: LocalDate? = null
        var closed = false
        compose.setContent { Theme { SolarCalendarModel(calendar,shown,{ opened=it },{ closed=true }) } }
        compose.waitUntil(30_000) { compose.onAllNodes(hasTestTag("solar-model-fit") and isEnabled()).fetchSemanticsNodes().isNotEmpty() }
        var modelGeometry: String? = null
        compose.runOnUiThread {
            fun find(view: android.view.View): android.webkit.WebView? {
                if (view is android.webkit.WebView) return view
                if (view is android.view.ViewGroup) for (i in 0 until view.childCount) find(view.getChildAt(i))?.let { return it }
                return null
            }
            android.view.inspector.WindowInspector.getGlobalWindowViews().firstNotNullOfOrNull { find(it) }
                ?.evaluateJavascript("JSON.stringify({viewport:window.innerHeight,width:document.querySelector('svg').getBoundingClientRect().width,height:document.querySelector('svg').getBoundingClientRect().height,box:document.querySelector('svg').getAttribute('viewBox'),display:getComputedStyle(document.querySelector('svg')).display})") { modelGeometry=it }
        }
        compose.waitUntil(10_000) { modelGeometry!=null }
        println("GENESIS_MODEL_GEOMETRY $modelGeometry")
        val first = compose.onNodeWithTag("solar-model-month").fetchSemanticsNode().config[
            androidx.compose.ui.semantics.SemanticsProperties.Text].single().text
        assertModelPainted(capture("circle-overview"))
        compose.onNodeWithTag("solar-model-zoom-in").performClick()
        compose.onNodeWithTag("solar-model-zoom-out").performClick()
        compose.onNodeWithTag("solar-model-next").performClick()
        compose.waitUntil(10_000) {
            compose.onNodeWithTag("solar-model-month").fetchSemanticsNode().config[
                androidx.compose.ui.semantics.SemanticsProperties.Text].single().text != first
        }
        assertModelPainted(capture("circle-selected-month"))
        compose.onNodeWithTag("solar-model-open-date").performClick()
        assertTrue(closed)
        val expectedMonth = (calendar.sacredDate(shown).monthIndex + 1) % 13
        assertEquals(calendar.gregorianDate(calendar.sacredDate(shown).sacredYear,expectedMonth,1),opened)
    }

    @Test fun teamHistoryStartsCollapsedAndRevealsOnlyFiveMoreAtATime() {
        val rows = (1..17).map { JSONObject().put("id","fixture-$it").put("action","task.updated")
            .put("actorName","Участник").put("taskTitle","Действие $it").put("projectTitle","Проверка").put("isRead",1) }
        compose.setContent { Theme {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                AffairsDisclosure("События команды · история") { TeamEventRows(rows,false) }
            }
        } }
        compose.onAllNodes(hasTestTag("shared-team-event-fixture-1")).assertCountEquals(0)
        compose.onNodeWithText("События команды · история").performClick()
        compose.onNodeWithTag("shared-team-event-fixture-5").assertExists()
        compose.onNodeWithTag("shared-team-event-fixture-6").assertDoesNotExist()
        compose.onNodeWithTag("shared-team-history-more").performScrollTo().performClick()
        compose.onNodeWithTag("shared-team-event-fixture-10").assertExists()
        compose.onNodeWithTag("shared-team-event-fixture-11").assertDoesNotExist()
        capture("team-history-five-more")
        compose.onNodeWithText("События команды · история").performScrollTo().performClick()
        compose.onNodeWithText("События команды · история").performClick()
        compose.onNodeWithTag("shared-team-event-fixture-6").assertDoesNotExist()
    }

    @Test fun cancellingAHiddenSharedPageDoesNotBecomeAnErrorButRealFailuresRemainVisible() {
        val calls = AtomicInteger()
        var active by mutableStateOf(true)
        val gateway = object : SharedWorkspaceGateway {
            override suspend fun sharedSpaces(): JSONObject {
                when (calls.incrementAndGet()) {
                    1 -> awaitCancellation()
                    3 -> throw IllegalStateException("Синтетическая ошибка сети")
                }
                return JSONObject().put("spaces",JSONArray())
            }
        }
        compose.setContent { Theme {
            CompositionLocalProvider(LocalNavigationPageContext provides NavigationPageContext("Проекты",active)) {
                SharedProjectsScreen(gateway,"ru")
            }
        } }
        compose.waitUntil(10_000) { calls.get()==1 }
        compose.runOnIdle { active=false }
        compose.waitForIdle()
        compose.onAllNodes(hasText("cancel",substring=true,ignoreCase=true)).assertCountEquals(0)
        compose.onAllNodes(hasText("coroutine",substring=true,ignoreCase=true)).assertCountEquals(0)
        compose.runOnIdle { active=true }
        compose.waitUntil(10_000) { calls.get()==2 }
        compose.runOnIdle { active=false }; compose.waitForIdle()
        compose.runOnIdle { active=true }
        compose.waitUntil(10_000) { calls.get()==3 }
        compose.onNodeWithText("Синтетическая ошибка сети").assertExists()
    }
}
