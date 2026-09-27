package ru.genesis.calendar.data

import androidx.room.withTransaction
import java.time.*
import java.util.UUID
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.Dispatchers
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.domain.*
import ru.genesis.calendar.domain.habits.*

data class HabitNotificationSettings(val enabled: Boolean = false, val motivational: Boolean = true,
    val tone: String = "calm", val dailyGoalTime: String = "20:30",
    val quietHoursStart: String = "22:00", val quietHoursEnd: String = "07:30")

data class HabitFeedbackSettings(val animations: Boolean = true, val sound: Boolean = false,
    val haptics: Boolean = false, val achievementPopups: Boolean = true,
    val questsEnabled: Boolean = true, val gamificationWidgets: Boolean = true)

private fun defaultHabitSettingsJson() = JSONObject().put("enabled", true)
    .put("notifications", JSONObject().put("enabled", false).put("motivational", true)
        .put("tone", "calm").put("dailyGoalTime", "20:30")
        .put("quietHoursStart", "22:00").put("quietHoursEnd", "07:30"))
    .put("feedback", JSONObject().put("animations", true).put("sound", false)
        .put("haptics", false).put("achievementPopups", true).put("questsEnabled", true)
        .put("gamificationWidgets", true)).toString()

data class HabitSettings(val enabled: Boolean = true,
    val notifications: HabitNotificationSettings = HabitNotificationSettings(),
    val feedback: HabitFeedbackSettings = HabitFeedbackSettings(), val rawJson: String = defaultHabitSettingsJson())

data class HabitCompletionResult(val newlyUnlockedAchievements: Int = 0)

data class LocalHabitWorkspace(val habits: List<Habit> = emptyList(), val completions: List<HabitCompletion> = emptyList(),
    val goals: List<DailyGoalRecord> = emptyList(), val rewards: List<RewardTransaction> = emptyList(),
    val progress: UserProgress = UserProgress(), val revision: Long = 0,
    val achievementUnlocks: List<AchievementUnlock> = emptyList(),
    val streakFreezeTransactions: List<StreakFreezeTransaction> = emptyList(),
    val quests: List<HabitQuest> = emptyList(), val settings: HabitSettings = HabitSettings(),
    val hiddenDefaultTemplates: List<String> = emptyList())

internal const val HABIT_LAUREL_RETENTION_COMPLETIONS = 50

internal fun habitCompletionCount(completions: List<HabitCompletion>, habitId: String): Int = completions
    .asSequence().filter { it.habitId == habitId && it.completed }.map { it.date }.distinct().count()

internal fun deleteHabitFromWorkspace(workspace: LocalHabitWorkspace, habitId: String,
    timestamp: String): LocalHabitWorkspace {
    if (workspace.habits.none { it.id == habitId }) return workspace
    val retained = habitCompletionCount(workspace.completions, habitId) >= HABIT_LAUREL_RETENTION_COMPLETIONS
    val rewards = if (retained) Rewards.retainMastery(workspace.rewards, habitId, timestamp)
        else Rewards.reset(workspace.rewards, "habit-deleted-reset", habitId,
            "habit-deleted:self:$habitId", timestamp)
    return workspace.copy(habits = workspace.habits.filterNot { it.id == habitId },
        completions = workspace.completions.filterNot { it.habitId == habitId }, rewards = rewards)
}

/** Local draft scope only. This document is not a cloud schema-16 import/sync adapter. */
class HabitsRepository(private val app: GenesisApplication) {
    private val db=app.database
    private val dao=db.dao()
    private val cipher=LocalCipher()
    private val scope=app.workspaceScope
    private fun engine()=HabitEngine(GenesisCalendar(ZoneId.systemDefault()))
    val workspace=dao.observeDocument(scope,"habits").map { record ->
        if(record == null) LocalHabitWorkspace() else HabitDocument.decode(cipher.decrypt(record.encrypted,"$scope/habits"),record.revision)
    }.flowOn(Dispatchers.IO)

