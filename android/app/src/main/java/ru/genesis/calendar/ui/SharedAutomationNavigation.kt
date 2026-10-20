package ru.genesis.calendar.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import ru.genesis.calendar.auth.SharedWorkspaceGateway

/** Keep the feature's restored destination outside the workspace's large composition method. */
@Composable internal fun rememberSharedAutomationNavigation(gateway: SharedWorkspaceGateway,
    onLost: () -> Unit, onChanged: () -> Unit, onTask: (String, String) -> Unit): MutableState<String> {
    val destination = rememberSaveable { mutableStateOf("") }
    val project = destination.value
    if (project.isNotBlank()) SharedAutomationsScreen(gateway, project,
        onClose = { destination.value = "" }, onLost = { destination.value = ""; onLost() },
        onChanged = onChanged, onTask = { destination.value = ""; onTask(project, it) })
    return destination
}
