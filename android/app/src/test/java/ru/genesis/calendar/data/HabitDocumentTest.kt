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
        description="Строка 1\nСтрока 2",reminder=HabitReminder(googleTaskId="opaque-test-binding"))

    @Test fun documentRoundTripPreservesScheduleIdentityBindingsHistoryAndLedger() {
        val habit=habit()
        val entries=engine.updateCompletion(emptyList(),habit,day,day,true,null,"Тест",stamp,"completion-1")
        val workspace=reconcileHabitWorkspace(LocalHabitWorkspace(listOf(habit),entries,revision=4),day,"Europe/Moscow",stamp)
        assertEquals(workspace,HabitDocument.decode(HabitDocument.encode(workspace),4))
        assertEquals(10,workspace.progress.lifetimeXp)
        assertEquals(8,workspace.progress.laurelsBalance)
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

    @Test fun missedDayNeverResetsLaurelsAndLifetimeXpRemains() {
        val h=habit()
        val entries=engine.updateCompletion(emptyList(),h,day,day,true,null,"",stamp,"c1")
        val first=reconcileHabitWorkspace(LocalHabitWorkspace(listOf(h),entries),day,"Europe/Moscow",stamp)
        val afterMissing=reconcileHabitWorkspace(first,day.plusDays(2),"Europe/Moscow","2026-09-25T10:00:00.000Z")
        assertEquals(8,afterMissing.progress.laurelsBalance)
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
}
