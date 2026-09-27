package ru.genesis.calendar.auth

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.ui.LanguageChips
import ru.genesis.calendar.ui.Text
import ru.genesis.calendar.ui.genesisTranslate
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Native account, sync status and permanent project links. */
@Composable
fun AuthPanel(app: GenesisApplication) {
    val controller = remember(app) { AuthController.get(app) }
    val state by controller.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = context.activity()
    val openLinkError = genesisTranslate("Не удалось открыть ссылку в браузере.")
    var confirmKeepLocal by remember { mutableStateOf(false) }
    var confirmKeepRemote by remember { mutableStateOf(false) }
    Card(Modifier.fillMaxWidth().testTag("auth-panel")) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Вход в GENESIS", style = MaterialTheme.typography.titleMedium)
            Text("После Google-входа данные сайта и задачи Google открываются в отдельной защищённой копии. Локальные черновики не перезаписываются.", style = MaterialTheme.typography.bodySmall)
            if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.user?.let { identity ->
                Text(identity.displayName, style = MaterialTheme.typography.titleSmall)
                Text(identity.email)
                Text(if (state.accountSettings?.language == "en") "Interface language" else "Язык интерфейса",
                    style = MaterialTheme.typography.bodySmall)
                LanguageChips(state.accountSettings?.language ?: "ru") {
                    controller.updateSharedPreference("language", it)
                }
            }
            state.preview?.let { cloud ->
                Text("Облако · версия ${cloud.version}", style = MaterialTheme.typography.titleSmall)
                Text("${cloud.projects} проектов · ${cloud.categories} категорий · ${cloud.habits} привычек · ${cloud.completions} отметок")
                cloud.tasks?.let { Text("Задачи сайта: $it · списки: ${cloud.taskLists ?: 0}") }
                Text("Сон: ${cloud.sleepEntries} · настроение: ${cloud.moodEntries} · награды: ${cloud.rewards} · испытания: ${cloud.quests}")
                if (cloud.hasGoogleSyncWarning) Text("Google Tasks сообщил о неполной загрузке. Объединение пока недоступно.",
                    color = MaterialTheme.colorScheme.error)
                Text("Изменения проектов и привычек синхронизируются с зашифрованным пространством, задачи — с Google. При конфликте локальная копия сохраняется.", style = MaterialTheme.typography.bodySmall)
            }
            if (state.user != null) GoogleServicesConnectPanel(state, controller, showWhenComplete = true)
            Text(state.message, modifier = Modifier.testTag("auth-status"))
            state.checkedAt?.let { time ->
                Text("Проверено: " + DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm")
                    .format(Instant.ofEpochMilli(time).atZone(ZoneId.systemDefault())), style = MaterialTheme.typography.bodySmall)
            }
            if (state.user == null) Button(onClick = { activity?.let { controller.signIn(it) } },
                enabled = !state.busy && activity != null,
                modifier = Modifier.fillMaxWidth().testTag("auth-google-sign-in")) { Text("Войти через Google") }
            if (state.user != null) {
                OutlinedButton(onClick = controller::syncPending,
                    modifier = Modifier.fillMaxWidth().testTag("auth-sync-retry")) { Text("Повторить синхронизацию") }
                if (state.workspaceConflictPath != null) {
                    Text("Одно и то же поле изменено на сайте и на телефоне. Обычная синхронизация остановлена; обе копии сохранены.",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                    OutlinedButton(onClick = { confirmKeepLocal = true },
                        modifier = Modifier.fillMaxWidth().testTag("auth-resolve-keep-local")) {
                        Text("Оставить изменения телефона")
                    }
                    OutlinedButton(onClick = { confirmKeepRemote = true },
                        modifier = Modifier.fillMaxWidth().testTag("auth-resolve-keep-remote")) {
                        Text("Оставить изменения сайта")
                    }
                }
                OutlinedButton(onClick = controller::logout,
                    modifier = Modifier.fillMaxWidth().testTag("auth-logout")) { Text("Выйти") }
            }
            if (state.user != null) MultiAccountPanel(state, controller)
            HorizontalDivider()
            Text("Ссылки GENESIS", style = MaterialTheme.typography.titleSmall)
            listOf(
                Triple("Академия Генезис · Telegram", "https://t.me/genesisbasilea", "account-link-telegram"),
                Triple("Поддержать проект · Donate.Stream", "https://donate.stream/genesiscalendar", "account-link-donate"),
                Triple("Веб-версия GENESIS", "https://genesiscalendar.ru/", "account-link-web"),
            ).forEach { (label, url, tag) ->
                OutlinedButton(onClick = {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    runCatching { context.startActivity(intent) }.onFailure {
                        Toast.makeText(context, openLinkError, Toast.LENGTH_SHORT).show()
                    }
                }, modifier = Modifier.fillMaxWidth().testTag(tag)) { Text(label) }
            }
        }
    }
    if (confirmKeepLocal) AlertDialog(onDismissRequest = { confirmKeepLocal = false },
        title = { Text("Оставить версию телефона?") },
        text = { Text("Совпавшее поле на сайте будет заменено вашей локальной версией. Остальные изменения сайта сохранятся. Задачи Google это действие не затрагивает.") },
        confirmButton = { TextButton(onClick = {
            confirmKeepLocal = false
            controller.keepLocalWorkspaceChanges()
        }) { Text("Оставить на телефоне") } },
        dismissButton = { TextButton(onClick = { confirmKeepLocal = false }) { Text("Отмена") } })
    if (confirmKeepRemote) AlertDialog(onDismissRequest = { confirmKeepRemote = false },
        title = { Text("Оставить версию сайта?") },
        text = { Text("Только совпавшие изменения телефона будут заменены версией сайта. Остальные ваши изменения и задачи Google сохранятся.") },
        confirmButton = { TextButton(onClick = {
            confirmKeepRemote = false
            controller.keepRemoteWorkspaceChanges()
        }) { Text("Оставить на сайте") } },
        dismissButton = { TextButton(onClick = { confirmKeepRemote = false }) { Text("Отмена") } })
}

internal tailrec fun Context.activity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> if (baseContext === this) null else baseContext.activity()
    else -> null
}