    private suspend fun mutate(change: (LocalHabitWorkspace) -> LocalHabitWorkspace): Pair<LocalHabitWorkspace, LocalHabitWorkspace> {
        lateinit var mutation: Pair<LocalHabitWorkspace, LocalHabitWorkspace>
        db.withTransaction {
            val record=dao.document(scope,"habits")
            val current=if(record==null) LocalHabitWorkspace() else HabitDocument.decode(cipher.decrypt(record.encrypted,"$scope/habits"),record.revision)
            val next=reconcile(change(current)).copy(revision=current.revision+1)
            dao.putDocument(DocumentRecord(scope,"habits",cipher.encrypt(HabitDocument.encode(next),"$scope/habits"),next.revision))
            if (scope.startsWith("account-")) dao.putOutbox(OutboxRecord(scope,"habits",next.revision,UUID.randomUUID().toString()))
            mutation = current to next
        }
        app.scheduler.restoreHabitNotifications()
        return mutation
    }

    suspend fun refresh() { if(dao.document(scope,"habits") != null) mutate { it } }

    suspend fun updateSettings(settings: HabitSettings) = mutate { it.copy(settings = settings) }

    suspend fun restoreDefaultTemplates() = mutate { it.copy(hiddenDefaultTemplates = emptyList()) }

    suspend fun resetTracking() = mutate { workspace ->
        LocalHabitWorkspace(revision = workspace.revision, settings = workspace.settings.copy(
            rawJson = JSONObject(workspace.settings.rawJson).apply {
                put("dailyGoalModeChanges", JSONArray())
                put("plannedRestDays", JSONArray())
            }.toString()))
    }

    suspend fun save(habit: Habit) = mutate { workspace ->
        require(habit.title.isNotBlank() && habit.title.length<=500) { "Введите название до 500 символов." }
        require(habit.priority in 1..10)
        require(habit.scoringMode in setOf("none","binary","quality-ten","quality-bipolar"))
        val previous=workspace.habits.firstOrNull { it.id==habit.id }
        require(previous==null || previous.entity.version==habit.entity.version) { "Привычка изменилась. Откройте её заново." }
        val saved=habit.copy(entity=habit.entity.changed(Instant.now().toString()),
            createdDate=previous?.createdDate ?: LocalDate.now(),schedule=engine().normalizeSchedule(habit.schedule))
        workspace.copy(habits=workspace.habits.filterNot { it.id==habit.id }+saved)
    }

    suspend fun delete(id: String) {
        mutate { workspace -> deleteHabitFromWorkspace(workspace, id, Instant.now().toString()) }
        app.scheduler.restore()
    }

    suspend fun complete(id: String, completed: Boolean, quality: Double? = null): HabitCompletionResult {
        val (before, after) = mutate { workspace ->
            val habit=workspace.habits.firstOrNull { it.id==id } ?: error("Привычка не найдена")
            val today=LocalDate.now()
            require(engine().isScheduled(habit,today)) { "Сегодня привычка не запланирована." }
            val existing=workspace.completions.firstOrNull { it.habitId==id && it.date==today }
            val entries=if(existing!=null && existing.completed==completed && existing.qualityValue==quality) workspace.completions else
                engine().updateCompletion(workspace.completions,habit,today,today,completed,quality,existing?.note ?: "")
            workspace.copy(completions=entries)
        }
        val known = before.achievementUnlocks.mapTo(hashSetOf()) { it.achievementId }
        return HabitCompletionResult(after.achievementUnlocks.count { it.achievementId !in known })
    }

    suspend fun claimHeroPathAmphora(rankId: String) = mutate { workspace ->
        workspace.copy(rewards = HeroPathRewards.claim(workspace.progress, workspace.rewards,
            rankId, Instant.now().toString()))
    }

    suspend fun buyHestiaSpark() = mutate { workspace ->
        val (rewards, freezes) = StreakProtection.purchase(workspace.rewards,
            workspace.streakFreezeTransactions, UUID.randomUUID().toString(), Instant.now().toString())
        workspace.copy(rewards = rewards, streakFreezeTransactions = freezes)
    }

