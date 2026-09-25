package ru.genesis.calendar

import android.app.Application
import androidx.room.Room
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import ru.genesis.calendar.data.*
import ru.genesis.calendar.reminders.ReminderScheduler

class GenesisApplication : Application() {
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val localScope = if (BuildConfig.DEBUG) "internal-validation-v1" else "local-drafts-v1"
    private val activeScope = MutableStateFlow(localScope)
    val scopeFlow = activeScope.asStateFlow()
    val workspaceScope get() = activeScope.value
    fun activateAccount(uid: String?) {
        activeScope.value = uid?.let(ru.genesis.calendar.auth.CloudAccountSnapshot::scopeFor) ?: localScope
    }
    val database by lazy {
        Room.databaseBuilder(this, GenesisDatabase::class.java, "genesis.db").build()
    }
    val scheduler by lazy { ReminderScheduler(this) }
    val repository get() = TaskRepository(database, LocalCipher(), workspaceScope, scheduler)
    override fun onCreate() {
        super.onCreate()
        scheduler.createChannels()
        appScope.launch { scheduler.restore() }
    }
}
