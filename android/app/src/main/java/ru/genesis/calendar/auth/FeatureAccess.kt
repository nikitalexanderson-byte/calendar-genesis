package ru.genesis.calendar.auth

import org.json.JSONObject
import java.time.Instant

/** Read-only server entitlement, deliberately separate from preferences and imports. */
data class FeatureAccess(
    val enforcementEnabled: Boolean = false,
    val declaredPlan: String = "free",
    val effectivePlan: String = "free",
    val lifetimePremium: Boolean = false,
    val validUntil: Instant? = null,
    val policyRevision: String = "legacy-unrestricted",
    val allowedFeatures: Set<String> = emptySet(),
    val freeFeatures: Set<String> = emptySet(),
) {
    fun allows(feature: String, now: Instant = Instant.now()): Boolean {
        if (!enforcementEnabled) return true
        val expired = !lifetimePremium && effectivePlan != "free" && (validUntil == null || !now.isBefore(validUntil))
        return feature in if (expired) freeFeatures else allowedFeatures
    }

    companion object {
        fun fromJson(value: JSONObject?): FeatureAccess {
            // Older servers remain compatible; enabling limits requires the versioned contract.
            if (value == null) return FeatureAccess()
            require(value.getInt("schemaVersion") == 1) { "Unsupported feature access contract" }
            fun strings(key: String): Set<String> = value.getJSONArray(key).let { array ->
                (0 until array.length()).map { array.getString(it) }.toSet()
            }
            return FeatureAccess(value.getBoolean("enforcementEnabled"), value.getString("declaredPlan"),
                value.getString("effectivePlan"), value.getBoolean("lifetimePremium"),
                value.optString("validUntil").takeIf { !value.isNull("validUntil") && it.isNotBlank() }?.let(Instant::parse),
                value.getString("policyRevision"), strings("allowedFeatures"), strings("freeFeatures"))
        }
    }
}
