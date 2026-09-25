package ru.genesis.calendar.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.launch
import ru.genesis.calendar.GenesisApplication

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

class RestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if(intent.action !in setOf(Intent.ACTION_BOOT_COMPLETED,Intent.ACTION_USER_UNLOCKED,
            Intent.ACTION_MY_PACKAGE_REPLACED,Intent.ACTION_TIME_CHANGED,Intent.ACTION_TIMEZONE_CHANGED,
            android.app.AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED)) return
        val pending = goAsync()
        val app = context.applicationContext as GenesisApplication
        app.appScope.launch {
            try { app.scheduler.restore() }
            finally { pending.finish() }
        }
    }
}
