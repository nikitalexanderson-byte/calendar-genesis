package ru.genesis.calendar.domain

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.roundToInt

enum class CalendarMode(val wireValue: String) {
    PROFANE("profane"), SACRED("sacred"), LUNAR("lunar");
    companion object {
        fun fromWire(value: String) = entries.firstOrNull { it.wireValue == value } ?: SACRED
    }
}

/** Display selection cannot silently mutate a task's calendar or recurrence. */
data class CalendarPreferences(
    val displayCalendar: CalendarMode = CalendarMode.SACRED,
    val taskCalendar: CalendarMode = CalendarMode.SACRED,
    val use24HourTime: Boolean = true,
)

data class SacredDay(val day: Int, val name: String, val description: String, val pyata: Int, val pyataTitle: String)
data class SacredMonth(val index: Int, val roman: String, val name: String, val title: String, val description: String, val season: String, val color: String, val symbol: String, val days: List<SacredDay>)
data class LunarMonthDefinition(val roman: String, val name: String, val title: String, val description: String)
data class SacredDateInfo(val sacredYear: Int, val monthIndex: Int, val day: Int, val dayOfYear: Int, val daysInYear: Int, val apeironDays: Int)
data class LunarYearInfo(val sacredYear: Int, val startMonthIndex: Int, val endMonthIndex: Int, val startDate: LocalDate, val endDate: LocalDate) {
    val monthCount: Int get() = endMonthIndex - startMonthIndex
}
data class LunarDateInfo(val year: LunarYearInfo, val monthIndex: Int, val monthOrdinal: Int, val month: LunarMonthDefinition, val day: Int, val monthLength: Int) {
    val isThreshold: Boolean get() = day == monthLength
    val decade: String get() = when { day <= 10 -> "Декада Роста"; day <= 20 -> "Декада Полноты"; else -> "Декада Исхода" }
}
data class MoonInfo(val day: Int, val phaseStep: Int, val phase: String, val illumination: Int,
    val epithet: String, val direction: String, val event: String)
data class SolarEvent(val name: String, val shortName: String, val symbol: String,
    val instant: Instant, val date: LocalDate)
data class CalendarRange(val start: LocalDate, val end: LocalDate) {
    fun dates(): List<LocalDate> = (0..ChronoUnit.DAYS.between(start, end)).map(start::plusDays)
}

/** Port of app/calendar-data.ts. Sacred year starts March 20 (not the astronomical equinox).
 * Lunar year uses the actual first new moon following the astronomical equinox.
 * Public offline ephemeris supports 1900..2100 inclusive; out-of-range calls fail explicitly.
 */
class GenesisCalendar(val zoneId: ZoneId = ZoneId.systemDefault()) {
    fun solarEvents(year: Int): List<SolarEvent> {
        require(year in 1900..2100) { "Offline solar ephemeris supports 1900–2100" }
        val offset = (year - SolarEphemeris.firstYear) * 4
        val names = listOf("Весеннее равноденствие", "Летнее солнцестояние",
            "Осеннее равноденствие", "Зимнее солнцестояние")
        val symbols = listOf("☼", "✺", "☉", "✹")
        return (0..3).map { index ->
            val instant = Instant.ofEpochMilli(SolarEphemeris.moments[offset + index])
            SolarEvent(names[index], if (index % 2 == 0) "Равноденствие" else "Солнцестояние",
                symbols[index], instant, instant.atZone(zoneId).toLocalDate())
        }
    }

    fun solarEvent(date: LocalDate): SolarEvent? = solarEvents(date.year).firstOrNull { it.date == date }

    fun sacredDate(date: LocalDate): SacredDateInfo {
        val year = if (date < LocalDate.of(date.year, 3, 20)) date.year - 1 else date.year
        val start = LocalDate.of(year, 3, 20)
        val dayOfYear = ChronoUnit.DAYS.between(start, date).toInt()
        val length = ChronoUnit.DAYS.between(start, start.plusYears(1)).toInt()
        return SacredDateInfo(year, if (dayOfYear < 360) dayOfYear / 30 else 12,
            if (dayOfYear < 360) dayOfYear % 30 + 1 else dayOfYear - 359, dayOfYear, length, length - 360)
    }

    fun gregorianDate(sacredYear: Int, monthIndex: Int, day: Int): LocalDate {
        require(monthIndex in 0..12)
        require(day in 1..sacredMonthLength(sacredYear, monthIndex))
        return LocalDate.of(sacredYear, 3, 20).plusDays((monthIndex * 30 + day - 1).toLong())
    }

    fun sacredMonthLength(sacredYear: Int, monthIndex: Int): Int {
        require(monthIndex in 0..12)
        return if (monthIndex < 12) 30 else LocalDate.of(sacredYear + 1, 3, 20).toEpochDay().minus(LocalDate.of(sacredYear, 3, 20).toEpochDay()).toInt() - 360
    }

    fun lunarMonthStart(index: Int): LocalDate {
        val offset = index - LunarEphemeris.firstIndex
        require(offset in LunarEphemeris.newMoons.indices) { "Lunar ephemeris exhausted; update required" }
        return Instant.ofEpochMilli(LunarEphemeris.newMoons[offset]).atZone(zoneId).toLocalDate()
    }

