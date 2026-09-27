package ru.genesis.calendar.reminders

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.flow.first
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.MainActivity
import ru.genesis.calendar.R
import ru.genesis.calendar.data.ReminderRecord
import ru.genesis.calendar.data.LocalPreferences
import ru.genesis.calendar.data.HabitsRepository
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.habits.HabitEngine
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

internal fun habitNotificationBody(tone: String, kind: String, count: Int, english: Boolean): String {
    val goal = kind == "goal"
    return when (tone) {
        "heroic" -> if (english) {
            if (goal) "Heroic call: complete today's practice and carry the rhythm forward."
            else if (count == 1) "Heroic call: a planned practice awaits your action."
            else "Heroic call: $count planned practices await your action."
        } else {
            if (goal) "Героический зов: завершите практику дня и продолжите ритм."
            else if (count == 1) "Героический зов: запланированная практика ждёт свершения."
            else "Героический зов: вас ждут практики — $count."
        }
        "ironic" -> if (english) {
            if (goal) "Your daily goal is still waiting. Apparently it has excellent patience."
            else if (count == 1) "Your practice noticed your absence. Shall we call that a warm-up?"
            else "$count practices noticed your absence. A remarkably attentive audience."
        } else {
            if (goal) "Дневная цель всё ещё ждёт. Кажется, терпения ей не занимать."
            else if (count == 1) "Привычка заметила ваше отсутствие. Считаем это разминкой?"
            else "Практики заметили ваше отсутствие — все $count. Внимательная публика."
        }
        else -> if (english) {
            if (goal) "A quiet nudge: your daily practice is still within reach."
            else if (count == 1) "A quiet nudge: a planned practice is waiting."
            else "A quiet nudge: $count planned practices are waiting."
        } else {
            if (goal) "Спокойное напоминание: дневная цель ещё достижима."
            else if (count == 1) "Спокойное напоминание: вас ждёт запланированная практика."
            else "Спокойное напоминание: вас ждут практики — $count."
        }
    }
}

