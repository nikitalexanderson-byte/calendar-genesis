package ru.genesis.calendar.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.launch
import org.json.JSONObject

@Composable
internal fun NativeAdminPanel(onClose: () -> Unit, load: suspend () -> JSONObject,
    deleteUser: suspend (String, Boolean) -> JSONObject) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var payload by remember { mutableStateOf<JSONObject?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<JSONObject?>(null) }
    var blacklist by remember { mutableStateOf(false) }
    fun refresh() {
        scope.launch {
            busy = true
            error = null
            try { payload = load() }
            catch (failure: Exception) { error = failure.message ?: "Не удалось загрузить данные" }
            finally { busy = false }
        }
    }
    LaunchedEffect(Unit) { refresh() }
    Dialog(onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxWidth(.96f).fillMaxHeight(.92f).testTag("native-admin-panel"),
            shape = RoundedCornerShape(22.dp),
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Админ-панель", Modifier.weight(1f).semantics { heading() },
                        style = MaterialTheme.typography.headlineSmall)
                    IconButton(onClick = onClose, modifier = Modifier.testTag("admin-close-icon")
                        .semantics { contentDescription = "Закрыть админ-панель" }) {
                        Text("×", style = MaterialTheme.typography.headlineSmall)
                    }
                }
                OutlinedButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW,
                    Uri.parse("${ru.genesis.calendar.auth.AUTH_ORIGIN}/#admin"))) },
                    modifier = Modifier.fillMaxWidth().testTag("admin-manage-ads")) {
                    Text(manageAdsLabel())
                }
                val totals = payload?.optJSONObject("totals")
                if (totals != null) {
                    Text("Пользователей: ${totals.optInt("users")} · Задач: ${totals.optInt("tasks")} · Проектов: ${totals.optInt("projects")}")
                    Text("Загрузок Android: ${totals.optInt("androidDownloadRequests")} · Устройств с отчётом: ${totals.optInt("androidReportingUsers")}",
                        style = MaterialTheme.typography.bodySmall)
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                val rows = payload?.optJSONArray("users")?.let { array ->
                    (0 until array.length()).mapNotNull { array.optJSONObject(it) }
                }.orEmpty()
                LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("admin-users"),
                    verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(rows, key = { it.optString("id") }) { row ->
                        ElevatedCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(row.optString("displayName").ifBlank { row.optString("email") },
                                    style = MaterialTheme.typography.titleMedium)
                                Text(row.optString("email"), style = MaterialTheme.typography.bodySmall)
                                Text("Скачиваний: ${row.optInt("androidDownloadCount")} · Версия: ${row.optString("androidReportedVersion").ifBlank { "—" }} · Устройств: ${row.optInt("androidDeviceCount")}",
                                    style = MaterialTheme.typography.bodySmall)
                                Text("Google: ${if (row.optBoolean("googleAuthConnected")) "подключён" else "нет"} · Синхронизация: ${row.optString("androidServerSyncStatus").ifBlank { "—" }}",
                                    style = MaterialTheme.typography.bodySmall)
                                Text("Вход: ${row.optString("lastLoginAt").ifBlank { "—" }} · Последняя активность: ${row.optString("lastSeenAt").ifBlank { "—" }}",
                                    style = MaterialTheme.typography.bodySmall)
                                if (!row.optBoolean("isAdmin")) TextButton(onClick = {
                                    pendingDelete = row; blacklist = false
                                }) { Text("Удалить пользователя") }
                            }
                        }
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = { refresh() }, enabled = !busy) { Text("Обновить") }
                    Button(onClick = onClose, modifier = Modifier.testTag("admin-close-text")) { Text("Закрыть") }
                }
            }
        }
    }
    pendingDelete?.let { row ->
        AlertDialog(onDismissRequest = { pendingDelete = null },
            title = { Text("Удалить пользователя?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(row.optString("email"))
                    Text("Данные пользователя будут удалены без возможности восстановления.")
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = blacklist, onCheckedChange = { blacklist = it })
                        Text("Заблокировать повторный вход")
                    }
                }
            }, confirmButton = {
                TextButton(onClick = {
                    val id = row.optString("id")
                    pendingDelete = null
                    scope.launch {
                        busy = true
                        error = null
                        try { deleteUser(id, blacklist); payload = load() }
                        catch (failure: Exception) { error = failure.message ?: "Не удалось удалить пользователя" }
                        finally { busy = false }
                    }
                }) { Text("Удалить") }
            }, dismissButton = {
                TextButton(onClick = { pendingDelete = null }) { Text("Отмена") }
            })
    }
}