    fun lunarMonthIndex(date: LocalDate): Int {
        require(date.year in 1900..2100) { "Offline lunar calendar supports 1900–2100; update required" }
        var low = 0
        var high = LunarEphemeris.newMoons.lastIndex
        while (low < high) {
            val mid = (low + high + 1) / 2
            if (lunarMonthStart(mid + LunarEphemeris.firstIndex) <= date) low = mid else high = mid - 1
        }
        return low + LunarEphemeris.firstIndex
    }

    fun lunarYear(sacredYear: Int): LunarYearInfo {
        val offset = sacredYear - LunarEphemeris.firstYear
        require(offset >= 0 && offset + 1 < LunarEphemeris.yearStartIndices.size) { "Lunar year outside ephemeris" }
        val start = LunarEphemeris.yearStartIndices[offset]
        val end = LunarEphemeris.yearStartIndices[offset + 1]
        return LunarYearInfo(sacredYear, start, end, lunarMonthStart(start), lunarMonthStart(end))
    }

    fun lunarDate(date: LocalDate): LunarDateInfo {
        val sacred = sacredDate(date)
        val candidate = lunarYear(sacred.sacredYear)
        val year = if (date >= candidate.startDate) candidate else lunarYear(sacred.sacredYear - 1)
        val index = lunarMonthIndex(date)
        val start = lunarMonthStart(index)
        val ordinal = index - year.startMonthIndex + 1
        return LunarDateInfo(year, index, ordinal, SacredCatalog.lunarMonths[(ordinal - 1).coerceIn(0,12)],
            ChronoUnit.DAYS.between(start, date).toInt() + 1,
            ChronoUnit.DAYS.between(start, lunarMonthStart(index + 1)).toInt())
    }

    /** Phase display interpolates between the same exact new-moon instants used by the lunar calendar. */
    fun moonInfo(date: LocalDate): MoonInfo {
        val lunar = lunarDate(date)
        val offset = lunar.monthIndex - LunarEphemeris.firstIndex
        val start = LunarEphemeris.newMoons[offset]
        val end = LunarEphemeris.newMoons[offset + 1]
        val instant = date.atTime(12, 0).atZone(zoneId).toInstant().toEpochMilli()
        val fraction = ((instant - start).toDouble() / (end - start)).coerceIn(0.0, 0.999999)
        val phaseIndex = (fraction * 8).roundToInt() % 8
        val phase = listOf("Новолуние", "Молодой серп", "Первая четверть", "Растущая луна",
            "Полнолуние", "Убывающая луна", "Последняя четверть", "Старый серп")[phaseIndex]
        val newMoon = lunar.day == 1
        val waxing = fraction < 0.5
        val fullMoon = kotlin.math.abs(fraction - 0.5) <= 0.05
        return MoonInfo(lunar.day, (fraction * 30).roundToInt() % 30, phase,
            (((1 - cos(2 * PI * fraction)) / 2) * 100).roundToInt(),
            if (newMoon || !waxing) "Геката" else "Артемида",
            if (waxing && !newMoon) "Восходящая луна" else "Нисходящая луна",
            if (newMoon) "Торжество Гекаты · новолуние"
            else if (fullMoon) "Торжество Артемиды · полнолуние" else "")
    }

    fun monthRange(date: LocalDate, mode: CalendarMode): CalendarRange = when (mode) {
        CalendarMode.PROFANE -> CalendarRange(date.withDayOfMonth(1), date.withDayOfMonth(date.lengthOfMonth()))
        CalendarMode.SACRED -> sacredDate(date).let { s -> CalendarRange(gregorianDate(s.sacredYear,s.monthIndex,1), gregorianDate(s.sacredYear,s.monthIndex,sacredMonthLength(s.sacredYear,s.monthIndex))) }
        CalendarMode.LUNAR -> lunarMonthIndex(date).let { CalendarRange(lunarMonthStart(it), lunarMonthStart(it + 1).minusDays(1)) }
    }

    fun yearRange(date: LocalDate, mode: CalendarMode): CalendarRange = when (mode) {
        CalendarMode.PROFANE -> CalendarRange(date.withDayOfYear(1), date.withDayOfYear(date.lengthOfYear()))
        CalendarMode.SACRED -> sacredDate(date).let { CalendarRange(LocalDate.of(it.sacredYear,3,20), LocalDate.of(it.sacredYear+1,3,19)) }
        CalendarMode.LUNAR -> lunarDate(date).year.let { CalendarRange(it.startDate, it.endDate.minusDays(1)) }
    }

    fun formatDate(date: LocalDate, mode: CalendarMode): String = when(mode) {
        CalendarMode.PROFANE -> date.toString()
        CalendarMode.SACRED -> sacredDate(date).let { "${it.day} · ${SacredCatalog.months[it.monthIndex].name}" }
        CalendarMode.LUNAR -> lunarDate(date).let { "${it.day} · ${it.month.name}" }
    }
}

enum class DstOverlapPolicy { EARLIER_OFFSET, LATER_OFFSET }

/** A nonexistent local time is rejected for explicit user correction. Never shifts silently.
 * Repeated local times require an explicit offset policy. Date-only values do not call this.
 */
fun resolveReminderTime(local: LocalDateTime, zone: ZoneId, overlap: DstOverlapPolicy): ZonedDateTime {
    val offsets: List<ZoneOffset> = zone.rules.getValidOffsets(local)
    require(offsets.isNotEmpty()) { "This local time does not exist because of daylight saving time" }
    val offset = if (overlap == DstOverlapPolicy.EARLIER_OFFSET) offsets.first() else offsets.last()
    return ZonedDateTime.ofStrict(local, offset, zone)
}