    suspend fun revealHiddenHeroicPath() = mutate { workspace ->
        val current = workspace.progress
        require(HeroProgress.hiddenUnlocked(current.lifetimeXp)) { "Врата ещё закрыты." }
        if (current.hiddenHeroicPathRevealedAt != null) workspace else workspace.copy(
            progress = current.copy(hiddenHeroicPathRevealedAt = Instant.now().toString()))
    }

    private fun reconcile(workspace: LocalHabitWorkspace) = reconcileHabitWorkspace(workspace,LocalDate.now(),ZoneId.systemDefault().id,Instant.now().toString())
}

    /** Local day closing, automatic protection and deterministic reward reconciliation. */
    internal fun reconcileHabitWorkspace(workspace: LocalHabitWorkspace, today: LocalDate, zone: String, timestamp: String): LocalHabitWorkspace {
        fun engine()=HabitEngine(GenesisCalendar(ZoneId.of(zone)))
        val previous=DailyGoals.normalize(workspace.goals)
        val protectableDates=mutableSetOf<LocalDate>()
        val timezoneBoundary=previous.lastOrNull { it.date<=today }?.takeIf { it.timezone!=zone }?.let { today.minusDays(1) }
        var goals=previous.map { record ->
            if(record.status=="open" && record.date<today) DailyGoals.build(record.date,record.mode,record.timezone,
                record.scheduledCount.toDouble(),record.completedCount.toDouble(),today,record.updatedAt,
                isTimezoneShift=record.date==timezoneBoundary).also {
                    if(it.status=="missed") protectableDates += it.date
                } else record
        }
        val latest=goals.lastOrNull { it.date<=today }?.date
        val earliest=(workspace.habits.filter { it.active }.map { it.schedule.startDate }+workspace.completions.map { it.date }).minOrNull()
        var cursor=latest?.plusDays(1) ?: earliest?.coerceAtLeast(today.minusDays(3699)) ?: today
        while(cursor<=today) {
            var record=engine().dailyGoalForDate(workspace.habits,workspace.completions,goals,emptyList(),emptySet(),cursor,today,timestamp)
            if(cursor==timezoneBoundary) record=record.copy(timezone=zone,status="timezone-shift")
            if(record.status=="missed") protectableDates += record.date
            goals=DailyGoals.normalize(goals+record)
            cursor=cursor.plusDays(1)
        }
        val current=engine().dailyGoalForDate(workspace.habits,workspace.completions,goals,emptyList(),emptySet(),today,today,timestamp)
        goals=DailyGoals.normalize(goals.filterNot { it.date==today }+current)
        val (protectedGoals, freezes)=StreakProtection.protect(goals,workspace.streakFreezeTransactions,
            protectableDates,today,timestamp)
        goals=protectedGoals
        // The website retired per-missed-habit Laurel resets. Normalization also repairs old
        // local ledgers by ignoring those entries without discarding legitimate awards.
        val questsEnabled = workspace.settings.feedback.questsEnabled
        val quests=if (questsEnabled) HabitQuests.reconcile(workspace.quests,workspace.habits,workspace.completions,
            goals,today,timestamp) { habit,date -> engine().isScheduled(habit,date) } else workspace.quests
        val nonQuestLedger=StreakProtection.reconcileComeback(goals,
            StreakRewards.reconcile(goals,Rewards.reconcileDailyGoals(goals,workspace.rewards,today)),today)
        val ledger=if (questsEnabled) HabitQuests.reconcileRewards(quests,nonQuestLedger) else nonQuestLedger
        val progress=HeroProgress.reconcile(workspace.progress,workspace.completions.map { it.xpAwarded },timestamp,
            DailyGoals.streak(goals,today),Rewards.balance(ledger),streakFreezeCount=StreakProtection.count(freezes),
            rhythmScore=DailyGoals.rhythmScore(goals,today))
        val unlocks=Achievements.reconcile(workspace.achievementUnlocks,workspace.completions,goals,
            progress.longestStreak,ledger,timestamp)
        return workspace.copy(goals=goals,rewards=ledger,progress=progress,achievementUnlocks=unlocks,
            streakFreezeTransactions=freezes,quests=quests)
    }
