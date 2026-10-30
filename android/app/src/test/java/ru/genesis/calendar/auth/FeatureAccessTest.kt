package ru.genesis.calendar.auth

import java.time.Instant
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class FeatureAccessTest {
    private val now = Instant.parse("2026-10-30T00:00:00Z")
    private fun snapshot(plan: String = "premium", lifetime: Boolean = false, until: String? = "2026-11-30T00:00:00Z") =
        JSONObject().put("schemaVersion", 1).put("enforcementEnabled", true).put("declaredPlan", plan)
            .put("effectivePlan", if (lifetime) "premium" else plan).put("lifetimePremium", lifetime)
            .put("validUntil", until ?: JSONObject.NULL).put("policyRevision", "synthetic")
            .put("allowedFeatures", org.json.JSONArray(listOf("tasks", "diary")))
            .put("freeFeatures", org.json.JSONArray(listOf("tasks")))

    @Test fun releaseAndLegacyModeNeverLimitFeatures() {
        assertTrue(FeatureAccess.fromJson(null).allows("any-future-feature", now))
        assertTrue(FeatureAccess.fromJson(snapshot().put("enforcementEnabled", false)).allows("any-future-feature", now))
    }
    @Test fun activePaidServerSnapshotGrantsOnlyItsCapabilities() {
        val access = FeatureAccess.fromJson(snapshot())
        assertTrue(access.allows("diary", now)); assertFalse(access.allows("teams", now))
    }
    @Test fun expirationFallsBackToFreeAtExactBoundaryWhileAppRemainsOpen() {
        val access = FeatureAccess.fromJson(snapshot(until = now.toString()))
        assertTrue(access.allows("tasks", now)); assertFalse(access.allows("diary", now))
        assertTrue(access.allows("diary", now.minusSeconds(1)))
    }
    @Test fun ordinaryPlanWithoutVerifiedExpiryDoesNotRetainPaidAccess() {
        assertFalse(FeatureAccess.fromJson(snapshot(until = null)).allows("diary", now))
    }
    @Test fun lifetimePremiumNeedsNoPaymentExpiryAndIsNotBusiness() {
        val access = FeatureAccess.fromJson(snapshot("premium4life", true, null))
        assertTrue(access.allows("diary", now.plusSeconds(10L * 365 * 86400)))
        assertFalse(access.allows("teams", now))
    }
    @Test fun accountSnapshotsAreIndependentAndHaveNoPreferencesWriter() {
        val paid = FeatureAccess.fromJson(snapshot())
        val free = FeatureAccess.fromJson(snapshot("free").put("allowedFeatures", org.json.JSONArray(listOf("tasks"))))
        assertTrue(paid.allows("diary", now)); assertFalse(free.allows("diary", now))
    }
}
