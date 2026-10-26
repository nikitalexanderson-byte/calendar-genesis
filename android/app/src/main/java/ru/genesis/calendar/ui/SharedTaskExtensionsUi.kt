package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import org.json.JSONObject
import ru.genesis.calendar.auth.SharedWorkspaceGateway
import ru.genesis.calendar.data.UiPreferences

internal class SharedTaskExtensionsUiState {
    var lifecycleOpen by mutableStateOf(false)
    var mindmapsOpen by mutableStateOf(false)
    var conversionMap by mutableStateOf("")
    var conversionNode by mutableStateOf("")
    var archivedTaskId by mutableStateOf("")
    var seriesDirty by mutableStateOf(false)
    var filesDirty by mutableStateOf(false)
    var coreDraftDirty = false
    var account = ""
    var lifecycleAction by mutableStateOf<Pair<String, JSONObject>?>(null)
    companion object {
        val saver = Saver<SharedTaskExtensionsUiState, String>(save = {
            JSONObject().put("lifecycleOpen", it.lifecycleOpen).put("archivedTaskId", it.archivedTaskId)
                .put("mindmapsOpen", it.mindmapsOpen).put("conversionMap", it.conversionMap).put("conversionNode", it.conversionNode)
                .put("seriesDirty", it.seriesDirty).put("filesDirty", it.filesDirty).toString()
        }, restore = { raw -> JSONObject(raw).let { json -> SharedTaskExtensionsUiState().apply {
            lifecycleOpen = json.optBoolean("lifecycleOpen"); archivedTaskId = json.optString("archivedTaskId")
            mindmapsOpen = json.optBoolean("mindmapsOpen"); conversionMap = json.optString("conversionMap"); conversionNode = json.optString("conversionNode")
            seriesDirty = json.optBoolean("seriesDirty"); filesDirty = json.optBoolean("filesDirty")
        } } })
    }
}

@Composable internal fun SharedTaskExtensionPanels(gateway: SharedWorkspaceGateway, task: JSONObject, project: JSONObject,
    members: List<JSONObject>, preferences: UiPreferences, state: SharedTaskExtensionsUiState, disabled: Boolean,
    onAcknowledged: (JSONObject) -> Unit, onRefresh: suspend () -> Unit, onOpen: (String, String) -> Unit) {
    val taskId = task.getString("id")
    var reviewOpen by rememberSaveable(taskId) { mutableStateOf(false) }
    SharedTaskFilesPanel(gateway, task, sharedTaskCanEdit(project), disabled, onAcknowledged, { state.filesDirty = it })
    TextButton(onClick = { reviewOpen = !reviewOpen }, modifier = Modifier.fillMaxWidth()) {
        Text("Согласование и проверка", Modifier.weight(1f))
        AffairsActionIcon(if (reviewOpen) AffairsAction.COLLAPSE else AffairsAction.EXPAND)
    }
    if (reviewOpen) SharedTaskReviewPanel(gateway, task, project, members, state.account, disabled, onRefresh)
    SharedTaskSeriesPanel(gateway, task, preferences,
        readOnly = !sharedTaskCanEdit(project) || !project.optBoolean("canOrganizeTasks"), disabled = disabled,
        onDirtyChange = { state.seriesDirty = it }, onSaved = onRefresh, onOpen = onOpen)
}
