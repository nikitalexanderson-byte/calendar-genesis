package ru.genesis.calendar.domain.habits

import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlin.math.floor
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.RecurrenceConfig
import ru.genesis.calendar.domain.RecurrenceEngine
import ru.genesis.calendar.domain.CalendarMode

internal fun jsRound(value: Double): Int = if (value.isFinite()) floor(value + 0.5).toInt() else 0
internal fun safeCount(value: Double): Int = jsRound(value).coerceAtLeast(0)

data class TrackerEntity(val id: String, val createdAt: String, val updatedAt: String,
    val version: Int = 1, val syncState: String = "local") {
    fun changed(timestamp: String) = copy(updatedAt=timestamp,version=version+1,syncState="pending")
    companion object {
        fun create(prefix: String, timestamp: String = Instant.now().toString(), id: String = "$prefix-${UUID.randomUUID()}") =
            TrackerEntity(id,timestamp,timestamp)
    }
}

data class TrackerSchedule(val startDate: LocalDate, val endDate: LocalDate? = null,
    val timezone: String, val recurrence: RecurrenceConfig)
data class HabitReminder(val enabled: Boolean = false, val time: String = "09:00",
    val syncToGoogleTasks: Boolean = false, val showInGoogleCalendar: Boolean = false,
    val googleTaskId: String? = null, val googleEventId: String? = null,
    val timing: String = "habit", val minutesBefore: Int = 0, val allowDuringQuietHours: Boolean = false)
data class Habit(
    val entity: TrackerEntity, val title: String, val createdDate: LocalDate, val schedule: TrackerSchedule,
    val description: String = "", val emoji: String = "✨", val priority: Int = 5,
    val isKeyHabit: Boolean = false, val ritualId: String = "none", val ritualName: String = "",
    val color: String = "#bb8f4a", val active: Boolean = true,
    val sourceTemplateId: String? = null, val sacredPracticeId: String? = null,
    val sacredSectorId: String? = null, val preferredTime: String = "",
    val scoringMode: String = "binary", val qualityScale: String = "none", val reminder: HabitReminder = HabitReminder(),
    val intervalSchedule: HabitIntervalSchedule? = null,
) { val id: String get() = entity.id }

/** The first tracking date and XP formula become immutable after the first save. */
fun preserveHabitCreationSettings(candidate: Habit, previous: Habit?, today: LocalDate): Habit {
    if (previous == null) {
        require(candidate.schedule.startDate >= today) { "Начало привычки не может быть в прошлом." }
        return candidate.copy(createdDate = candidate.schedule.startDate)
    }
    return candidate.copy(
        createdDate = previous.createdDate,
        scoringMode = previous.scoringMode,
        qualityScale = previous.qualityScale,
        schedule = candidate.schedule.copy(startDate = previous.schedule.startDate,
            recurrence = candidate.schedule.recurrence.copy(rangeStart = previous.schedule.recurrence.rangeStart)),
    )
}
data class HabitCompletion(val entity: TrackerEntity, val habitId: String, val date: LocalDate,
    val completed: Boolean = false, val qualityValue: Double? = null, val score: Int = 0,
    val xpAwarded: Int = 0, val note: String = "", val qualityConfirmedAt: String? = null,
    val completedTimes: List<String> = emptyList())

/** Direct port of scoreHabitFormula. XP is distinct from current score. */
fun scoreHabitFormula(mode: String, completed: Boolean, qualityValue: Double?): Int {
    if (!completed || mode == "none") return 0
    return when(mode) {
        "quality-ten" -> jsRound(qualityValue ?: 5.0).coerceIn(1,10)
        "quality-bipolar" -> (10 + 2 * jsRound(qualityValue ?: 0.0).coerceIn(-5,5)).coerceIn(0,20)
        else -> 10
    }
}

fun completionXpAward(previousAward: Double, completionScore: Double, maximum: Double = 20.0): Int =
    maxOf(safeCount(previousAward),safeCount(completionScore)).coerceAtMost(safeCount(maximum))

class HabitEngine(private val calendar: GenesisCalendar) {
    private val recurrence = RecurrenceEngine(calendar)

    fun defaultSchedule(date: LocalDate, mode: CalendarMode): TrackerSchedule {
        val recurrenceMode=when(mode) { CalendarMode.PROFANE -> "classic"; CalendarMode.SACRED -> "genesis"; CalendarMode.LUNAR -> "lunar" }
        val pattern=when(mode) { CalendarMode.PROFANE -> "daily"; CalendarMode.SACRED -> "pyata-days"; CalendarMode.LUNAR -> "lunar-days" }
        val day=when(mode) { CalendarMode.PROFANE -> date.dayOfWeek.value; CalendarMode.SACRED -> (calendar.sacredDate(date).day-1)%5+1; CalendarMode.LUNAR -> calendar.lunarDate(date).day }
        return TrackerSchedule(date,timezone=calendar.zoneId.id,recurrence=RecurrenceConfig(true,recurrenceMode,pattern,listOf(day),rangeStart=date.toString(),calendarContext=ru.genesis.calendar.domain.CalendarContext(timeZone=calendar.zoneId.id)))
    }