/** Explicit local format, never presented as the full synced HabitWorkspace schema. */
internal object HabitDocument {
    private fun JSONArray.objects()=(0 until length()).map { getJSONObject(it) }
    private fun ints(array: JSONArray)=(0 until array.length()).map { array.getInt(it) }
    private fun JSONObject.nullable(key: String)=if(isNull(key)) null else getString(key)
    private fun entity(v: JSONObject)=TrackerEntity(v.getString("id"),v.getString("createdAt"),v.getString("updatedAt"),v.getInt("version"),v.getString("syncState"))
    private fun entity(e: TrackerEntity)=JSONObject().put("id",e.id).put("createdAt",e.createdAt).put("updatedAt",e.updatedAt).put("version",e.version).put("syncState",e.syncState)
    private fun recurrence(c: RecurrenceConfig)=JSONObject().put("enabled",c.enabled).put("mode",c.mode).put("pattern",c.pattern).put("days",JSONArray(c.days))
        .put("interval",c.interval).put("rangeStart",c.rangeStart).put("rangeEnd",c.rangeEnd).put("months",JSONArray(c.months)).put("pyatas",JSONArray(c.pyatas))
    private fun recurrence(c: JSONObject)=RecurrenceConfig(c.getBoolean("enabled"),c.getString("mode"),c.getString("pattern"),ints(c.getJSONArray("days")),
        c.getInt("interval"),c.getString("rangeStart"),c.getString("rangeEnd"),ints(c.getJSONArray("months")),ints(c.getJSONArray("pyatas")))
    private fun habit(h: Habit): JSONObject = entity(h.entity).put("title",h.title).put("description",h.description).put("createdDate",h.createdDate.toString())
        .put("emoji",h.emoji).put("priority",h.priority).put("isKeyHabit",h.isKeyHabit).put("ritualId",h.ritualId).put("ritualName",h.ritualName).put("color",h.color)
        .put("active",h.active).put("sourceTemplateId",h.sourceTemplateId ?: JSONObject.NULL).put("sacredPracticeId",h.sacredPracticeId ?: JSONObject.NULL)
        .put("sacredSectorId",h.sacredSectorId ?: JSONObject.NULL).put("preferredTime",h.preferredTime).put("scoringMode",h.scoringMode).put("qualityScale",h.qualityScale)
        .put("schedule",JSONObject().put("startDate",h.schedule.startDate.toString()).put("endDate",h.schedule.endDate?.toString() ?: JSONObject.NULL)
            .put("timezone",h.schedule.timezone).put("recurrence",recurrence(h.schedule.recurrence)))
        .put("reminder",JSONObject().put("enabled",h.reminder.enabled).put("time",h.reminder.time).put("syncToGoogleTasks",h.reminder.syncToGoogleTasks)
            .put("showInGoogleCalendar",h.reminder.showInGoogleCalendar).put("googleTaskId",h.reminder.googleTaskId ?: JSONObject.NULL).put("googleEventId",h.reminder.googleEventId ?: JSONObject.NULL))
    private fun habit(v: JSONObject): Habit {
        val s=v.getJSONObject("schedule"); val r=v.getJSONObject("reminder")
        return Habit(entity(v),v.getString("title"),LocalDate.parse(v.getString("createdDate")),
            TrackerSchedule(LocalDate.parse(s.getString("startDate")),s.nullable("endDate")?.let(LocalDate::parse),s.getString("timezone"),recurrence(s.getJSONObject("recurrence"))),
            v.getString("description"),v.getString("emoji"),v.getInt("priority"),v.getBoolean("isKeyHabit"),v.getString("ritualId"),v.getString("ritualName"),v.getString("color"),
            v.getBoolean("active"),v.nullable("sourceTemplateId"),v.nullable("sacredPracticeId"),v.nullable("sacredSectorId"),v.getString("preferredTime"),v.getString("scoringMode"),v.getString("qualityScale"),
            HabitReminder(r.getBoolean("enabled"),r.getString("time"),r.getBoolean("syncToGoogleTasks"),r.getBoolean("showInGoogleCalendar"),r.nullable("googleTaskId"),r.nullable("googleEventId")))
    }
    fun encode(w: LocalHabitWorkspace): String {
        val p=w.progress
        return JSONObject().put("localSchema",1).put("habits",JSONArray(w.habits.map(::habit)))
            .put("completions",JSONArray(w.completions.map { c -> entity(c.entity).put("habitId",c.habitId).put("date",c.date.toString()).put("completed",c.completed)
                .put("qualityValue",c.qualityValue ?: JSONObject.NULL).put("score",c.score).put("xpAwarded",c.xpAwarded).put("note",c.note) }))
            .put("goals",JSONArray(w.goals.map { g -> JSONObject().put("date",g.date.toString()).put("mode",g.mode).put("timezone",g.timezone).put("scheduledCount",g.scheduledCount)
                .put("completedCount",g.completedCount).put("targetCount",g.targetCount).put("status",g.status).put("updatedAt",g.updatedAt) }))
            .put("rewards",JSONArray(w.rewards.map { t -> JSONObject().put("id",t.id).put("amount",t.amount).put("reason",t.reason).put("sourceId",t.sourceId)
                .put("idempotencyKey",t.idempotencyKey).put("createdAt",t.createdAt).put("userId",t.userId).put("currency",t.currency) }))
            .put("achievementUnlocks",JSONArray(w.achievementUnlocks.map { unlock ->
                JSONObject().put("achievementId",unlock.achievementId).put("unlockedAt",unlock.unlockedAt) }))
            .put("streakFreezeTransactions",JSONArray(w.streakFreezeTransactions.map { item ->
                JSONObject().put("amount",item.amount).put("reason",item.reason).put("sourceId",item.sourceId)
                    .put("idempotencyKey",item.idempotencyKey).put("createdAt",item.createdAt) }))
            .put("quests",JSONArray(w.quests.map { q -> entity(q.entity).put("cadence",q.cadence)
                .put("kind",q.kind).put("habitId",q.habitId ?: JSONObject.NULL)
                .put("startDate",q.startDate.toString()).put("endDate",q.endDate.toString())
                .put("target",q.target).put("progress",q.progress).put("rewardLaurels",q.rewardLaurels)
                .put("completedAt",q.completedAt ?: JSONObject.NULL) }))
            .put("settings", settings(w.settings))
            .put("hiddenDefaultTemplates", JSONArray(w.hiddenDefaultTemplates))
            .put("progress",JSONObject().put("lifetimeXp",p.lifetimeXp).put("laurelsBalance",p.laurelsBalance).put("currentRankId",p.currentRankId ?: JSONObject.NULL)
                .put("hiddenHeroicPathRevealedAt",p.hiddenHeroicPathRevealedAt ?: JSONObject.NULL).put("currentStreak",p.currentStreak).put("longestStreak",p.longestStreak)
                .put("lastQualifiedDate",p.lastQualifiedDate?.toString() ?: JSONObject.NULL).put("streakGoalMode",p.streakGoalMode).put("streakFreezeCount",p.streakFreezeCount)
                .put("rhythmScore",p.rhythmScore).put("updatedAt",p.updatedAt)).toString()
    }
    fun decode(json: String, revision: Long): LocalHabitWorkspace {
        val v=JSONObject(json); require(v.getInt("localSchema")==1) { "Неподдерживаемая версия локальных привычек" }
        val p=v.getJSONObject("progress")
        return LocalHabitWorkspace(v.getJSONArray("habits").objects().map(::habit),v.getJSONArray("completions").objects().map { c ->
            HabitCompletion(entity(c),c.getString("habitId"),LocalDate.parse(c.getString("date")),c.getBoolean("completed"),if(c.isNull("qualityValue")) null else c.getDouble("qualityValue"),c.getInt("score"),c.getInt("xpAwarded"),c.getString("note")) },
            v.getJSONArray("goals").objects().map { g -> DailyGoalRecord(LocalDate.parse(g.getString("date")),g.getString("mode"),g.getString("timezone"),g.getInt("scheduledCount"),g.getInt("completedCount"),g.getInt("targetCount"),g.getString("status"),g.getString("updatedAt")) },
            v.getJSONArray("rewards").objects().map { t -> RewardTransaction(t.getString("id"),t.getInt("amount"),t.getString("reason"),t.getString("sourceId"),t.getString("idempotencyKey"),t.getString("createdAt"),t.getString("userId"),t.getString("currency")) },
            UserProgress(p.getInt("lifetimeXp"),p.getInt("laurelsBalance"),p.nullable("currentRankId"),p.nullable("hiddenHeroicPathRevealedAt"),p.getInt("currentStreak"),p.getInt("longestStreak"),p.nullable("lastQualifiedDate")?.let(LocalDate::parse),p.getString("streakGoalMode"),p.getInt("streakFreezeCount"),p.getInt("rhythmScore"),p.getString("updatedAt")),revision,
            Achievements.normalize(v.optJSONArray("achievementUnlocks")?.objects()?.map { unlock ->
                AchievementUnlock(unlock.getString("achievementId"),unlock.getString("unlockedAt"))
            } ?: emptyList()),StreakProtection.normalize(v.optJSONArray("streakFreezeTransactions")?.objects()?.map { item ->
                StreakFreezeTransaction(item.getInt("amount"),item.getString("reason"),item.getString("sourceId"),
                    item.getString("idempotencyKey"),item.getString("createdAt"))
            } ?: emptyList()),HabitQuests.normalize(v.optJSONArray("quests")?.objects()?.map { q ->
                HabitQuest(entity(q),q.getString("cadence"),q.getString("kind"),q.nullable("habitId"),
                    LocalDate.parse(q.getString("startDate")),LocalDate.parse(q.getString("endDate")),
                    q.getInt("target"),q.getInt("progress"),q.getInt("rewardLaurels"),q.nullable("completedAt"))
            } ?: emptyList()), settings(v.optJSONObject("settings")),
            v.optJSONArray("hiddenDefaultTemplates")?.let { array ->
                (0 until array.length()).mapNotNull { array.optString(it).takeIf(String::isNotBlank) }
            } ?: emptyList())
    }

