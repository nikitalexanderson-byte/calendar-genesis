package ru.genesis.calendar

import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import ru.genesis.calendar.data.LocalPreferences
import ru.genesis.calendar.domain.CalendarMode

class PreferencesTest {
    @Test fun sharedProjectsSwitchQueuesAndAcknowledgesPreference() = runBlocking {
        val app=InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val preferences=LocalPreferences(app,"test-shared-switch")
        try {
            preferences.setPending("sharedProjectsEnabled","true")
            val queued=preferences.pending.first()
            assertEquals("true",queued["sharedProjectsEnabled"])
            preferences.acknowledge(queued)
            assertFalse(preferences.pending.first().containsKey("sharedProjectsEnabled"))
            preferences.setPending("sharedProjectsEnabled","false")
            val disabled=preferences.pending.first()
            assertEquals("false",disabled["sharedProjectsEnabled"])
            preferences.acknowledge(disabled)
            assertFalse(preferences.pending.first().containsKey("sharedProjectsEnabled"))
        } finally {
            preferences.acknowledge(mapOf("sharedProjectsEnabled" to "true"))
            preferences.acknowledge(mapOf("sharedProjectsEnabled" to "false"))
        }
    }

    @Test fun eighteenCalendarAndTimeCombinationsPersistWithoutTaskMutation() = runBlocking {
        val app=InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val preferences=LocalPreferences(app,app.workspaceScope)
        val initial=preferences.values.first()
        val recordsBefore=app.database.dao().observeTasks(app.workspaceScope).first().sortedBy { it.id }
        var combinations=0
        try {
            for(display in CalendarMode.entries)
                for(input in CalendarMode.entries) for(time in listOf("24h","12h")) {
                    preferences.set("display",display.wireValue)
                    preferences.set("input",input.wireValue); preferences.set("time",time)
                    val read=LocalPreferences(app,app.workspaceScope).values.first()
                    assertEquals(display,read.display);assertEquals(input,read.input)
                    assertEquals(time=="24h",read.use24)
                    assertEquals(recordsBefore,app.database.dao().observeTasks(app.workspaceScope).first().sortedBy { it.id })
                    combinations++
                }
            assertEquals(18,combinations)
        } finally {
            preferences.set("display",initial.display.wireValue)
            preferences.set("input",initial.input.wireValue);preferences.set("time",if(initial.use24)"24h" else "12h")
        }
    }
}
