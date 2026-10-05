package ru.genesis.calendar.data

import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import ru.genesis.calendar.domain.*
import ru.genesis.calendar.domain.habits.*

class HabitDocumentTest {
    private val day=LocalDate.of(2026,9,23)
    private val stamp="2026-09-23T10:00:00.000Z"
    private val engine=HabitEngine(GenesisCalendar(ZoneId.of("Europe/Moscow")))
    private fun habit()=Habit(TrackerEntity("h1",stamp,stamp),"Тест \"кавычки\" ☀",day,engine.defaultSchedule(day,CalendarMode.PROFANE),
        description="Строка 1\nСтрока 2",reminder=HabitReminder(googleTaskId="opaque-test-binding",
            timing="custom",minutesBefore=15,allowDuringQuietHours=true))

    @Test fun documentRoundTripPreservesScheduleIdentityBindingsHistoryAndLedger() {
        val habit=habit()
        val entries=engine.updateCompletion(emptyList(),habit,day,day,true,null,"Тест",stamp,"completion-1")
        val workspace=reconcileHabitWorkspace(LocalHabitWorkspace(listOf(habit),entries,revision=4),day,"Europe/Moscow",stamp)
        assertEquals(workspace,HabitDocument.decode(HabitDocument.encode(workspace),4))
        assertEquals(10,workspace.progress.lifetimeXp)
        assertEquals(11,workspace.progress.laurelsBalance) // 8 for perfect day + 3 daily trial
        val replay=reconcileHabitWorkspace(workspace,day,"Europe/Moscow",stamp)
        assertEquals(workspace,replay)
    }

    @Test fun pauseAndResumeMetadataSurvivesRoundTrip() {
        val h=habit().copy(active=false,scoringMode="quality-bipolar",qualityScale="bipolar",isKeyHabit=true,
            sacredPracticeId="practice-test",sacredSectorId="sector-test",sourceTemplateId="daily-plan",
            schedule=habit().schedule.copy(endDate=day.plusDays(9),recurrence=RecurrenceConfig(true,"lunar","lunar-days",days=listOf(1,29,30),months=listOf(2))))
        val w=LocalHabitWorkspace(habits=listOf(h))
        assertEquals(w,HabitDocument.decode(HabitDocument.encode(w),0))
    }

    @Test fun websiteHabitPersonalizationAndGoogleChoicesSurviveRoundTrip() {
        val configured = habit().copy(emoji="🧘",color="#2d7771",isKeyHabit=true,
            ritualId="custom",ritualName="Восстановление",
            reminder=HabitReminder(enabled=true,time="07:30",syncToGoogleTasks=true,
                showInGoogleCalendar=true,googleTaskId="habit-task",googleEventId="habit-event"))
        val restored=HabitDocument.decode(HabitDocument.encode(LocalHabitWorkspace(habits=listOf(configured))),0)
            .habits.single()
        assertEquals(configured,restored)
    }

    @Test fun achievementUnlockPersistsAfterCompletionIsRemovedAndLegacyDocumentDecodes() {
        val h = habit()
        val entries = engine.updateCompletion(emptyList(), h, day, day, true, null, "", stamp, "unlock-1")
        val first = reconcileHabitWorkspace(LocalHabitWorkspace(listOf(h), entries), day,
            "Europe/Moscow", stamp)
        assertTrue(first.achievementUnlocks.any { it.achievementId == "first-step" })
        val removed = reconcileHabitWorkspace(first.copy(completions = emptyList()), day,
            "Europe/Moscow", "2026-09-23T11:00:00.000Z")
        assertEquals(first.achievementUnlocks, removed.achievementUnlocks)
        val legacy = JSONObject(HabitDocument.encode(first)).apply { remove("achievementUnlocks") }
        assertTrue(HabitDocument.decode(legacy.toString(), 0).achievementUnlocks.isEmpty())
    }

