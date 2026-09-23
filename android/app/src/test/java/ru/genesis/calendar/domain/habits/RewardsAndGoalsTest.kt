package ru.genesis.calendar.domain.habits

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class RewardsAndGoalsTest {
    private val today=LocalDate.of(2026,9,23)
    private val stamp="2026-09-23T10:00:00.000Z"
    private fun history() = webHistoryStatuses.mapIndexed { index,status ->
        val date=LocalDate.of(2026,9,15+index)
        DailyGoalRecord(date,"rhythm","Europe/Moscow",5,when(status) { "perfect" -> 5; "qualified" -> 3; else -> 0 },3,status,"${date}T10:00:00.000Z")
    }

    @Test fun dailyGoalRecordsMatch60ActualWebVectors() {
        webDailyGoalVectors.forEach { line ->
            val v=line.split('|')
            val actual=DailyGoals.build(today.minusDays(1),v[0],"Europe/Moscow",v[1].toDouble(),v[2].toDouble(),today,stamp)
            assertEquals(line,listOf(v[0],v[1],v[2],actual.scheduledCount,actual.completedCount,actual.targetCount,actual.status).joinToString("|"))
        }
    }

    @Test fun historyStreakAndRhythmMatchActualWeb() {
        val actual=DailyGoals.streak(history(),today)
        assertEquals(webHistoryStreak,listOf(actual.currentStreak,actual.longestStreak,actual.lastQualifiedDate.toString()))
        assertEquals(webHistoryRhythm,DailyGoals.rhythmScore(history(),today))
    }

    @Test fun rewardReplayResetAndMasteryMatchActualWebStages() {
        var ledger=Rewards.reconcileDailyGoals(history(),emptyList(),today)
        fun check(index: Int) { assertEquals(webRewardStages[index],"${Rewards.balance(ledger)}|${ledger.joinToString(";") { "${it.idempotencyKey}=${it.amount}" }}") }
        check(0)
        ledger=Rewards.reconcileDailyGoals(history(),ledger,today); check(1)
        ledger=Rewards.reset(ledger,"habit-missed-reset","h1","habit-missed-reset:self:h1:2026-09-23",stamp); check(2)
        ledger=Rewards.retainMastery(ledger,"h1","2026-09-23T10:01:00.000Z"); check(3)
        ledger=Rewards.retainMastery(ledger,"h1","2026-09-23T10:02:00.000Z"); check(4)
    }

    @Test fun duplicateRewardUsesEarliestVersionAndZeroMarkersSurvive() {
        val original=Rewards.create(5.0,"daily-goal","2026-09-23","daily-goal:self:2026-09-23",stamp)
        val replay=original.copy(amount=999,createdAt="2026-09-23T11:00:00.000Z")
        assertEquals(listOf(original),Rewards.normalize(listOf(replay,original,replay)))
        assertEquals(emptyList<RewardTransaction>(),Rewards.normalize(listOf(original.copy(amount=0))))
        assertEquals(1,Rewards.reset(emptyList(),"habit-deleted-reset","h1","reset-h1",stamp).size)
    }

    @Test fun futureAndUnqualifiedRecordsDoNotAwardAndStatusPrecedenceIsPreserved() {
        val future=DailyGoals.build(today.plusDays(1),"perfect","UTC",1.0,1.0,today,stamp)
        assertEquals(emptyList<RewardTransaction>(),Rewards.reconcileDailyGoals(listOf(future),emptyList(),today))
        assertEquals("rest",DailyGoals.build(today,"easy","",1.0,1.0,today,stamp,true,true,true).status)
        assertEquals("timezone-shift",DailyGoals.build(today,"easy","",1.0,1.0,today,stamp,false,true,true).status)
        assertEquals("protected",DailyGoals.build(today,"easy","",1.0,1.0,today,stamp,false,false,true).status)
        assertEquals("open",DailyGoals.build(today,"perfect","UTC",2.0,0.0,today,stamp).status)
    }

    @Test fun modeAndHistoryNormalizationChooseLatestTimestamp() {
        val changes=listOf(DailyGoalModeChange(today,"perfect",stamp),DailyGoalModeChange(today,"easy","2026-09-23T11:00:00.000Z"))
        assertEquals("easy",DailyGoals.modeForDate(DailyGoals.normalizeModeChanges(changes),today))
        val old=history().first()
        val newer=old.copy(status="qualified",updatedAt=stamp)
        assertEquals(listOf(newer),DailyGoals.normalize(listOf(newer,old)))
    }
}
