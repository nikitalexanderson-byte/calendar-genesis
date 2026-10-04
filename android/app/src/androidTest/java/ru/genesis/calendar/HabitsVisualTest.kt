package ru.genesis.calendar

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.ui.Modifier
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.Density
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
    private val width = InstrumentationRegistry.getArguments().getString("genesisWidth")?.toIntOrNull()
    private val experimental = InstrumentationRegistry.getArguments().getString("genesisExperimental") != "false"

    @Test fun dailyHabitsLeadAndRankArtStaysInLabeledSection() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.workspaceScope == "internal-validation-v1")
        compose.setContent {
            val originalDensity = LocalDensity.current
            val density = width?.let { Density(compose.activity.resources.displayMetrics.widthPixels.toFloat() / it,
                originalDensity.fontScale) } ?: originalDensity
            CompositionLocalProvider(LocalDensity provides density) {
                MaterialTheme(colorScheme = standart) {
                    Surface(Modifier.fillMaxSize(),color=standart.background) {
                        androidx.compose.foundation.layout.Column(Modifier.safeDrawingPadding()) {
                            HabitsScreen(app, experimental)
                        }
                    }
                }
            }
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("ЕЖЕДНЕВНЫЙ РИТМ").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Мои привычки").assertExists()
        if (experimental) compose.onNodeWithText("Путь Героя и награды").assertExists()
        compose.onNodeWithContentDescription("Путь героических рангов").assertDoesNotExist()
        if (experimental) compose.onNodeWithTag("habit-hero-path-toggle").assertExists()
        assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            .takeScreenshot(File(app.getExternalFilesDir(null),
                "habits-${if (experimental) "experimental" else "standart"}-${width ?: 390}.png")))
        if (experimental) {
            compose.onNodeWithTag("habit-hero-path-heading").performScrollTo().performClick()
            compose.onNodeWithText("Свернуть путь").assertExists()
            compose.onNodeWithTag("habit-hero-path-heading").performScrollTo().performClick()
            compose.onNodeWithTag("sacred-habits-heading").performScrollTo().performClick()
            compose.onNodeWithText("Свернуть сакральные практики").assertExists()
            compose.onNodeWithText("ТЕОКИКЛОС · ВОПЛОЩЁННЫЙ МИФ").performScrollTo()
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
                .takeScreenshot(File(app.getExternalFilesDir(null), "habits-sacred-open-${width ?: 390}.png")))
            compose.onNodeWithText("Сон и настроение").performClick()
            compose.onNodeWithText("Создать план сна", substring=true).performScrollTo().assertExists()
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
                .takeScreenshot(File(app.getExternalFilesDir(null), "habits-sleep-${width ?: 390}.png")))
            compose.onNodeWithText("Привычки").performClick()
        }
        compose.onNodeWithText("Новая привычка").performScrollTo().performClick()
        compose.onNodeWithTag("habit-form-calendar-lunar").performScrollTo().performClick()
        compose.onNodeWithTag("habit-form-calendar-lunar").assertIsSelected()
    }
}
