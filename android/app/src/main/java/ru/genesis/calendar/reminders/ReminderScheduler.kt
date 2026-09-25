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
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.MainActivity
import ru.genesis.calendar.R
import ru.genesis.calendar.data.ReminderRecord

class ReminderScheduler(private val context: Context) {
    // The application runs in one process. Serialize the DB transition and the
    // system side effect so an old delivery cannot race past an edit/cancel.
    private val mutation = Mutex()
    suspend fun <T> withMutation(block: suspend () -> T): T = mutation.withLock { block() }
    companion object { const val TASK_CHANNEL = "genesis.tasks.v1" }
    private val app get() = context.applicationContext as GenesisApplication
    private val alarms get() = context.getSystemService(AlarmManager::class.java)
    private val notifications get() = context.getSystemService(NotificationManager::class.java)
    fun exactAllowed() = Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()
    fun notificationsAllowed() = NotificationManagerCompat.from(context).areNotificationsEnabled() &&
        (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
    fun channelAllowed() = notifications.getNotificationChannel(TASK_CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE
    fun createChannels() {
        listOf(TASK_CHANNEL to "Задачи и события", "genesis.habits.v1" to "Привычки",
            "genesis.daily-goal.v1" to "Дневная цель", "genesis.achievements.v1" to "Достижения").forEach { (id, label) ->
            val channel = NotificationChannel(id, label, NotificationManager.IMPORTANCE_HIGH)
            channel.enableVibration(true)
            channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build())
            channel.lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            notifications.createNotificationChannel(channel)
        }
        notifications.createNotificationChannel(NotificationChannel("genesis.sync.v1", "Синхронизация",
            NotificationManager.IMPORTANCE_LOW).apply { setSound(null, null) })
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
        val note = NotificationCompat.Builder(context, TASK_CHANNEL)
            .setSmallIcon(R.drawable.ic_notification).setContentTitle("GENESIS")
            .setContentText("Время запланированного действия").setContentIntent(open)
            .setCategory(NotificationCompat.CATEGORY_REMINDER).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true).setOnlyAlertOnce(true)
            .addAction(0, "Выполнено", action("complete"))
            .addAction(0, "Отложить на 10 мин", action("snooze"))
            .addAction(0, "Отключить", action("dismiss"))
            .build()
        try { notifications.notify(scope + "/" + id, 1, note) }
        catch (_: SecurityException) { /* Permission may be revoked between check and notify. */ }
        scheduleUpcomingLocked(scope)
    }
}
