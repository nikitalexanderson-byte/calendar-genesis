package ru.genesis.calendar.auth

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.ui.*
import ru.genesis.calendar.ui.Text
import ru.genesis.calendar.ui.TextButton

/** Recovery is available on every screen; a retry cannot resolve a three-way conflict. */
@Composable internal fun WorkspaceSyncNotice(state: AuthPanelState, onRetry: () -> Unit,
    onKeepLocal: (String, String) -> Unit, onKeepRemote: (String, String) -> Unit) {
    val issue = state.outgoingSyncIssue ?: return
    val uid = state.user?.uid
    var review by remember(uid) { mutableStateOf<WorkspaceConflictPreview?>(null) }
    Surface(color = MaterialTheme.colorScheme.errorContainer,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), shape = AffairsLayout.shape) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(issue, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onErrorContainer)
            if (state.workspaceConflictPreview != null && uid != null) {
                TextButton(onClick = { review = state.workspaceConflictPreview }, enabled = !state.busy,
                    modifier = Modifier.heightIn(min = 48.dp).testTag("workspace-sync-compare")) { Text("Сравнить версии") }
            } else AffairsIconButton("Повторить", AffairsAction.REFRESH, onRetry, enabled = !state.busy)
        }
    }
    review?.let { preview -> if (uid != null) WorkspaceConflictDialog(preview, state.busy,
        onKeepLocal = { review = null; onKeepLocal(uid, preview.fingerprint) },
        onKeepRemote = { review = null; onKeepRemote(uid, preview.fingerprint) },
        onDismiss = { review = null }) }
}
