package ru.genesis.calendar.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AndroidUpdatePromptTest {
    @Test fun offersOnlyNewerWellFormedReleases() {
        val body = """{"versionCode":48,"versionName":"2.4.2"}"""
        assertEquals(AndroidRelease(48, "2.4.2"), newerAndroidRelease(body, 47))
        assertNull(newerAndroidRelease(body, 48))
        assertNull(newerAndroidRelease("""{"versionCode":49,"versionName":"../unsafe"}""", 48))
    }
}
