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
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        acceptIntent(intent)
        setContent { GenesisApp(application as GenesisApplication, openedTask.value) }
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
    private fun acceptIntent(intent: Intent) {
        val app = application as GenesisApplication
        if (intent.getStringExtra("scope") == app.workspaceScope)
            openedTask.value = intent.getStringExtra("taskId")
    }
}
