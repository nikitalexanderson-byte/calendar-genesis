package ru.genesis.calendar.domain.habits

import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.util.Locale
import java.util.UUID
import java.math.BigDecimal
import java.time.ZoneId

const val MAX_HABIT_MEASUREMENT = 1_000_000_000_000L
data class HabitMeasurement(val kind: String, val unit: String, val target: Long, val quickAdd: Long) {
    init {
        require(kind in setOf("quantity", "duration") && unit.isNotBlank() && unit.length <= 40)
        require(kind != "duration" || unit == "min")
        require(target in 1..MAX_HABIT_MEASUREMENT && quickAdd in 1..MAX_HABIT_MEASUREMENT)
    }
}
data class HabitRuleVersion(val id: String, val effectiveDate: LocalDate, val recordedAt: String,
    val measurement: HabitMeasurement?, val schedule: TrackerSchedule) {
    init { require(id.isNotBlank()); Instant.parse(recordedAt); ZoneId.of(schedule.timezone) }
}
data class HabitMeasurementEvent(val entity: TrackerEntity, val habitId: String, val date: LocalDate,
    val entryId: String, val ruleId: String, val replaces: List<String>, val value: Long?,
    val note: String = "", val source: String = "manual", val historical: Boolean = false) {
    init {
        require(entity.id.isNotBlank() && habitId.isNotBlank() && entryId.isNotBlank() && ruleId.isNotBlank())
        require(value == null || value in 1..MAX_HABIT_MEASUREMENT)
        require(source in setOf("manual", "correction", "timer", "import"))
        require(replaces.distinct().size == replaces.size && replaces.none { it.isBlank() || it == entity.id })
        Instant.parse(entity.createdAt)
    }
}
data class HabitMeasurementEntry(val id: String, val revisions: List<HabitMeasurementEvent>, val heads: List<HabitMeasurementEvent>) {
    val current get() = heads.singleOrNull()
    val conflict get() = heads.size != 1
}
data class HabitMeasurementProgress(val rule: HabitRuleVersion, val entries: List<HabitMeasurementEntry>,
    val total: Long, val incompatible: Boolean, val rewardTotal: Long) {
    val target get() = rule.measurement?.target ?: 0L
    val remaining get() = (target - total).coerceAtLeast(0)
    val completed get() = target > 0 && total >= target && !incompatible && entries.none { it.conflict }
}

object HabitMeasurements {
    fun editValue(value: Long): String = BigDecimal.valueOf(value,3).stripTrailingZeros().toPlainString()
    fun parse(text: String): Long? {
        val match = Regex("^(\\d{1,10})(?:[.,](\\d{1,3}))?$").matchEntire(text.trim()) ?: return null
        val whole = match.groupValues[1].toLongOrNull() ?: return null
        val fraction = match.groupValues[2].padEnd(3, '0').toLongOrNull() ?: 0
        return (whole * 1000 + fraction).takeIf { it in 1..MAX_HABIT_MEASUREMENT }
    }
    fun format(value: Long, language: String): String = NumberFormat.getNumberInstance(Locale.forLanguageTag(language))
        .apply { maximumFractionDigits = 3 }.format(value / 1000.0)
    fun rule(habit: Habit, date: LocalDate): HabitRuleVersion = habit.ruleHistory
        .filter { it.effectiveDate <= date }.maxWithOrNull(compareBy<HabitRuleVersion> { it.effectiveDate }
            .thenBy { it.recordedAt }.thenBy { it.id }) ?: HabitRuleVersion("initial:${habit.id}",
            habit.createdDate, "1970-01-01T00:00:00.000Z", habit.measurement, habit.schedule)

