package ru.genesis.calendar

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class StoicheionFlowTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun allAuthoredLettersAndArtAreAvailableOffline() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val letters = JSONArray(app.assets.open("stoicheion.json").bufferedReader().use { it.readText() })
        val art = JSONObject(app.assets.open("stoicheion-art.json").bufferedReader().use { it.readText() })
        assertEquals(24, letters.length())
        assertEquals(24, art.length())
        for (index in 0 until letters.length()) {
            val letter = letters.getJSONObject(index)
            assertTrue(letter.getString("content").length > 200)
            assertTrue(art.getJSONObject(letter.getString("id")).getString("invocation").isNotBlank())
            app.assets.open("originals/stoicheion-cards/${letter.getString("id")}.webp").use {
                assertTrue(it.read() >= 0)
            }
        }
        compose.onNodeWithText("Стойхейон").performScrollTo().performClick()
        compose.onNodeWithTag("stoicheion-grid").assertExists()
        compose.onNodeWithTag("stoicheion-face-alpha", useUnmergedTree = true).assertExists()
        val screenshot = File(app.getExternalFilesDir(null), "stoicheion-cards-after.png")
        assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(screenshot))
        compose.onNodeWithTag("stoicheion-letter-alpha").performClick()
        compose.onAllNodesWithText("ГОЛОВА").onLast().assertExists()
        compose.onNodeWithText("Метафизика изначального истока").assertExists()
        compose.onNodeWithText("Закрыть").performClick()
    }
}
