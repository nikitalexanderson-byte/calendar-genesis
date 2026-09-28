package ru.genesis.calendar.auth

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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

/** Native account and sync settings, grouped by user intent instead of one long card. */
@Composable
fun AuthPanel(app: GenesisApplication, localLanguage: String, onLanguage: (String) -> Unit) {
    val controller = remember(app) { AuthController.get(app) }
    val state by controller.state.collectAsStateWithLifecycle()
    val taskSync by controller.taskSync.collectAsStateWithLifecycle()
    val activity = LocalContext.current.activity()
    var confirmKeepLocal by remember { mutableStateOf(false) }
    var confirmKeepRemote by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxWidth().testTag("auth-panel"), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        AccountSubsection("auth-sign-in-block", "G", "Вход в GENESIS",
            "Защищённая учётная запись и состояние сессии") {
            Text("После Google-входа данные сайта и задачи Google открываются в отдельной защищённой копии. Локальные черновики не перезаписываются.",
                style = MaterialTheme.typography.bodySmall)
            if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.user?.let { identity ->
                Text(identity.displayName, style = MaterialTheme.typography.titleSmall)
                Text(identity.email, style = MaterialTheme.typography.bodySmall)
            }
            Text(state.message, modifier = Modifier.testTag("auth-status"), style = MaterialTheme.typography.bodySmall)
            state.checkedAt?.let { time ->
                Text("Проверено: " + DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm")
                    .format(Instant.ofEpochMilli(time).atZone(ZoneId.systemDefault())),
                    style = MaterialTheme.typography.labelSmall)
            }
            if (state.user == null) {
                Button(onClick = { activity?.let { controller.signIn(it, localLanguage) } },
                    enabled = !state.busy && activity != null,
                    modifier = Modifier.fillMaxWidth().testTag("auth-google-sign-in")) {
                    Text("Войти через Google")
                }
            } else {
                OutlinedButton(onClick = controller::logout,
                    modifier = Modifier.fillMaxWidth().testTag("auth-logout")) { Text("Выйти") }
            }
        }

        AccountSubsection("auth-language-block", "文", "Язык интерфейса",
            if (state.user != null) "Выбор сохраняется в аккаунте GENESIS" else "Выбор хранится на этом устройстве") {
            LanguageChips(localLanguage, onLanguage = onLanguage)
            Text(if (state.user != null)
                "Календарь, время и гадания сохраняются в аккаунте GENESIS и зеркалируются на устройстве."
            else "До входа эти настройки сохраняются только на устройстве.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        AccountSubsection("auth-cloud-block", "☁", "Облако",
            "Что хранится в GENESIS, а что синхронизируется с Google") {
            val cloud = state.preview
            CloudDestination("Сайт GENESIS",
                if (cloud == null) "Ожидает загрузки защищённого пространства" else "Версия облака: ${cloud.version}",
                if (cloud == null) "Проекты, категории, привычки, отметки, сон, настроение, награды и испытания."
                else "${cloud.projects} проектов · ${cloud.categories} категорий · ${cloud.habits} привычек · ${cloud.completions} отметок\n" +
                    "Сон: ${cloud.sleepEntries} · настроение: ${cloud.moodEntries} · награды: ${cloud.rewards} · испытания: ${cloud.quests}")
            val access = GoogleServiceAccess.primary(state.accountSettings)
            CloudDestination("Google-аккаунт",
                if (access.complete) "Calendar и Tasks подключены" else "Calendar и Tasks требуют подключения",
                if (cloud?.tasks == null) "События календаря и задачи Google появятся после подключения сервисов."
                else "Задачи Google: ${cloud.tasks} · списки: ${cloud.taskLists ?: 0}")
            if (taskSync.scope == app.workspaceScope) {
                AccountTaskSyncNotice(taskSync)
                taskSync.received?.let { count ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Получено с сервера:", style = MaterialTheme.typography.bodySmall)
                        Text(count.toString(), style = MaterialTheme.typography.bodySmall)
                    }
                }
                taskSync.available?.let { count ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Задач на устройстве:", style = MaterialTheme.typography.bodySmall)
                        Text(count.toString(), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            if (cloud?.hasGoogleSyncWarning == true) {
                Text("Google Tasks сообщил о неполной загрузке. Объединение пока недоступно.",
                    color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
            Text("Изменения проектов и привычек синхронизируются с зашифрованным пространством, задачи — с Google. При конфликте локальная копия сохраняется.",
                style = MaterialTheme.typography.bodySmall)
            if (state.user != null) OutlinedButton(onClick = controller::refresh,
                enabled = !state.busy && !taskSync.loading,
                modifier = Modifier.fillMaxWidth().testTag("auth-sync-retry")) { Text("Повторить синхронизацию") }
            if (state.workspaceConflictPath != null) {
                Text("Одно и то же поле изменено на сайте и на телефоне. Обычная синхронизация остановлена; обе копии сохранены.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                OutlinedButton(onClick = { confirmKeepLocal = true },
                    modifier = Modifier.fillMaxWidth().testTag("auth-resolve-keep-local")) { Text("Оставить изменения телефона") }
                OutlinedButton(onClick = { confirmKeepRemote = true },
                    modifier = Modifier.fillMaxWidth().testTag("auth-resolve-keep-remote")) { Text("Оставить изменения сайта") }
            }
        }

        if (state.user != null) {
            AccountSubsection("auth-google-services-block", "↻", "Google Calendar и Tasks",
                "Разрешения и фоновая синхронизация") {
                GoogleServicesConnectPanel(state, controller, showWhenComplete = true, embedded = true)
            }
            AccountSubsection("auth-multi-account-block", "◉", "Несколько Google-аккаунтов",
                "Связанные аккаунты и правила отправки задач") {
                MultiAccountPanel(state, controller, showHeading = false)
            }
        }
    }

    if (confirmKeepLocal) AlertDialog(onDismissRequest = { confirmKeepLocal = false },
        title = { Text("Оставить версию телефона?") },
        text = { Text("Совпавшее поле на сайте будет заменено вашей локальной версией. Остальные изменения сайта сохранятся. Задачи Google это действие не затрагивает.") },
        confirmButton = { TextButton(onClick = { confirmKeepLocal = false; controller.keepLocalWorkspaceChanges() }) {
            Text("Оставить на телефоне") } },
        dismissButton = { TextButton(onClick = { confirmKeepLocal = false }) { Text("Отмена") } })
    if (confirmKeepRemote) AlertDialog(onDismissRequest = { confirmKeepRemote = false },
        title = { Text("Оставить версию сайта?") },
        text = { Text("Только совпавшие изменения телефона будут заменены версией сайта. Остальные ваши изменения и задачи Google сохранятся.") },
        confirmButton = { TextButton(onClick = { confirmKeepRemote = false; controller.keepRemoteWorkspaceChanges() }) {
            Text("Оставить на сайте") } },
        dismissButton = { TextButton(onClick = { confirmKeepRemote = false }) { Text("Отмена") } })
}

@Composable
fun AccountTaskSyncNotice(state: AccountTaskSyncState, modifier: Modifier = Modifier) {
    val notice = state.notice ?: return
    Column(modifier.fillMaxWidth().testTag("account-task-sync-status"),
        verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        Text(notice, style = MaterialTheme.typography.bodySmall,
            color = if (state.issue == null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.error)
    }
}

/** Permanent project links are intentionally outside the account and sync section. */
@Composable
fun GenesisLinksPanel() {
    val context = LocalContext.current
    val openLinkError = genesisTranslate("Не удалось открыть ссылку в браузере.")
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
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

@Composable
private fun AccountSubsection(tag: String, symbol: String, title: String, subtitle: String,
    content: @Composable ColumnScope.() -> Unit) {
    Surface(Modifier.fillMaxWidth().testTag(tag), shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Surface(Modifier.size(34.dp), shape = RoundedCornerShape(10.dp), color = Color(0xff123b36)) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(symbol, color = Color(0xffffe4a6), style = MaterialTheme.typography.titleSmall)
                    }
                }
                Column(Modifier.weight(1f)) {
                    Text(title, style = MaterialTheme.typography.titleMedium)
                    Text(subtitle, style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            content()
        }
    }
}

@Composable
private fun CloudDestination(title: String, status: String, details: String) {
    Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainerHigh) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            Text(status, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
            Text(details, style = MaterialTheme.typography.bodySmall)
        }
    }
}

internal tailrec fun Context.activity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> if (baseContext === this) null else baseContext.activity()
    else -> null
}
