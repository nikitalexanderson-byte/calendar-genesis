package ru.genesis.calendar.data

import org.json.JSONObject
import ru.genesis.calendar.domain.CalendarContext

/** Missing fields retain legacy rules; only newly created rules opt in to V2. */
internal fun calendarContextFromJson(value: JSONObject?): CalendarContext? = value?.let {
    CalendarContext(it.getInt("version"), it.getString("timeZone"), it.optString("gregorianYearStart", "january"))
}

internal fun calendarContextJson(value: CalendarContext?): Any = value?.let {
    JSONObject().put("version", it.version).put("timeZone", it.timeZone).put("gregorianYearStart", it.gregorianYearStart)
} ?: JSONObject.NULL
