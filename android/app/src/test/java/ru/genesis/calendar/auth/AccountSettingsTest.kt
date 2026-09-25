package ru.genesis.calendar.auth

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class AccountSettingsTest {
    private val response = JSONObject("""{
      "user": {
        "googleAccounts": [
          {"id":"owner-1","email":"owner@example.invalid","displayName":"Owner","isPrimary":true,"calendarConnected":true,"googleTasksImportReady":true},
          {"id":"linked-2","email":"linked@example.invalid","displayName":"Linked","isPrimary":false,"calendarConnected":true,"googleTasksImportReady":true}
        ],
        "syncRouting": {"mode":"category","defaultAccountIds":["owner-1"],
          "categoryAccountIds":{"work":["linked-2"]}},
        "multiAccountEnabled":true,"theme":"experimental","themeRevision":3,
        "calendarMode":"lunar","taskCalendarMode":"profane","timeFormat":"12h",
        "stoicheionDivinationDisabled":false,"language":"ru"
      }
    }""")

    @Test fun parsesLinkedAccountsAndCategoryRoutingWithoutChangingTheirIds() {
        val settings = AccountSettings.fromResponse(response)!!
        assertEquals(2, settings.accounts.size)
        assertEquals("linked-2", settings.routing.categoryAccountIds["work"]!!.single())
        assertEquals("experimental", settings.theme)
        assertEquals("lunar", settings.calendarMode)
        assertEquals("12h", settings.timeFormat)
        assertEquals("linked-2", settings.routing.toJson().getJSONObject("categoryAccountIds")
            .getJSONArray("work").getString(0))
    }

    @Test fun refusesUnknownDestinationsAndEmptyDefaultTargets() {
        val settings = AccountSettings.fromResponse(response)!!
        assertFalse(settings.routing.copy(defaultAccountIds = emptyList()).validFor(settings.accounts))
        assertFalse(settings.routing.copy(categoryAccountIds = mapOf("work" to listOf("unknown")))
            .validFor(settings.accounts))
        assertTrue(settings.routing.copy(mode = "choose").validFor(settings.accounts))
    }

    @Test fun acceptsFiveLinkedAccountsWithoutTruncatingDestinations() {
        val accounts = response.getJSONObject("user").getJSONArray("googleAccounts")
        for (index in 3..5) accounts.put(JSONObject()
            .put("id", "linked-$index").put("email", "linked$index@example.invalid")
            .put("displayName", "Linked $index").put("isPrimary", false))
        val settings = AccountSettings.fromResponse(response)!!
        assertEquals(5, settings.accounts.size)
        assertTrue(settings.routing.copy(defaultAccountIds = settings.accounts.map { it.id })
            .validFor(settings.accounts))
    }
}
