package ru.genesis.calendar

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.data.LocalPreferences

class LandscapeNavigationTest {
    @get:Rule val compose = createAndroidComposeRule<TestWorkspaceActivity>()

    @Test fun landscapeMovesPrimaryMenuLeftAndSettingCanReturnItToTop() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val app = instrumentation.targetContext.applicationContext as GenesisApplication
        val device = UiDevice.getInstance(instrumentation)
        val preferences = LocalPreferences(app, app.workspaceScope)
        val original = runBlocking { preferences.values.first().wideNavigationOnLeft }
        try {
            runBlocking { preferences.set("wideNavigation", "left") }
            device.setOrientationLeft()
            device.waitForIdle()
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("main-navigation-rail").fetchSemanticsNodes().isNotEmpty()
            }
            val rail = compose.onNodeWithTag("main-navigation-rail").assertIsDisplayed()
                .fetchSemanticsNode().boundsInRoot
            val content = compose.onNodeWithTag("main-content").assertIsDisplayed()
                .fetchSemanticsNode().boundsInRoot
            assertTrue("Primary menu must be to the left of content", rail.right <= content.left + 1f)
            assertTrue(device.takeScreenshot(File(app.cacheDir,
                "landscape-navigation-left-2.3.8.png")))

            compose.onNodeWithTag("navigation-Настройки").performScrollTo().performClick()
            compose.waitUntil(5_000) {
                compose.onAllNodesWithTag("wide-navigation-top").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("wide-navigation-top").performScrollTo().performClick()
            compose.waitUntil(5_000) {
                compose.onAllNodesWithTag("main-navigation-scroll").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("main-navigation-scroll").assertIsDisplayed()
            assertTrue(device.takeScreenshot(File(app.cacheDir,
                "landscape-navigation-top-2.3.8.png")))
        } finally {
            runBlocking { preferences.set("wideNavigation", if (original) "left" else "top") }
            device.setOrientationNatural()
            device.unfreezeRotation()
        }
    }
}
