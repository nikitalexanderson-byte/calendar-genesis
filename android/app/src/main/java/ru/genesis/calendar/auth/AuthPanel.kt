package ru.genesis.calendar.auth

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ru.genesis.calendar.GenesisApplication
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Insert into settings. There is deliberately no automatic network request or Google sign-in. */
@Composable
fun AuthPanel(app: GenesisApplication) {
    val controller = remember(app) { AuthController.get(app) }
    val state by controller.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = context.activity()
    Card(Modifier.fillMaxWidth().testTag("auth-panel")) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Вход в GENESIS", style = MaterialTheme.typography.titleMedium)
            Text("Это проверка серверного входа. Задачи и привычки этой сборки остаются локальными: загрузка данных сайта и синхронизация ещё не подключены.", style = MaterialTheme.typography.bodySmall)
            if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.user?.let { identity ->
                Text(identity.displayName, style = MaterialTheme.typography.titleSmall)
                Text(identity.email)
            }
            Text(state.message, modifier = Modifier.testTag("auth-status"))
            state.checkedAt?.let { time ->
                Text("Проверено: " + DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm")
                    .format(Instant.ofEpochMilli(time).atZone(ZoneId.systemDefault())), style = MaterialTheme.typography.bodySmall)
            }
            Button(onClick = { activity?.let(controller::signIn) }, enabled = !state.busy && activity != null,
                modifier = Modifier.fillMaxWidth().testTag("auth-google-sign-in")) {
                Text("Войти через Google")
            }
            OutlinedButton(onClick = controller::checkSession, enabled = !state.busy,
                modifier = Modifier.fillMaxWidth().testTag("auth-check-session")) { Text("Проверить серверную сессию") }
            OutlinedButton(onClick = controller::logout,
                modifier = Modifier.fillMaxWidth().testTag("auth-logout")) { Text("Выйти / отменить вход") }
        }
    }
}

private tailrec fun Context.activity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> if (baseContext === this) null else baseContext.activity()
    else -> null
}
