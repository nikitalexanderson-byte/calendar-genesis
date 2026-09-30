package ru.genesis.calendar.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AndroidUpdatePromptTest {
    @Test fun offersOnlyNewerWellFormedReleases() {
        val body = """{"versionCode":47,"versionName":"2.4.1"}"""
        assertEquals(AndroidRelease(47, "2.4.1"), newerAndroidRelease(body, 46))
        assertNull(newerAndroidRelease(body, 47))
        assertNull(newerAndroidRelease("""{"versionCode":48,"versionName":"../unsafe"}""", 47))
    }
}
