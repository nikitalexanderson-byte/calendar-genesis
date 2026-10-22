package ru.genesis.calendar

import android.app.Instrumentation
import android.os.ParcelFileDescriptor

/** Reject frames covered by a system crash/ANR dialog instead of accepting hidden UI. */
internal fun captureSystemScreenshot(instrumentation: Instrumentation): ByteArray {
    val windows = ParcelFileDescriptor.AutoCloseInputStream(
        instrumentation.uiAutomation.executeShellCommand("dumpsys window windows"),
    ).bufferedReader().use { it.readText() }
    val focus = windows.lineSequence().firstOrNull { "mCurrentFocus=" in it }.orEmpty()
    check("Application Not Responding:" !in focus && "Application Error:" !in focus) {
        "A system error dialog blocks the capture: ${focus.trim()}"
    }
    return ParcelFileDescriptor.AutoCloseInputStream(
        instrumentation.uiAutomation.executeShellCommand("screencap -p"),
    ).use { it.readBytes() }
}
