package ru.genesis.calendar

import android.app.Application
import androidx.room.Room
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import ru.genesis.calendar.data.*
import ru.genesis.calendar.reminders.ReminderScheduler

class GenesisApplication : Application() {
    private val feedback = kotlinx.coroutines.flow.MutableSharedFlow<HabitFeedbackEvent>(
        extraBufferCapacity = 8, onBufferOverflow = kotlinx.coroutines.channels.BufferOverflow.DROP_OLDEST)
    val habitFeedback = feedback.asSharedFlow()
    fun offerHabitFeedback(event: HabitFeedbackEvent) {
        if (event.scope == workspaceScope) feedback.tryEmit(event)
    }
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val localScope = if (BuildConfig.DEBUG) "internal-validation-v1" else "local-drafts-v1"
    private val activeScope = MutableStateFlow(localScope)
    val scopeFlow = activeScope.asStateFlow()
    val workspaceScope get() = activeScope.value
    fun activateAccount(uid: String?) {
        val next = uid?.let(ru.genesis.calendar.auth.CloudAccountSnapshot::scopeFor) ?: localScope
        // This contains only the hashed workspace key, never credentials or tokens.
        check(getSharedPreferences("genesis.reminder.scope.v1", MODE_PRIVATE).edit()
            .putString("workspace", next).commit())
        activeScope.value = next
    }
    val database by lazy {
        Room.databaseBuilder(this, GenesisDatabase::class.java, "genesis.db").build()
    }
    val scheduler by lazy { ReminderScheduler(this) }
    val repository get() = TaskRepository(database, LocalCipher(), workspaceScope, scheduler)
    override fun onCreate() {
        super.onCreate()
        val saved = getSharedPreferences("genesis.reminder.scope.v1", MODE_PRIVATE).getString("workspace", localScope)
        activeScope.value = saved?.takeIf { it == localScope || Regex("account-[a-f0-9]{32}").matches(it) } ?: localScope
        scheduler.createChannels()
        ru.genesis.calendar.reminders.ReminderMaintenanceWorker.enqueue(this)
        ru.genesis.calendar.auth.CloudSyncWorker.enqueue(this)
        appScope.launch {
            scheduler.restore(recoverOverdue = true)
            scheduler.restoreHabitNotifications()
            ru.genesis.calendar.reminders.MoonReminderScheduler.restore(this@GenesisApplication)
            runCatching { ru.genesis.calendar.reminders.SleepReminderScheduler.restore(this@GenesisApplication) }
        }
    }
}
