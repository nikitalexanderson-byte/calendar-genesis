package ru.genesis.calendar.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class AndroidUpdatePromptTest {
    @Test fun offersOnlyNewerWellFormedReleases() {
        val hash = "a".repeat(64)
        val body = """{"versionCode":49,"versionName":"2.4.3","sha256":"$hash"}"""
        assertEquals(AndroidRelease(49, "2.4.3", hash), newerAndroidRelease(body, 48))
        assertNull(newerAndroidRelease(body, 49))
        assertNull(newerAndroidRelease("""{"versionCode":49,"versionName":"../unsafe","sha256":"$hash"}""", 48))
        assertNull(newerAndroidRelease("""{"versionCode":49,"versionName":"2.4.3","sha256":"bad"}""", 48))
    }

    @Test fun rejectsDamagedDownloadedApk() {
        val file = File.createTempFile("genesis-update", ".apk")
        try {
            file.writeText("abc")
            val hash = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
            assertTrue(verifiedApk(file, hash))
            file.appendText("truncated or changed")
            assertFalse(verifiedApk(file, hash))
        } finally {
            file.delete()
        }
    }
}
