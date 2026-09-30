package ru.genesis.calendar.auth

import org.json.JSONArray
import org.json.JSONObject

data class LinkedGoogleAccount(
    val id: String,
    val email: String,
    val displayName: String,
    val isPrimary: Boolean,
    val calendarConnected: Boolean,
    val tasksConnected: Boolean,
)

data class SyncRouting(
    val mode: String,
    val defaultAccountIds: List<String>,
    val categoryAccountIds: Map<String, List<String>>,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("mode", mode)
        .put("defaultAccountIds", JSONArray(defaultAccountIds))
        .put("categoryAccountIds", JSONObject().apply {
            categoryAccountIds.forEach { (categoryId, accounts) -> put(categoryId, JSONArray(accounts)) }
        })

    fun validFor(accounts: List<LinkedGoogleAccount>): Boolean {
        val validIds = accounts.map { it.id }.toSet()
        return mode in setOf("fixed", "choose", "category") &&
            defaultAccountIds.isNotEmpty() && defaultAccountIds.all { it in validIds } &&
            categoryAccountIds.values.all { values -> values.all { it in validIds } }
    }
}

data class AccountSettings(
    val accounts: List<LinkedGoogleAccount>,
    val routing: SyncRouting,
    val multiAccountEnabled: Boolean,
    val theme: String,
    val themeRevision: Int,
    val calendarMode: String,
    val taskCalendarMode: String,
    val timeFormat: String,
    val divinationDisabled: Boolean,
    val language: String,
    val isAdmin: Boolean = false,
    val weekStart: String = "sunday",
    val gregorianYearStart: String = "january",
) {
    companion object {
        fun fromResponse(response: JSONObject): AccountSettings? {
            if (response.isNull("user")) return null
            val user = response.getJSONObject("user")
            val array = user.getJSONArray("googleAccounts")
            val accounts = (0 until array.length()).map { index ->
                val item = array.getJSONObject(index)
                LinkedGoogleAccount(
                    id = item.getString("id"),
                    email = item.getString("email"),
                    displayName = item.optString("displayName"),
                    isPrimary = item.optBoolean("isPrimary"),
                    calendarConnected = item.optBoolean("calendarConnected"),
                    tasksConnected = item.optBoolean("googleTasksImportReady"),
                )
            }
            val route = user.getJSONObject("syncRouting")
            val categoryValue = route.opt("categoryAccountIds")
            val categoryMap = when (categoryValue) {
                is JSONObject -> categoryValue
                // Servers before 2.2.1 encoded an empty PHP map as []. Accept only
                // that legacy empty shape while keeping malformed populated arrays invalid.
                is JSONArray -> if (categoryValue.length() == 0) JSONObject()
                    else throw IllegalArgumentException("Invalid category account routing")
                null, JSONObject.NULL -> JSONObject()
                else -> throw IllegalArgumentException("Invalid category account routing")
            }
            val categories = categoryMap.keys().asSequence().associateWith { key -> categoryMap.getJSONArray(key).strings() }
            val routing = SyncRouting(route.getString("mode"), route.getJSONArray("defaultAccountIds").strings(), categories)
            require(accounts.isNotEmpty() && routing.validFor(accounts)) { "Invalid account routing" }
            return AccountSettings(accounts, routing, user.optBoolean("multiAccountEnabled"),
                user.optString("theme", "standart"), user.optInt("themeRevision", 0),
                user.optString("calendarMode", "sacred"), user.optString("taskCalendarMode", "sacred"),
                user.optString("timeFormat", "24h"), user.optBoolean("stoicheionDivinationDisabled"),
                user.optString("language", "ru"), user.optBoolean("isAdmin"), user.optString("weekStart", "sunday"),
                user.optString("gregorianYearStart", "january"))
        }
    }
}

private fun JSONArray.strings(): List<String> = (0 until length()).map { getString(it) }
