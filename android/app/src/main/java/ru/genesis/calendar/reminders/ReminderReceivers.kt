package ru.genesis.calendar.reminders

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.launch
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.MainActivity
import ru.genesis.calendar.R

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        val app = context.applicationContext as GenesisApplication
        app.appScope.launch {
            try { app.scheduler.deliver(intent.getStringExtra("scope") ?: return@launch,
                intent.getStringExtra("id") ?: return@launch, intent.getLongExtra("revision", -1)) }
            finally { pending.finish() }
        }
    }
}

class ReminderActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        val app = context.applicationContext as GenesisApplication
        app.appScope.launch {
            try {
                if (intent.getStringExtra("scope") != app.workspaceScope) return@launch
                val id = intent.getStringExtra("id") ?: return@launch
                val revision = intent.getLongExtra("revision", -1)
                app.repository.reminderAction(id,revision,intent.action ?: return@launch)
            } catch (_: IllegalArgumentException) {
                // A concurrently edited task wins; stale notification actions cannot overwrite it.
            } finally { pending.finish() }
        }
    }
}

class HabitNotificationReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        val app = context.applicationContext as GenesisApplication
        app.appScope.launch {
            try {
                if (intent.getStringExtra("scope") != app.workspaceScope) return@launch
                val channel = intent.getStringExtra("channel") ?: ReminderScheduler.HABIT_CHANNEL
                if (!app.scheduler.notificationsAllowed() || !app.scheduler.channelAllowed(channel)) return@launch
                val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val notification = NotificationCompat.Builder(context, channel)
                    .setSmallIcon(R.drawable.ic_notification).setContentTitle("GENESIS")
                    .setContentText(intent.getStringExtra("body").orEmpty()).setContentIntent(open)
                    .setCategory(NotificationCompat.CATEGORY_REMINDER)
                    .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setAutoCancel(true)
                    .build()
                runCatching { NotificationManagerCompat.from(context).notify(
                    intent.data?.toString().orEmpty(), intent.data?.hashCode() ?: 2, notification) }
                app.scheduler.restoreHabitNotifications()
            } finally { pending.finish() }
        }
    }
}

class RestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if(intent.action !in setOf(Intent.ACTION_BOOT_COMPLETED,Intent.ACTION_USER_UNLOCKED,
            Intent.ACTION_MY_PACKAGE_REPLACED,Intent.ACTION_TIME_CHANGED,Intent.ACTION_TIMEZONE_CHANGED,
            android.app.AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED)) return
        val pending = goAsync()
        val app = context.applicationContext as GenesisApplication
        app.appScope.launch {
            try { app.scheduler.restore(); app.scheduler.restoreHabitNotifications() }
            finally { pending.finish() }
        }
    }
}