    fun progress(habit: Habit, date: LocalDate, events: List<HabitMeasurementEvent>): HabitMeasurementProgress {
        val rule = rule(habit, date)
        val relevant = events.filter { it.habitId == habit.id && it.date == date }
        val unique = relevant.associateBy { it.entity.id }
        require(unique.size == relevant.size) { "HABIT_MEASUREMENT_ID_CONFLICT" }
        val entries = relevant.groupBy { it.entryId }.map { (id, revisions) ->
            val byId = revisions.associateBy { it.entity.id }
            val visiting = hashSetOf<String>(); val visited = hashSetOf<String>()
            fun validate(event: HabitMeasurementEvent) {
                if (event.entity.id in visited) return
                require(event.entity.id !in visiting && (event.replaces.isNotEmpty() || event.entryId == event.entity.id)) { "INVALID_HABIT_MEASUREMENT_HISTORY" }
                visiting.add(event.entity.id)
                event.replaces.forEach { predecessor -> validate(requireNotNull(byId[predecessor]) { "INVALID_HABIT_MEASUREMENT_HISTORY" }) }
                visiting.remove(event.entity.id); visited.add(event.entity.id)
            }
            revisions.forEach(::validate)
            val replaced = revisions.flatMap { it.replaces }.toSet()
            HabitMeasurementEntry(id, revisions, revisions.filter { it.entity.id !in replaced })
        }
        val incompatible = entries.any { it.current?.let { current -> current.value != null && current.ruleId != rule.id } == true }
        val total = entries.sumOf { entry -> entry.current?.takeIf { it.ruleId == rule.id }?.value ?: 0L }
        require(total in 0..MAX_HABIT_MEASUREMENT) { "HABIT_MEASUREMENT_TOTAL_TOO_LARGE" }
        val rewardTotal = entries.sumOf { entry ->
            val root = entry.revisions.firstOrNull { it.entity.id == entry.id && it.replaces.isEmpty() }
            val current = entry.current
            if(root != null && !root.historical && root.source != "import" && current != null
                && !current.historical && current.source != "import" && current.ruleId == rule.id) current.value ?: 0L else 0L
        }
        return HabitMeasurementProgress(rule, entries, total, incompatible, rewardTotal)
    }

    fun append(habit: Habit, date: LocalDate, value: Long?, events: List<HabitMeasurementEvent>,
        entryId: String? = null, replaces: List<String> = emptyList(), note: String = "",
        operationId: String = "habit-value-${UUID.randomUUID()}", timestamp: String = Instant.now().toString()): List<HabitMeasurementEvent> {
        val rule = rule(habit, date); require(rule.measurement != null)
        events.firstOrNull { it.entity.id == operationId }?.let { existing ->
            require(existing.habitId == habit.id && existing.date == date && existing.value == value
                && existing.entryId == (entryId ?: operationId) && existing.replaces.sorted() == replaces.sorted()) { "HABIT_MEASUREMENT_ID_CONFLICT" }
            return events
        }
        if (entryId != null) {
            val entry = progress(habit, date, events).entries.firstOrNull { it.id == entryId }
            require(entry != null && entry.heads.map { it.entity.id }.sorted() == replaces.sorted()) { "HABIT_MEASUREMENT_EDIT_CONFLICT" }
        } else require(value != null && replaces.isEmpty())
        val next = events + HabitMeasurementEvent(TrackerEntity.create("habit-value", timestamp, operationId),
            habit.id, date, entryId ?: operationId, rule.id, replaces.sorted(), value, note.take(2000),
            if (entryId == null) "manual" else "correction")
        progress(habit, date, next)
        return next
    }

    fun project(habits: List<Habit>, events: List<HabitMeasurementEvent>, completions: List<HabitCompletion>,
        today: LocalDate, timestamp: String): List<HabitCompletion> {
        val output = completions.toMutableList()
        events.groupBy { it.habitId to it.date }.forEach { (key, _) ->
            val habit = habits.firstOrNull { it.id == key.first } ?: return@forEach
            val date = key.second
            if (rule(habit, date).measurement == null) return@forEach
            val state = progress(habit, date, events)
            val base = output.firstOrNull { it.habitId == habit.id && it.date == date }
                ?: HabitCompletion(TrackerEntity.create("habit-completion", timestamp,
                    "habit-completion:${habit.id}:$date"), habit.id, date)
            val completed = state.completed && (habit.qualityScale == "none" || base.qualityConfirmedAt != null)
            val score = scoreHabitFormula(habit.scoringMode, completed, base.qualityValue)
            val eligible = date == today && state.rewardTotal >= state.target
            output.removeAll { it.habitId == habit.id && it.date == date }
            output.add(base.copy(completed = completed, score = score,
                xpAwarded = if (eligible) completionXpAward(base.xpAwarded.toDouble(), score.toDouble()) else base.xpAwarded))
        }
        return output
    }
}
