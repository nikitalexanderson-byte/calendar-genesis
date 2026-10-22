package ru.genesis.calendar

import android.app.Instrumentation
import android.graphics.BitmapFactory
import android.os.Build
import android.os.ParcelFileDescriptor
import android.view.Window
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.abs

internal data class PaintedSystemScreenshot(
    val pixels: ByteArray,
    val surfaceFraction: Double,
    val attempts: Int,
    val frameSync: String,
)

/**
 * Compose idleness and animation callbacks do not prove that RenderThread has
 * submitted the first app buffer. Wait for that commit on API29+, then verify
 * the real PNG contains the scene's Surface (system bars alone must not pass).
 * This is a blank-frame guard, not a substitute for reviewing the widgets.
 */
internal fun capturePaintedSystemScreenshot(
    instrumentation: Instrumentation,
    window: Window,
    surfaceColor: Int,
    onRejectedFrame: (attempt: Int, pixels: ByteArray) -> Unit,
): PaintedSystemScreenshot {
    var fraction = 0.0
    repeat(3) { attempt ->
        val committed = CountDownLatch(1)
        var frameSync = "animation-fallback"
        instrumentation.runOnMainSync {
            val view = window.decorView
            if (Build.VERSION.SDK_INT >= 29 && view.isHardwareAccelerated) {
                frameSync = "render-thread-commit"
                view.viewTreeObserver.registerFrameCommitCallback { committed.countDown() }
                view.invalidate()
            } else {
                view.postOnAnimation { view.postOnAnimation { committed.countDown() } }
                view.invalidate()
            }
        }
        check(committed.await(5, TimeUnit.SECONDS)) { "Window frame did not commit" }
        instrumentation.waitForIdleSync()
        val pixels = captureSystemScreenshot(instrumentation)
        val bitmap = checkNotNull(BitmapFactory.decodeByteArray(pixels, 0, pixels.size)) { "Invalid system PNG" }
        try {
            val row = IntArray(bitmap.width)
            val red = (surfaceColor shr 16) and 255
            val green = (surfaceColor shr 8) and 255
            val blue = surfaceColor and 255
            var matched = 0L
            for (y in 0 until bitmap.height) {
                bitmap.getPixels(row, 0, row.size, 0, y, row.size, 1)
                matched += row.count { pixel ->
                    // Allow small compositor rounding without accepting the Activity background.
                    abs(((pixel shr 16) and 255) - red) <= 2 &&
                        abs(((pixel shr 8) and 255) - green) <= 2 && abs((pixel and 255) - blue) <= 2
                }
            }
            fraction = matched.toDouble() / (bitmap.width.toLong() * bitmap.height)
        } finally {
            bitmap.recycle()
        }
        if (fraction >= .15) return PaintedSystemScreenshot(pixels, fraction, attempt + 1, frameSync)
        onRejectedFrame(attempt + 1, pixels)
    }
    error("System capture has no painted app Surface after 3 frames (fraction=$fraction)")
}

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
