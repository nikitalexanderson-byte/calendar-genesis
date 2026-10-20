package ru.genesis.calendar.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import ru.genesis.calendar.auth.SharedWorkspaceGateway
import ru.genesis.calendar.data.UiPreferences

/** Keep the feature's restored destination outside the workspace's large composition method. */
@Composable internal fun rememberSharedAutomationNavigation(gateway: SharedWorkspaceGateway, preferences: UiPreferences,
    onLost: () -> Unit, onChanged: () -> Unit, onTask: (String, String) -> Unit): MutableState<String> {
    val destination = rememberSaveable { mutableStateOf("") }
    val project = destination.value
    if (project.isNotBlank()) SharedAutomationsScreen(gateway, project, preferences = preferences,
        onClose = { destination.value = "" }, onLost = { destination.value = ""; onLost() },
        onChanged = onChanged, onTask = { destination.value = ""; onTask(project, it) })
    return destination
}
