package ru.genesis.calendar

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import ru.genesis.calendar.ui.GenesisApp

/** Non-exported debug-only host for isolated UI tests. Never used by the launcher. */
class TestWorkspaceActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { GenesisApp(application as GenesisApplication, null, testWorkspace = true) }
    }
}
