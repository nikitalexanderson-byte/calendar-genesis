package ru.genesis.calendar.ui

import android.accessibilityservice.AccessibilityServiceInfo
import android.view.accessibility.AccessibilityWindowInfo
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import ru.genesis.calendar.BuildConfig

/** A dialog owns its IME window; the underlying Activity can retain old insets. */
internal fun ComposeTestRule.dismissValidationKeyboard() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    check(BuildConfig.DEBUG && instrumentation.targetContext.packageName == "ru.genesis.calendar.v313.debug")
    val device = UiDevice.getInstance(instrumentation)
    val automation = instrumentation.uiAutomation
    val originalFlags = automation.serviceInfo.flags
    automation.serviceInfo = automation.serviceInfo.apply {
        flags = flags or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
    }
    try {
        waitUntil(5_000) { automation.windows.any { it.type == AccessibilityWindowInfo.TYPE_APPLICATION } }
        if (automation.windows.any { it.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD }) {
            check(device.pressBack())
        }
        waitForIdle()
        waitUntil(5_000) { automation.windows.none { it.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD } }
    } finally {
        automation.serviceInfo = automation.serviceInfo.apply { flags = originalFlags }
    }
}
