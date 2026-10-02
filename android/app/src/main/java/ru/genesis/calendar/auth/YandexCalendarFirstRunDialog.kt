package ru.genesis.calendar.auth

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.ui.Text

/** Offer CalDAV only to the signed-in Yandex account; the account screen keeps the same form available. */
@Composable
fun YandexCalendarFirstRunDialog(state: AuthPanelState, controller: AuthController) {
    val userId = state.user?.uid
    val context = LocalContext.current
    val offers = remember(context) { context.getSharedPreferences("genesis.yandex.calendar-offer", Context.MODE_PRIVATE) }
    var show by remember(userId) { mutableStateOf(false) }
    var login by remember(userId) { mutableStateOf(state.user?.email.orEmpty()) }
    var appPassword by remember(userId) { mutableStateOf("") }
    var attempted by remember(userId) { mutableStateOf(false) }
    val connected = state.accountSettings?.calendarConnected == true

    LaunchedEffect(state.ready, state.requiresSignIn, state.accountSettings?.authProvider, connected, userId) {
        if (connected || state.accountSettings?.authProvider != "yandex") {
            show = false
            appPassword = ""
        } else if (state.ready && !state.requiresSignIn && userId != null && !offers.getBoolean(userId, false)) {
            offers.edit().putBoolean(userId, true).apply()
            show = true
        }
    }
    if (!show || userId == null || state.accountSettings?.authProvider != "yandex") return

    val dismiss = {
        if (!state.busy) {
            appPassword = ""
            show = false
        }
    }
    AlertDialog(
        modifier = Modifier.testTag("yandex-calendar-first-run"),
        onDismissRequest = dismiss,
        title = { Text("Подключить Яндекс.Календарь") },
        text = {
            Column(Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("В Яндекс ID откройте «Пароли приложений» → «Календарь». Название можно придумать, а сам пароль выдаёт Яндекс. Скопируйте его сюда.",
                    style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(login, { login = it },
                    label = { Text("Логин или почта Яндекса") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("yandex-first-run-login"))
                OutlinedTextField(appPassword, { appPassword = it },
                    label = { Text("Пароль приложения Календарь") },
                    visualTransformation = PasswordVisualTransformation(), singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("yandex-first-run-password"))
                TextButton(onClick = {
                    context.startActivity(Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://id.yandex.ru/security/app-passwords"))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                }) { Text("Открыть создание пароля Календаря в Яндекс ID") }
                if (attempted) Text(state.message, style = MaterialTheme.typography.bodySmall,
                    color = if (state.busy) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.error)
            }
        },
        confirmButton = {
            Button(onClick = {
                attempted = true
                controller.connectYandexCalendar(login, appPassword)
            }, enabled = !state.busy && login.isNotBlank() && appPassword.length >= 8,
                modifier = Modifier.testTag("yandex-first-run-connect")) { Text("Подключить календарь") }
        },
        dismissButton = { TextButton(onClick = dismiss, enabled = !state.busy,
            modifier = Modifier.testTag("yandex-first-run-later")) { Text("Позже") } },
    )
}
