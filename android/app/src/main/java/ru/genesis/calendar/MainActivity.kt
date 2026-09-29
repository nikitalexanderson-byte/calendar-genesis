package ru.genesis.calendar

import android.os.Bundle
import android.content.Intent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import ru.genesis.calendar.auth.AuthController
import ru.genesis.calendar.ui.GenesisApp

class MainActivity : ComponentActivity() {
    private val openedTask = mutableStateOf<String?>(null)
    private val openedSection = mutableStateOf<String?>(null)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        acceptIntent(intent)
        setContent { GenesisApp(application as GenesisApplication, openedTask.value, openedSection.value) }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (isActive) {
                    AuthController.get(applicationContext).refreshIfReady()
                    delay(30_000)
                }
            }
        }
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        acceptIntent(intent)
    }
    override fun onResume() {
        super.onResume()
        // Returning from Android permission/battery settings must restore the schedule
        // immediately, even when no habit or account data changed.
        lifecycleScope.launch {
            val app = application as GenesisApplication
            app.scheduler.restore(); app.scheduler.restoreHabitNotifications()
        }
    }
    private fun acceptIntent(intent: Intent) {
        val app = application as GenesisApplication
        if (intent.getStringExtra("scope") == app.workspaceScope) {
            openedTask.value = intent.getStringExtra("taskId")
            requestedSection(intent, app.workspaceScope)?.let { section ->
                openedSection.value = "$section#${System.nanoTime()}"
            }
        }
    }
}

internal fun requestedSection(intent: Intent, workspaceScope: String): String? =
    intent.getStringExtra("openSection").takeIf { intent.getStringExtra("scope") == workspaceScope }