class ReminderScheduler(private val context: Context) {
    // The application runs in one process. Serialize the DB transition and the
    // system side effect so an old delivery cannot race past an edit/cancel.
    private val mutation = Mutex()
    suspend fun <T> withMutation(block: suspend () -> T): T = mutation.withLock { block() }
    companion object {
        const val TASK_CHANNEL = "genesis.tasks.v1"
        const val HABIT_CHANNEL = "genesis.habits.v1"
        const val DAILY_GOAL_CHANNEL = "genesis.daily-goal.v1"
        const val ACHIEVEMENT_CHANNEL = "genesis.achievements.v1"
    }
    private val app get() = context.applicationContext as GenesisApplication
    private val alarms get() = context.getSystemService(AlarmManager::class.java)
    private val notifications get() = context.getSystemService(NotificationManager::class.java)
    fun exactAllowed() = Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()
    fun notificationsAllowed() = NotificationManagerCompat.from(context).areNotificationsEnabled() &&
        (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
    fun channelAllowed() = notifications.getNotificationChannel(TASK_CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE
    fun channelAllowed(channel: String) = notifications.getNotificationChannel(channel)?.importance != NotificationManager.IMPORTANCE_NONE
    fun createChannels(language: String = "ru") {
        val labels = if (language == "en") listOf(TASK_CHANNEL to "Tasks and events", HABIT_CHANNEL to "Habits",
            DAILY_GOAL_CHANNEL to "Daily goal", ACHIEVEMENT_CHANNEL to "Achievements")
        else listOf(TASK_CHANNEL to "Задачи и события", HABIT_CHANNEL to "Привычки",
            DAILY_GOAL_CHANNEL to "Дневная цель", ACHIEVEMENT_CHANNEL to "Достижения")
        labels.forEach { (id, label) ->
            val channel = NotificationChannel(id, label, NotificationManager.IMPORTANCE_HIGH)
            channel.enableVibration(true)
            channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build())
            channel.lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            notifications.createNotificationChannel(channel)
        }
        notifications.createNotificationChannel(NotificationChannel("genesis.sync.v1", if (language == "en") "Sync" else "Синхронизация",
            NotificationManager.IMPORTANCE_LOW).apply { setSound(null, null) })
    }
    private fun openAppIntent() = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    fun showHabitTonePreview(tone: String, english: Boolean): Boolean {
        createChannels(if (english) "en" else "ru")
        if (!notificationsAllowed() || !channelAllowed(HABIT_CHANNEL)) return false
        val label = when (tone) {
            "heroic" -> if (english) "Heroic" else "Героический"
            "ironic" -> if (english) "Wry" else "С иронией"
            else -> if (english) "Calm" else "Спокойный"
        }
        val note = NotificationCompat.Builder(context, HABIT_CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(if (english) "GENESIS · $label preview" else "GENESIS · пример: $label")
            .setContentText(habitNotificationBody(tone, "habit", 1, english))
            .setContentIntent(openAppIntent()).setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setAutoCancel(true).build()
        return runCatching {
            NotificationManagerCompat.from(context).notify("habit-tone-preview", 7301, note); true
        }.getOrDefault(false)
    }
    fun showAchievementNotification(count: Int, english: Boolean): Boolean {
        if (count <= 0) return false
        createChannels(if (english) "en" else "ru")
        if (!notificationsAllowed() || !channelAllowed(ACHIEVEMENT_CHANNEL)) return false
        val body = if (english) {
            if (count == 1) "A new achievement is now part of your path."
            else "$count new achievements are now part of your path."
        } else {
            if (count == 1) "Новое достижение стало частью вашего пути."
            else "Новых достижений открыто: $count."
        }
        val note = NotificationCompat.Builder(context, ACHIEVEMENT_CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(if (english) "GENESIS · Achievement" else "GENESIS · Достижение")
            .setContentText(body).setContentIntent(openAppIntent())
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setAutoCancel(true).build()
        return runCatching {
            NotificationManagerCompat.from(context).notify("habit-achievement", 7302, note); true
        }.getOrDefault(false)
    }
    private fun intent(row: ReminderRecord, action: String, clazz: Class<*>) = Intent(context, clazz).apply {
        this.action = action
        data = Uri.Builder().scheme("genesis").authority("reminder").appendPath(row.scope).appendPath(row.id).appendPath(action).build()
        putExtra("scope", row.scope); putExtra("id", row.id); putExtra("revision", row.revision)
    }
    private fun alarmIntent(row: ReminderRecord) = PendingIntent.getBroadcast(context, 0,
        intent(row, "deliver", ReminderReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    fun schedule(row: ReminderRecord) {
        if (row.scope != app.workspaceScope || row.state != "pending") return
        // Missed alarms are shown as overdue in the diagnostics, never replayed in a sound storm.
        if (row.at <= System.currentTimeMillis()) return
        val pending = alarmIntent(row)
        try {
            if (exactAllowed()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, row.at, pending)
            else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, row.at, pending)
        } catch (_: SecurityException) {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, row.at, pending)
        }
    }
    fun cancel(row: ReminderRecord) {
        alarms.cancel(alarmIntent(row))
        notifications.cancel(row.scope + "/" + row.id, 1)
    }
    /** Keep the nearest alarms active; later recurrence alarms are promoted after deliveries. */
    suspend fun scheduleUpcomingLocked(scope: String) {
        if (scope != app.workspaceScope) return
        val now = System.currentTimeMillis()
        app.database.dao().reminders(scope).asSequence()
            .filter { it.state == "pending" && it.at > now }
            .sortedBy { it.at }.take(100).forEach(::schedule)
        // An overdue row remains visible in diagnostics; never replay it in a sound storm.
    }
    suspend fun restore() = withMutation { scheduleUpcomingLocked(app.workspaceScope) }

    /** Schedules a rolling eight-day local window from encrypted habit settings. */
    suspend fun restoreHabitNotifications() = withMutation {
        val registry = context.getSharedPreferences("genesis_habit_alarm_registry", Context.MODE_PRIVATE)
        registry.getStringSet("alarms", emptySet()).orEmpty().forEach { raw ->
            val intent = Intent(context, HabitNotificationReceiver::class.java).apply {
                action = "ru.genesis.calendar.HABIT_NOTIFICATION"
                data = Uri.parse(raw)
            }
            alarms.cancel(PendingIntent.getBroadcast(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        }
        val workspace = runCatching { HabitsRepository(app).workspace.first() }.getOrNull()
            ?: return@withMutation registry.edit().putStringSet("alarms", emptySet()).apply()
        val settings = workspace.settings.notifications
        if (!workspace.settings.enabled || !settings.enabled || !notificationsAllowed()) {
            registry.edit().putStringSet("alarms", emptySet()).apply()
            return@withMutation
        }
        val language = LocalPreferences(context, app.workspaceScope).values.first().language
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        val engine = HabitEngine(GenesisCalendar(zone))
        val scheduledUris = linkedSetOf<String>()
        fun inQuietHours(value: LocalTime): Boolean {
            val start = LocalTime.parse(settings.quietHoursStart)
            val end = LocalTime.parse(settings.quietHoursEnd)
            if (start == end) return false
            return if (start < end) value >= start && value < end else value >= start || value < end
        }
        fun schedule(date: LocalDate, time: LocalTime, kind: String, count: Int) {
            if (inQuietHours(time)) return
            val at = LocalDateTime.of(date, time).atZone(zone).toInstant().toEpochMilli()
            if (at <= System.currentTimeMillis()) return
            val uri = Uri.Builder().scheme("genesis").authority("habit-reminder")
                .appendPath(app.workspaceScope).appendPath(date.toString()).appendPath(time.toString())
                .appendPath(kind).build()
            val body = habitNotificationBody(settings.tone, kind, count, language == "en")
            val intent = Intent(context, HabitNotificationReceiver::class.java).apply {
                action = "ru.genesis.calendar.HABIT_NOTIFICATION"
                data = uri
                putExtra("scope", app.workspaceScope)
                putExtra("channel", if (kind == "goal") DAILY_GOAL_CHANNEL else HABIT_CHANNEL)
                putExtra("body", body)
            }
            val pending = PendingIntent.getBroadcast(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            try {
                if (exactAllowed()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
                else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
            } catch (_: SecurityException) {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
            }
            scheduledUris += uri.toString()
        }
        repeat(8) { offset ->
            val date = today.plusDays(offset.toLong())
            workspace.habits.asSequence().filter { it.active && it.reminder.enabled }
                .filter { runCatching { engine.isScheduled(it, date) }.getOrDefault(false) }
                .mapNotNull { habit -> runCatching { LocalTime.parse(habit.reminder.time) }.getOrNull() }
                .sorted().groupBy { it.toSecondOfDay() / (20 * 60) }.values.forEach { group ->
                    schedule(date, group.minOrNull() ?: return@forEach, "habit", group.size)
                }
            if (settings.motivational) schedule(date, LocalTime.parse(settings.dailyGoalTime), "goal", 1)
        }
        registry.edit().putStringSet("alarms", scheduledUris).apply()
    }
    /** Remove account-specific system alarms/notifications when its session leaves the device. */
    suspend fun deactivate(scope: String) = withMutation {
        app.database.dao().reminders(scope).forEach(::cancel)
    }
    suspend fun deliver(scope: String, id: String, revision: Long) = withMutation { deliverLocked(scope,id,revision) }
    private suspend fun deliverLocked(scope: String, id: String, revision: Long) {
        if (scope != app.workspaceScope) return
        val dao = app.database.dao()
        val row = dao.reminder(scope, id) ?: return
        if (row.revision != revision || row.state != "pending" || row.at > System.currentTimeMillis() + 1000) return
        val task = dao.task(scope, row.taskId) ?: return
        if (task.done || task.deleted || task.revision != revision) return
        val permitted = notificationsAllowed() && channelAllowed()
        if (dao.claimReminder(scope, id, revision, if (permitted) "delivered" else "blocked", System.currentTimeMillis()) != 1) return
        if (!permitted) { scheduleUpcomingLocked(scope); return }
        val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java).apply {
            data = Uri.Builder().scheme("genesis").authority("task").appendPath(scope).appendPath(row.taskId).build()
            putExtra("scope", scope); putExtra("taskId", row.taskId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        fun action(name: String) = PendingIntent.getBroadcast(context, 0,
            intent(row, name, ReminderActionReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val english = LocalPreferences(context, scope).values.first().language == "en"
        val note = NotificationCompat.Builder(context, TASK_CHANNEL)
            .setSmallIcon(R.drawable.ic_notification).setContentTitle("GENESIS")
            .setContentText(if (english) "Time for your scheduled action" else "Время запланированного действия").setContentIntent(open)
            .setCategory(NotificationCompat.CATEGORY_REMINDER).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true).setOnlyAlertOnce(true)
            .addAction(0, if (english) "Complete" else "Выполнено", action("complete"))
            .addAction(0, if (english) "Snooze 10 min" else "Отложить на 10 мин", action("snooze"))
            .addAction(0, if (english) "Dismiss" else "Отключить", action("dismiss"))
            .build()
        try { notifications.notify(scope + "/" + id, 1, note) }
        catch (_: SecurityException) { /* Permission may be revoked between check and notify. */ }
        scheduleUpcomingLocked(scope)
    }
}