    fun normalizeSchedule(schedule: TrackerSchedule): TrackerSchedule {
        val end=schedule.endDate?.takeIf { it >= schedule.startDate }
        return schedule.copy(endDate=end,timezone=schedule.timezone.ifEmpty { calendar.zoneId.id },
            recurrence=recurrence.normalize(schedule.recurrence).copy(calendarContext=schedule.recurrence.calendarContext ?: ru.genesis.calendar.domain.CalendarContext(version=1,timeZone=schedule.timezone.ifEmpty { calendar.zoneId.id }),rangeStart=schedule.startDate.toString(),rangeEnd=end?.toString() ?: ""))
    }

    /** Saved schedule owns its mode. The account display calendar is intentionally absent. */
    fun isScheduled(habit: Habit, date: LocalDate): Boolean {
        val schedule = habit.schedule
        if (!habit.active || date < schedule.startDate || schedule.endDate?.let { date > it } == true) return false
        return recurrence.matches(schedule.startDate.toString(),schedule.recurrence.copy(
            calendarContext=schedule.recurrence.calendarContext ?: ru.genesis.calendar.domain.CalendarContext(version=1,timeZone=schedule.timezone.ifEmpty { calendar.zoneId.id }),
            rangeStart=schedule.startDate.toString(),rangeEnd=schedule.endDate?.toString() ?: ""),
            date.toString(),ignoreRangeEnd=schedule.endDate == null)
    }

    fun score(habit: Habit, entry: HabitCompletion?, date: LocalDate): Int =
        if (entry == null || !isScheduled(habit,date)) 0 else scoreHabitFormula(habit.scoringMode,entry.completed,entry.qualityValue)

    /** Pure operation matching updateHabitCompletion's guarded write, deduplication,
     * version increment and monotonic XP. The caller persists the returned list atomically.
     * Only user-editable fields are accepted, never identity or another habit's ownership.
     */
    fun updateCompletion(entries: List<HabitCompletion>, habit: Habit, date: LocalDate, today: LocalDate,
        completed: Boolean, qualityValue: Double?, note: String,
        timestamp: String = Instant.now().toString(), newId: String = "habit-completion-${UUID.randomUUID()}",
        completedTimes: List<String>? = null): List<HabitCompletion> {
        if (date != today || date < habit.createdDate) return entries
        val current = entries.firstOrNull { it.habitId == habit.id && it.date == date }
        val base = current ?: HabitCompletion(TrackerEntity.create("habit-completion",timestamp,newId),habit.id,date)
        val preservedQuality = if (base.qualityConfirmedAt != null) base.qualityValue else qualityValue
        val score = scoreHabitFormula(habit.scoringMode,completed,preservedQuality)
        val next = base.copy(entity=base.entity.changed(timestamp),completed=completed,qualityValue=preservedQuality,
            note=note,score=score,xpAwarded=completionXpAward(base.xpAwarded.toDouble(),score.toDouble()),
            completedTimes=completedTimes ?: if(habit.intervalSchedule?.completionMode=="each")
                if(completed) habit.intervalSchedule.times() else emptyList() else base.completedTimes)
        return entries.filterNot { it.habitId == habit.id && it.date == date } + next
    }

    fun updateIntervalCompletion(entries: List<HabitCompletion>, habit: Habit, date: LocalDate,
        today: LocalDate, time: String, completed: Boolean): List<HabitCompletion> {
        val schedule = habit.intervalSchedule?.takeIf { it.completionMode == "each" } ?: return entries
        val times = schedule.times()
        if (time !in times) return entries
        val current = entries.firstOrNull { it.habitId == habit.id && it.date == date }
        val marks = habitIntervalMarks(habit, current).toMutableSet()
        if (completed) marks.add(time) else marks.remove(time)
        return updateCompletion(entries, habit, date, today, times.all { it in marks } &&
            (!habit.scoringMode.startsWith("quality") || current?.qualityValue != null), current?.qualityValue,
            current?.note.orEmpty(), completedTimes = marks.sorted())
    }

    fun dailyCounts(habits: List<Habit>, entries: List<HabitCompletion>, date: LocalDate): Pair<Int,Int> {
        val scheduled = habits.filter { isScheduled(it,date) }
        val ids = scheduled.map { it.id }.toSet()
        val completed = entries.filter { it.date == date && it.completed && it.habitId in ids }.map { it.habitId }.toSet().size
        return scheduled.size to completed
    }

    fun dailyGoalForDate(habits: List<Habit>, entries: List<HabitCompletion>, records: List<DailyGoalRecord>,
        modeChanges: List<DailyGoalModeChange>, restDays: Set<LocalDate>, date: LocalDate, today: LocalDate,
        timestamp: String): DailyGoalRecord {
        val existing=records.firstOrNull { it.date == date }
        val mode=if(existing != null && date < today) existing.mode else DailyGoals.modeForDate(modeChanges,date)
        val (scheduled,completed)=dailyCounts(habits,entries,date)
        val next=DailyGoals.build(date,mode,existing?.timezone ?: calendar.zoneId.id,scheduled.toDouble(),completed.toDouble(),
            today,timestamp,isRestDay=date in restDays,isStreakProtected=existing?.status == "protected")
        return if(existing != null && existing.copy(updatedAt=timestamp) == next) existing else next
    }
}