    @Test fun hestiaTransactionsSurviveEncryptedDocumentFormatAndLegacyDocumentDecodes() {
        val freeze = StreakFreezeTransaction(1, "purchase", "p1",
            "hestia-spark-purchase:self:p1", stamp)
        val workspace = LocalHabitWorkspace(streakFreezeTransactions = listOf(freeze))
        assertEquals(workspace, HabitDocument.decode(HabitDocument.encode(workspace), 0))
        val legacy = JSONObject(HabitDocument.encode(workspace)).apply { remove("streakFreezeTransactions") }
        assertTrue(HabitDocument.decode(legacy.toString(), 0).streakFreezeTransactions.isEmpty())
    }

    @Test fun questIdentityProgressAndRewardSurviveDocumentRoundTrip() {
        val h = habit()
        val first = reconcileHabitWorkspace(LocalHabitWorkspace(habits = listOf(h)), day,
            "Europe/Moscow", stamp)
        assertEquals(3, first.quests.size)
        assertEquals(first, HabitDocument.decode(HabitDocument.encode(first), first.revision))
        val legacy = JSONObject(HabitDocument.encode(first)).apply { remove("quests") }
        assertTrue(HabitDocument.decode(legacy.toString(), 0).quests.isEmpty())
        val entry = engine.updateCompletion(emptyList(), h, day, day, true, null, "", stamp, "quest-1")
        val completed = reconcileHabitWorkspace(first.copy(completions = entry), day,
            "Europe/Moscow", stamp)
        assertTrue(completed.quests.any { it.cadence == "daily" && it.completedAt != null })
        assertEquals(3, completed.rewards.filter { it.reason == "daily-quest" }.sumOf { it.amount })
        assertEquals(completed.rewards, reconcileHabitWorkspace(completed, day,
            "Europe/Moscow", stamp).rewards)
    }

    @Test fun disablingQuestsPreservesExistingProgressWithoutAdvancingOrPayingIt() {
        val h = habit()
        val initial = reconcileHabitWorkspace(LocalHabitWorkspace(habits = listOf(h)), day,
            "Europe/Moscow", stamp)
        assertEquals(3, initial.quests.size)
        val entry = engine.updateCompletion(emptyList(), h, day, day, true, null, "", stamp, "quest-disabled")
        val disabledSettings = initial.settings.copy(feedback = initial.settings.feedback.copy(questsEnabled = false))
        val disabled = reconcileHabitWorkspace(initial.copy(completions = entry, settings = disabledSettings), day,
            "Europe/Moscow", "2026-09-23T11:00:00.000Z")
        assertEquals(initial.quests, disabled.quests)
        assertFalse(disabled.rewards.any { it.reason.endsWith("quest") })
    }

    @Test fun closingNewMissConsumesPurchasedSparkWithoutXpOrFalseCompletion() {
        val h = habit()
        val entries = engine.updateCompletion(emptyList(), h, day, day, true, null, "", stamp, "c-protected")
        val first = reconcileHabitWorkspace(LocalHabitWorkspace(listOf(h), entries), day,
            "Europe/Moscow", stamp)
        val bonus = Rewards.create(200.0, "comeback", "seed", "seed-comeback", stamp)
        val (paid, freezes) = StreakProtection.purchase(first.rewards + bonus, emptyList(),
            "purchase-test", stamp)
        val purchased = reconcileHabitWorkspace(first.copy(rewards = paid,
            streakFreezeTransactions = freezes), day, "Europe/Moscow", stamp)
        val next = reconcileHabitWorkspace(purchased, day.plusDays(2), "Europe/Moscow",
            "2026-09-25T10:00:00.000Z")
        val missed = next.goals.single { it.date == day.plusDays(1) }
        assertEquals("protected", missed.status)
        assertEquals(0, missed.completedCount)
        assertEquals(10, next.progress.lifetimeXp)
        assertEquals(0, next.progress.streakFreezeCount)
        assertEquals(1, next.progress.currentStreak)
        assertEquals(next, HabitDocument.decode(HabitDocument.encode(next), next.revision))
        assertEquals(next.rewards, reconcileHabitWorkspace(next, day.plusDays(2),
            "Europe/Moscow", "2026-09-25T11:00:00.000Z").rewards)
    }

