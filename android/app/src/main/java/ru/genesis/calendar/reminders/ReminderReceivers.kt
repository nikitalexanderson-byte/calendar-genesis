package ru.genesis.calendar.reminders

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.MainActivity
import ru.genesis.calendar.R

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        val app = context.applicationContext as GenesisApplication
        val wakeLock = context.getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GENESIS:task-delivery").apply { acquire(10_000) }
        app.appScope.launch {
            try { withTimeout(9_000) {
                app.scheduler.deliver(intent.getStringExtra("scope") ?: return@withTimeout,
                    intent.getStringExtra("id") ?: return@withTimeout, intent.getLongExtra("revision", -1))
            } }
            catch (error: Exception) { Log.e("GenesisReminders", "Task delivery: ${error.javaClass.simpleName}") }
            finally {
                ReminderMaintenanceWorker.enqueueImmediate(context)
                if (wakeLock.isHeld) wakeLock.release()
                pending.finish()
            }
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
        val wakeLock = context.getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GENESIS:habit-delivery").apply { acquire(10_000) }
        app.appScope.launch {
            try { withTimeout(9_000) {
                app.scheduler.deliverHabitNotification(intent)
                app.scheduler.restoreHabitNotifications()
            } }
            catch (error: Exception) { Log.e("GenesisReminders", "Delivery: ${error.javaClass.simpleName}") }
            finally {
                ReminderMaintenanceWorker.enqueueImmediate(context)
                if (wakeLock.isHeld) wakeLock.release()
                pending.finish()
            }
        }
    }
}
class DiagnosticNotificationReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val app = context.applicationContext as GenesisApplication
        app.scheduler.deliverDiagnosticNotification(intent)
    }
}
class RestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if(intent.action !in setOf(Intent.ACTION_BOOT_COMPLETED,Intent.ACTION_USER_UNLOCKED,
            Intent.ACTION_MY_PACKAGE_REPLACED,Intent.ACTION_TIME_CHANGED,Intent.ACTION_TIMEZONE_CHANGED,
            android.app.AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED)) return
        val pending = goAsync()
        val app = context.applicationContext as GenesisApplication
        ReminderMaintenanceWorker.enqueueImmediate(context)
        app.appScope.launch {
            try { app.scheduler.restore(recoverOverdue = true); app.scheduler.restoreHabitNotifications() }
            finally { pending.finish() }
        }
    }
}
