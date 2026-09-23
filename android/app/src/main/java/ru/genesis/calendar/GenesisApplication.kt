package ru.genesis.calendar

import android.app.Application
import androidx.room.Room
import kotlinx.coroutines.*
import ru.genesis.calendar.data.*
import ru.genesis.calendar.reminders.ReminderScheduler

class GenesisApplication : Application() {
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    val workspaceScope get() = if (BuildConfig.DEBUG) "internal-validation-v1" else "local-drafts-v1"
    val database by lazy {
        Room.databaseBuilder(this, GenesisDatabase::class.java, "genesis.db").build()
    }
    val scheduler by lazy { ReminderScheduler(this) }
    val repository by lazy { TaskRepository(database, LocalCipher(), workspaceScope, scheduler) }
    override fun onCreate() {
        super.onCreate()
        scheduler.createChannels()
        appScope.launch { scheduler.restore() }
    }
}
