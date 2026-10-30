package ru.genesis.calendar.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.TextStyle

internal val LocalWorkspaceBackgroundStatuses = staticCompositionLocalOf<MutableMap<Any, String>?> { null }

/** Background activity is displayed by the drawer without shifting the current page. */
@Composable
internal fun WorkspaceBackgroundStatus(active: Boolean, label: String) {
    val statuses = LocalWorkspaceBackgroundStatuses.current
    val key = remember { Any() }
    DisposableEffect(statuses, active, label) {
        if (active) statuses?.set(key, label)
        onDispose { statuses?.remove(key) }
    }
}

@Composable
internal fun WorkspaceLoadingText(text: String = "Загрузка…", modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.bodySmall) {
    if (LocalWorkspaceBackgroundStatuses.current != null) WorkspaceBackgroundStatus(true, genesisTranslate(text))
    else Text(text, modifier, style = style)
}

/** Transient account messages share a compact, word-wrapped block in the drawer footer. */
@Composable
internal fun WorkspaceStatusNotice(message: String, modifier: Modifier = Modifier, isError: Boolean = false,
    actions: @Composable ColumnScope.() -> Unit = {}) {
    Surface(modifier.fillMaxWidth(), shape = AffairsLayout.shape,
        color = if (isError) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.surfaceContainerHigh,
        contentColor = if (isError) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onSurface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(message, style = MaterialTheme.typography.bodySmall)
            actions()
        }
    }
}

@Composable
internal fun WorkspaceLoadingIndicator(modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.primary,
    strokeWidth: Dp = 4.dp) {
    if (LocalWorkspaceBackgroundStatuses.current != null) WorkspaceBackgroundStatus(true, genesisTranslate("Загрузка…"))
    else androidx.compose.material3.CircularProgressIndicator(modifier = modifier, color = color, strokeWidth = strokeWidth)
}

@Composable
internal fun WorkspaceLoadingLine(modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.primary,
    trackColor: Color = MaterialTheme.colorScheme.surfaceVariant) {
    if (LocalWorkspaceBackgroundStatuses.current != null) WorkspaceBackgroundStatus(true, genesisTranslate("Загрузка…"))
    else androidx.compose.material3.LinearProgressIndicator(modifier = modifier, color = color, trackColor = trackColor)
}
