package ru.genesis.calendar

import androidx.compose.ui.test.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import kotlin.math.abs
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.data.LocalPreferences
import ru.genesis.calendar.domain.TheokyklosCatalogSource

class TheokyklosFlowTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun allFourAxisAndThresholdMarkersOpenNativeDetails() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        compose.onNodeWithText("Теокиклос").performScrollTo().performClick()
        compose.onNodeWithTag("theokyklos-mandala").assertIsDisplayed()
        TheokyklosCatalogSource.ids.forEach { id ->
            compose.onNodeWithTag("theokyklos-sector-$id").assertExists()
        }
        compose.onNodeWithText("Центр · Дионис и Ариадна →").assertDoesNotExist()
        compose.onNodeWithTag("theokyklos-card-center").assertExists()
        compose.onNodeWithTag("theokyklos-card-hearth").assertExists()
        for (direction in listOf("Север", "Северо-восток", "Восток", "Юго-восток",
            "Юг", "Юго-запад", "Запад", "Северо-запад")) {
            compose.onNodeWithText(direction).assertExists()
        }
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        val preferences = LocalPreferences(app, app.workspaceScope)
        val originalTheme = runBlocking { preferences.values.first().theme }
        try {
            for (theme in listOf("Standart", "Experimental")) {
                runBlocking { preferences.set("theme", theme) }
                compose.waitUntil(10_000) {
                    compose.onAllNodesWithTag("app-theme-$theme").fetchSemanticsNodes().isNotEmpty()
                }
                compose.onNodeWithTag("theokyklos-mandala").assertIsDisplayed()
                device.waitForIdle()
                assertTrue(device.takeScreenshot(File(app.getExternalFilesDir(null),
                    "theokyklos-${theme.lowercase()}-mandala.png")))
            }
        } finally {
            runBlocking { preferences.set("theme", originalTheme) }
        }
        compose.onNodeWithTag("theokyklos-card-hearth").performScrollTo()
        val centerTop = compose.onNodeWithTag("theokyklos-card-center").fetchSemanticsNode().boundsInRoot.top
        val hearthTop = compose.onNodeWithTag("theokyklos-card-hearth").fetchSemanticsNode().boundsInRoot.top
        assertTrue("Центр и Очаг должны стоять в одном ряду", abs(centerTop - hearthTop) < 2f)
        assertTrue(device.takeScreenshot(File(app.getExternalFilesDir(null), "theokyklos-cards-after.png")))
        compose.onNodeWithTag("theokyklos-card-northwest").performScrollTo()
        assertTrue(device.takeScreenshot(File(app.getExternalFilesDir(null), "theokyklos-directions-after.png")))
        compose.onNodeWithTag("theokyklos-mandala").performScrollTo()
        for (id in listOf("zenith", "nadir", "entrance", "exit", "center", "hearth")) {
            if (id == "hearth") compose.onNodeWithTag("theokyklos-sector-hearth")
                .performTouchInput { click(Offset(width / 2f, height * .16f)) }
            else compose.onNodeWithTag("theokyklos-sector-$id").performClick()
            val sector = TheokyklosCatalogSource.load(app).byId.getValue(id)
            compose.onNodeWithText(sector.title.ru).assertExists()
            compose.onNodeWithText("Заклинания Божеств").assertExists()
            if (id == "zenith") {
                compose.waitUntil(10_000) {
                    compose.onAllNodesWithContentDescription("${sector.patrons.ru} — ${sector.title.ru}")
                        .fetchSemanticsNodes().isNotEmpty()
                }
                device.waitForIdle()
                Thread.sleep(600)
                assertTrue(device.takeScreenshot(File(app.getExternalFilesDir(null), "theokyklos-zenith-detail.png")))
            }
            compose.onNodeWithText("×").performClick()
        }
    }
}
