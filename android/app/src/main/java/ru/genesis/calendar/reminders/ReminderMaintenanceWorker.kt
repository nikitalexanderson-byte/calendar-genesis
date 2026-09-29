package ru.genesis.calendar.reminders

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import ru.genesis.calendar.GenesisApplication

/** Rebuilds system alarms from the durable encrypted workspace without a screen or network. */
class ReminderMaintenanceWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val app = applicationContext as GenesisApplication
        return try {
            app.scheduler.restore()
            app.scheduler.restoreHabitNotifications()
            Result.success()
        } catch (e: CancellationException) { throw e }
        catch (_: Exception) { Result.retry() }
    }
    companion object {
        fun enqueue(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("genesis-reminder-maintenance-v1",
                ExistingPeriodicWorkPolicy.KEEP, PeriodicWorkRequestBuilder<ReminderMaintenanceWorker>(12, TimeUnit.HOURS).build())
        }
    }
}
