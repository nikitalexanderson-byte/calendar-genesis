package ru.genesis.calendar

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import androidx.test.uiautomator.UiDevice
import ru.genesis.calendar.data.LocalPreferences

class HabitArtFlowTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun originalRanksAchievementsAndRewardsHaveNativeSlots() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val originals = app.assets.list("originals/achievement-art").orEmpty()
            .filter { it.endsWith(".webp") }
        assertEquals(18, originals.size)
        originals.forEach { filename -> app.assets.open("originals/achievement-art/$filename").use {
            assertTrue(it.read() >= 0)
        } }
        listOf("habit-reward-art/hestia-spark.png", "habit-reward-art/comeback.png",
            "hero-path/256/01_tantal.webp", "hero-path/256/16_risen_from_the_abyss.webp").forEach { path ->
            app.assets.open("originals/$path").use { assertTrue(it.read() >= 0) }
        }
        val prefs = LocalPreferences(app, app.workspaceScope)
        val originalTheme = runBlocking { prefs.values.first().theme }
        try {
            runBlocking { prefs.set("theme", "Experimental") }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("app-theme-Experimental").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("Привычки").performScrollTo().performClick()
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("achievement-gallery").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("achievement-gallery").assertExists()
            compose.onNodeWithText("Открыть всю галерею").performScrollTo().performClick()
            compose.onNodeWithTag("achievement-first-step").assertExists()
            compose.onNodeWithTag("achievement-consistency").assertExists()
            compose.onNodeWithTag("achievement-first-step").performScrollTo().assertIsDisplayed()
            val image = File(app.getExternalFilesDir(null), "habits-achievements-after.png")
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(image))
            compose.onNodeWithText("Все ранги").performScrollTo().performClick()
            compose.onNodeWithTag("hero-rank-path").assertExists()
        } finally {
            runBlocking { prefs.set("theme", originalTheme) }
        }
    }
}