    private fun settings(value: HabitSettings): JSONObject {
        val root = runCatching { JSONObject(value.rawJson) }.getOrElse { JSONObject() }
        root.put("enabled", value.enabled)
        root.put("notifications", JSONObject().put("enabled", value.notifications.enabled)
            .put("motivational", value.notifications.motivational).put("tone", value.notifications.tone)
            .put("dailyGoalTime", value.notifications.dailyGoalTime)
            .put("quietHoursStart", value.notifications.quietHoursStart)
            .put("quietHoursEnd", value.notifications.quietHoursEnd))
        root.put("feedback", JSONObject().put("animations", value.feedback.animations)
            .put("sound", value.feedback.sound).put("haptics", value.feedback.haptics)
            .put("achievementPopups", value.feedback.achievementPopups)
            .put("questsEnabled", value.feedback.questsEnabled)
            .put("gamificationWidgets", value.feedback.gamificationWidgets))
        return root
    }

    private fun settings(value: JSONObject?): HabitSettings {
        val root = value ?: JSONObject(defaultHabitSettingsJson())
        val notifications = root.optJSONObject("notifications") ?: JSONObject()
        val feedback = root.optJSONObject("feedback") ?: JSONObject()
        fun time(name: String, fallback: String) = notifications.optString(name)
            .takeIf { Regex("(?:[01]\\d|2[0-3]):[0-5]\\d").matches(it) } ?: fallback
        return HabitSettings(root.optBoolean("enabled", true), HabitNotificationSettings(
            notifications.optBoolean("enabled", false), notifications.optBoolean("motivational", true),
            notifications.optString("tone").takeIf { it in setOf("calm", "heroic", "ironic") } ?: "calm",
            time("dailyGoalTime", "20:30"), time("quietHoursStart", "22:00"), time("quietHoursEnd", "07:30")),
            HabitFeedbackSettings(feedback.optBoolean("animations", true), feedback.optBoolean("sound", false),
                feedback.optBoolean("haptics", false), feedback.optBoolean("achievementPopups", true),
                feedback.optBoolean("questsEnabled", true), feedback.optBoolean("gamificationWidgets", true)),
            root.toString())
    }
}
