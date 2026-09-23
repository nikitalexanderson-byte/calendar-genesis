package ru.genesis.calendar.domain.habits

import java.time.LocalDate

data class RewardTransaction(val id: String, val amount: Int, val reason: String, val sourceId: String,
    val idempotencyKey: String, val createdAt: String, val userId: String = "self", val currency: String = "laurels")

/** Port of app/rewards.ts. Rewards are immutable ledger entries, not a mutable counter. */
object Rewards {
    const val DAILY_GOAL_LAURELS = 5
    const val PERFECT_DAY_LAURELS = 3
    val resetReasons = setOf("habit-deleted-reset","habit-missed-reset")
    private val reasons = setOf("daily-goal","perfect-day","daily-quest","weekly-quest","epic-quest",
        "streak-milestone","rank-up","achievement","comeback","hero-path-amphora","hestia-spark",
        "habit-mastery-retained","habit-deleted-reset","habit-missed-reset")

    fun create(amount: Double, reason: String, sourceId: String, key: String, timestamp: String) =
        RewardTransaction("reward:$key",jsRound(amount),reason,sourceId,key,timestamp)

    fun normalize(items: List<RewardTransaction>): List<RewardTransaction> {
        val result = linkedMapOf<String,RewardTransaction>()
        items.forEach { item ->
            val key = item.idempotencyKey.trim(); val source = item.sourceId.trim()
            if(key.isEmpty() || source.isEmpty() || item.currency != "laurels" || item.reason !in reasons) return@forEach
            if(item.amount == 0 && item.reason !in resetReasons && item.reason != "habit-mastery-retained") return@forEach
            val transaction = item.copy(id=item.id.ifEmpty { "reward:$key" },sourceId=source,idempotencyKey=key,userId="self")
            if(result[key]?.let { transaction.createdAt < it.createdAt } != false) result[key]=transaction
        }
        return result.values.sortedWith(compareBy<RewardTransaction> { it.createdAt }.thenBy { it.idempotencyKey })
    }

    fun balance(items: List<RewardTransaction>): Int = normalize(items).fold(0) { balance, tx ->
        if(tx.reason in resetReasons) 0 else balance+tx.amount
    }.coerceAtLeast(0)

    fun retainMastery(items: List<RewardTransaction>, habitId: String, timestamp: String): List<RewardTransaction> {
        val known=normalize(items); val key="habit-mastery-retained:self:$habitId"
        if(known.any { it.idempotencyKey==key }) return known
        return normalize(known+create(0.0,"habit-mastery-retained",habitId,key,timestamp))
    }

    fun reset(items: List<RewardTransaction>, reason: String, sourceId: String, key: String, timestamp: String): List<RewardTransaction> {
        require(reason in resetReasons)
        val known=normalize(items)
        if(known.any { it.idempotencyKey==key }) return known
        return normalize(known+create(-balance(known).toDouble(),reason,sourceId,key,timestamp))
    }

    fun laurelsForDailyGoal(status: String): Int = when(status) { "perfect" -> 8; "qualified" -> 5; else -> 0 }

    fun reconcileDailyGoals(records: List<DailyGoalRecord>, items: List<RewardTransaction>, today: LocalDate): List<RewardTransaction> {
        val transactions=normalize(items).toMutableList()
        val known=transactions.map { it.idempotencyKey }.toMutableSet()
        records.sortedBy { it.date }.forEach { record ->
            if(record.date > today || record.status !in setOf("qualified","perfect")) return@forEach
            fun award(reason: String, amount: Int) {
                val key="$reason:self:${record.date}"
                if(known.add(key)) transactions+=create(amount.toDouble(),reason,record.date.toString(),key,
                    record.updatedAt.ifEmpty { "${record.date}T00:00:00.000Z" })
            }
            award("daily-goal",5)
            if(record.status=="perfect") award("perfect-day",3)
        }
        return normalize(transactions)
    }
}
