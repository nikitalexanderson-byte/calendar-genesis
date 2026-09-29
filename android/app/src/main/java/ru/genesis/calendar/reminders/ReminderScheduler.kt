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
import java.time.LocalDate
import java.time.ZoneId

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
        internal const val HABIT_LATE_WINDOW_SECONDS = 6L * 60 * 60
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
        val body = habitNotificationBody(tone, "habit", 1, english, System.nanoTime().toString())
        val note = NotificationCompat.Builder(context, HABIT_CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("GENESIS")
            .setContentText(body).setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(openAppIntent()).setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setAutoCancel(true).build()
        return try {
            NotificationManagerCompat.from(context).notify("habit-tone-preview", 7301, note); true
        } catch (_: SecurityException) { false }
        catch (_: Exception) { false }
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
        return try {
            NotificationManagerCompat.from(context).notify("habit-achievement", 7302, note); true
        } catch (_: SecurityException) { false }
        catch (_: Exception) { false }
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

    /** System PendingIntents survive closing the UI and process recreation. */
    suspend fun restoreHabitNotifications() = withMutation {
        val scope = app.workspaceScope
        val workspace = runCatching { HabitsRepository(app).workspace.first() }.getOrNull() ?: return@withMutation
        val language = LocalPreferences(context, scope).values.first().language
        if (scope != app.workspaceScope) return@withMutation
        val zone = ZoneId.systemDefault()
        val registry = context.getSharedPreferences("genesis_habit_alarm_registry", Context.MODE_PRIVATE)
        val now = java.time.Instant.now()
        val from = now.minusSeconds(HABIT_LATE_WINDOW_SECONDS)
        val delivered = registry.getStringSet("delivered", emptySet()).orEmpty()
        val plan = if (notificationsAllowed()) planHabitNotifications(workspace, from.atZone(zone).toLocalDate(),
            from, zone, language == "en", 9).filterNot { habitUri(it, scope) in delivered }.take(128) else emptyList()
        val scheduledUris = plan.mapTo(linkedSetOf()) { candidate ->
            habitUri(candidate, scope)
        }
        fun pending(raw: String, candidate: PlannedHabitNotification): PendingIntent {
            val intent = Intent(context, HabitNotificationReceiver::class.java).apply {
                action = "ru.genesis.calendar.HABIT_NOTIFICATION"
                data = Uri.parse(raw)
                putExtra("scope", scope)
                candidate.let {
                    putExtra("date", it.date.toString()); putExtra("kind", it.kind)
                    putExtra("habitId", it.habitId); putExtra("at", it.at.toEpochMilli())
                }
            }
            return PendingIntent.getBroadcast(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }
        registry.getStringSet("alarms", emptySet()).orEmpty().filterNot { it in scheduledUris }
            .forEach(::cancelHabitAlarm)
        plan.zip(scheduledUris).forEach { (candidate, raw) ->
            val operation = pending(raw, candidate)
            // Reconcile overdue alarms after Doze, a reboot or a permission change.
            // Retain their original occurrence/time; validation and delivered keys prevent replay.
            val deliveryAt = maxOf(candidate.at.toEpochMilli(), now.toEpochMilli() + 1_000)
            try {
                if (exactAllowed()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, deliveryAt, operation)
                else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, deliveryAt, operation)
            } catch (_: SecurityException) { alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, deliveryAt, operation) }
        }
        registry.edit().putStringSet("alarms", scheduledUris).commit()
    }

    private fun habitUri(candidate: PlannedHabitNotification, scope: String) = Uri.Builder().scheme("genesis")
        .authority("habit-reminder").appendPath(scope).appendPath(candidate.key).build().toString()

    private fun cancelHabitAlarm(raw: String) {
        // Cancellation must never replace the extras of an alarm already being delivered
        // during cold process startup.
        val operation = PendingIntent.getBroadcast(context, 0, Intent(context, HabitNotificationReceiver::class.java).apply {
            action = "ru.genesis.calendar.HABIT_NOTIFICATION"; data = Uri.parse(raw)
        }, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE) ?: return
        alarms.cancel(operation)
    }

    suspend fun deliverHabitNotification(intent: Intent) = withMutation {
        val scope = intent.getStringExtra("scope")
        if (scope != app.workspaceScope || !notificationsAllowed()) return@withMutation
        val date = runCatching { LocalDate.parse(intent.getStringExtra("date")) }.getOrNull() ?: return@withMutation
        val at = java.time.Instant.ofEpochMilli(intent.getLongExtra("at", 0))
        val now = java.time.Instant.now()
        if (at > now.plusSeconds(1) || at < now.minusSeconds(HABIT_LATE_WINDOW_SECONDS)) return@withMutation
        val workspace = HabitsRepository(app).workspace.first()
        val english = LocalPreferences(context, app.workspaceScope).values.first().language == "en"
        val candidate = planHabitNotifications(workspace, date, at.minusMillis(1), ZoneId.systemDefault(), english, 1)
            .firstOrNull { it.kind == intent.getStringExtra("kind") && it.habitId == intent.getStringExtra("habitId") && it.at == at }
            ?: return@withMutation
        val channel = if (candidate.kind == "goal") DAILY_GOAL_CHANNEL else HABIT_CHANNEL
        if (!channelAllowed(channel)) return@withMutation
        val registry = context.getSharedPreferences("genesis_habit_alarm_registry", Context.MODE_PRIVATE)
        val key = intent.data.toString()
        if (scope != app.workspaceScope) return@withMutation
        val delivered = registry.getStringSet("delivered", emptySet()).orEmpty()
        if (key in delivered) return@withMutation
        val notification = NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_notification).setContentTitle(candidate.title)
            .setContentText(candidate.body).setStyle(NotificationCompat.BigTextStyle().bigText(candidate.body))
            .setContentIntent(openAppIntent()).setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setAutoCancel(true).build()
        try {
            NotificationManagerCompat.from(context).notify(key, 2, notification)
            registry.edit().putStringSet("delivered", (delivered + key).toList().takeLast(256).toSet()).commit()
        } catch (_: SecurityException) { /* Permission may be revoked between check and delivery. */ }
    }
    /** Remove account-specific system alarms/notifications when its session leaves the device. */
    suspend fun deactivate(scope: String) = withMutation {
        app.database.dao().reminders(scope).forEach(::cancel)
        val registry = context.getSharedPreferences("genesis_habit_alarm_registry", Context.MODE_PRIVATE)
        val all = registry.getStringSet("alarms", emptySet()).orEmpty()
        val removed = all.filter { Uri.parse(it).pathSegments.firstOrNull() == scope }
        removed.forEach(::cancelHabitAlarm)
        registry.edit().putStringSet("alarms", all - removed.toSet()).commit()
        notifications.activeNotifications.filter {
            it.tag?.let { tag -> Uri.parse(tag).authority == "habit-reminder" && Uri.parse(tag).pathSegments.firstOrNull() == scope } == true
        }.forEach { notifications.cancel(it.tag, it.id) }
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