    @Test fun missedDayNeverResetsLaurelsAndLifetimeXpRemains() {
        val h=habit()
        val entries=engine.updateCompletion(emptyList(),h,day,day,true,null,"",stamp,"c1")
        val first=reconcileHabitWorkspace(LocalHabitWorkspace(listOf(h),entries),day,"Europe/Moscow",stamp)
        val afterMissing=reconcileHabitWorkspace(first,day.plusDays(2),"Europe/Moscow","2026-09-25T10:00:00.000Z")
        assertEquals(11,afterMissing.progress.laurelsBalance)
        assertEquals(10,afterMissing.progress.lifetimeXp)
        assertEquals(0,afterMissing.rewards.count { it.reason=="habit-missed-reset" })
        val replay=reconcileHabitWorkspace(afterMissing,day.plusDays(2),"Europe/Moscow","2026-09-25T11:00:00.000Z")
        assertEquals(afterMissing.rewards,replay.rewards)
        assertEquals(afterMissing.progress,replay.progress)
    }

    @Test fun futureSchemaOrCorruptJsonNeverBecomesAnEmptyReplacementWorkspace() {
        assertThrows(Exception::class.java) { HabitDocument.decode("{}",1) }
        assertThrows(IllegalArgumentException::class.java) { HabitDocument.decode("{\"localSchema\":999}",1) }
    }

    @Test fun webCompatibleSettingsAndHiddenTemplatesSurviveRoundTrip() {
        val raw = JSONObject().put("enabled", true).put("reportRange", "quarter")
            .put("notifications", JSONObject().put("enabled", true).put("motivational", false)
                .put("tone", "heroic").put("dailyGoalTime", "19:45")
                .put("quietHoursStart", "23:00").put("quietHoursEnd", "06:30"))
            .put("feedback", JSONObject().put("animations", false).put("sound", true)
                .put("haptics", true).put("achievementPopups", false)
                .put("questsEnabled", false).put("gamificationWidgets", false))
        val settings = HabitSettings(true,
            HabitNotificationSettings(true, false, "heroic", "19:45", "23:00", "06:30"),
            HabitFeedbackSettings(false, true, true, false, false, false), raw.toString())
        val workspace = LocalHabitWorkspace(settings = settings,
            hiddenDefaultTemplates = listOf("daily-plan"))
        val decoded = HabitDocument.decode(HabitDocument.encode(workspace), 0)
        assertEquals(settings.enabled, decoded.settings.enabled)
        assertEquals(settings.notifications, decoded.settings.notifications)
        assertEquals(settings.feedback, decoded.settings.feedback)
        assertEquals("quarter", JSONObject(decoded.settings.rawJson).getString("reportRange"))
        assertEquals(listOf("daily-plan"), decoded.hiddenDefaultTemplates)
    }

    @Test fun deletionRemovesHabitHistoryAndAppliesWebLaurelThreshold() {
        val h = habit()
        fun completions(count: Int) = (0 until count).map { offset ->
            HabitCompletion(TrackerEntity("c$offset",stamp,stamp),h.id,day.plusDays(offset.toLong()),true,
                score=10,xpAwarded=10)
        }
        val reward = Rewards.create(25.0,"comeback","seed","seed-reward",stamp)
        val early = deleteHabitFromWorkspace(LocalHabitWorkspace(habits=listOf(h),
            completions=completions(49),rewards=listOf(reward)),h.id,"2026-09-26T10:00:00Z")
        assertTrue(early.habits.isEmpty())
        assertTrue(early.completions.isEmpty())
        assertEquals(0,Rewards.balance(early.rewards))
        assertTrue(early.rewards.any { it.reason=="habit-deleted-reset" })

        val mastered = deleteHabitFromWorkspace(LocalHabitWorkspace(habits=listOf(h),
            completions=completions(50),rewards=listOf(reward)),h.id,"2026-09-26T10:00:00Z")
        assertEquals(25,Rewards.balance(mastered.rewards))
        assertTrue(mastered.rewards.any { it.reason=="habit-mastery-retained" })
    }
}
