package ru.genesis.calendar.auth

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class DailyAdviceProtocolTest {
    private fun response() = JSONObject().put("dayKey", "2026-10-23").put("state", "ready").put("advice",
        JSONObject().put("id", "advice-" + "a".repeat(24)).put("dayKey", "2026-10-23").put("title", "Full title")
            .put("body", "Full text\nSecond paragraph").put("language", "ru").put("categories", JSONArray().put("aretology"))
            .put("image", "/advice-art/aretology/advice-" + "a".repeat(24) + ".webp").put("dismissed", false).put("sources", JSONArray()))
    @Test fun preservesIdentityFullTextAndDismissalAcrossRepeatedResponses() {
        val wire = response()
        val first = DailyAdviceProtocol.parse(wire).advice!!
        assertEquals("Full text\nSecond paragraph", first.body)
        val body = DailyAdviceProtocol.record(first.id, first.day)
        assertEquals(setOf("id", "dayKey"), body.keys().asSequence().toSet())
        wire.getJSONObject("advice").put("dismissed", true)
        val next = DailyAdviceProtocol.parse(wire).advice!!
        assertEquals(first.id, next.id); assertTrue(next.dismissed)
        assertEquals(first.image, next.image)
    }
    @Test fun optionalArtworkCannotIntroduceAnArbitraryRemoteUrl() {
        val wire = response(); wire.getJSONObject("advice").put("image", "https://outside.invalid/image")
        assertNull(DailyAdviceProtocol.parse(wire).advice!!.image)
    }
    @Test fun malformedOrCrossDayDataIsRejected() {
        for (mutate in listOf<(JSONObject) -> Unit>(
            { it.getJSONObject("advice").put("dayKey", "2026-10-24") },
            { it.getJSONObject("advice").put("dismissed", 0) },
            { it.getJSONObject("advice").put("language", "unknown") },
            { it.put("state", "ready").put("advice", JSONObject.NULL) }
        )) {
            assertTrue(runCatching { DailyAdviceProtocol.parse(response().also(mutate)) }.isFailure)
        }
    }
    @Test fun missingLegacyPreferencesUseTheWebsiteDefaultsWithoutLosingFalse() {
        assertEquals(AdvicePreferences(), AdvicePreferences.fromJson(null))
        val actual = AdvicePreferences.fromJson(JSONObject().put("enabled", false).put("smart", false)
            .put("categories", JSONArray().put("hermetica").put("unknown")))
        assertFalse(actual.enabled); assertFalse(actual.smart); assertEquals(listOf("hermetica"), actual.categories)
    }
}
