package ru.genesis.calendar.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowInsetsControllerCompat
import ru.genesis.calendar.auth.AuthController
import ru.genesis.calendar.auth.AuthPanelState
import ru.genesis.calendar.auth.activity

private val welcomeNight = Color(0xFF07171B)
private val welcomeGreen = Color(0xFF103134)
private val welcomeGold = Color(0xFFC8A45E)
private val welcomeCream = Color(0xFFF6F0DF)
private val welcomeMuted = Color(0xFFB8C9C2)

/** Account-backed workspace is deliberately inaccessible before the encrypted bootstrap succeeds. */
@Composable
fun WelcomeScreen(state: AuthPanelState, controller: AuthController, language: String,
    preferredLanguage: String? = null,
    onLanguage: (String) -> Unit) {
    val context = LocalContext.current
    val activity = context.activity()
    DisposableEffect(activity) {
        activity?.let {
            WindowInsetsControllerCompat(it.window, it.window.decorView).apply {
                isAppearanceLightStatusBars = false
                isAppearanceLightNavigationBars = false
            }
        }
        onDispose {
            activity?.let {
                WindowInsetsControllerCompat(it.window, it.window.decorView).apply {
                    isAppearanceLightStatusBars = true
                    isAppearanceLightNavigationBars = true
                }
            }
        }
    }
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
        listOf(welcomeNight, welcomeGreen, welcomeNight)))
        .safeDrawingPadding().imePadding().testTag("genesis-welcome")) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())
            .padding(start = 20.dp, top = 16.dp, end = 20.dp, bottom = 108.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                OriginalImage("icons/icon-192.png", "GENESIS", Modifier.size(44.dp))
                Text("GENESIS", Modifier.padding(start = 10.dp).weight(1f),
                    color = welcomeCream,
                    style = MaterialTheme.typography.titleLarge.copy(fontFamily = FontFamily.Serif))
                LanguageChips(language, dark = true, onLanguage = onLanguage)
            }
            HorizontalDivider(color = welcomeGold.copy(alpha = 0.24f))
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(if (language == "en") "Welcome to GENESIS" else "Добро пожаловать в GENESIS",
                    color = welcomeCream,
                    style = MaterialTheme.typography.headlineLarge.copy(fontFamily = FontFamily.Serif))
                Text(if (language == "en")
                    "Calendar, projects and daily practices in harmony with time."
                    else "Календарь, проекты и ежедневные практики в гармонии со временем.",
                    color = welcomeMuted, style = MaterialTheme.typography.bodyLarge)
            }
            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, welcomeGold.copy(alpha = 0.42f)),
                colors = CardDefaults.cardColors(containerColor = welcomeNight)) {
                OriginalImage("genesis-hero.png", "GENESIS", Modifier.fillMaxWidth().height(196.dp))
            }
            Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(
                topStart = 6.dp, topEnd = 26.dp, bottomStart = 26.dp, bottomEnd = 6.dp),
                color = welcomeCream) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text(if (language == "en") "Your space, protected" else "Ваше пространство защищено",
                        color = welcomeNight,
                        style = MaterialTheme.typography.titleLarge.copy(fontFamily = FontFamily.Serif))
                    Text(if (language == "en")
                        "Sign in with Google to open your encrypted GENESIS data and synchronized tasks."
                        else "Войдите через Google, чтобы открыть зашифрованные данные GENESIS и синхронизированные задачи.",
                        color = Color(0xFF405B59), style = MaterialTheme.typography.bodyMedium)
                    Text(if (language == "en" && state.checkedAt == null) "Checking your session…"
                        else if (language == "en" && state.user == null) "Sign in is required to use the app."
                        else state.message,
                        color = if (state.user != null && state.checkedAt != null)
                            Color(0xFF9B3434) else Color(0xFF405B59),
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.testTag("welcome-status"))
                }
            }
            OutlinedButton(onClick = { openWebsite(context) }, modifier = Modifier.fillMaxWidth(),
                border = BorderStroke(1.dp, welcomeGold.copy(alpha = 0.5f)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = welcomeCream)) {
                Text(if (language == "en") "Open the web version" else "Открыть веб-версию")
            }
        }
        Surface(Modifier.align(Alignment.BottomCenter).fillMaxWidth(),
            color = welcomeNight, shadowElevation = 12.dp) {
            Column(Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth(),
                    color = welcomeGold, trackColor = welcomeGreen)
                Button(onClick = { if (state.user == null) activity?.let { controller.signIn(it, preferredLanguage) }
                    else controller.checkSession() }, enabled = !state.busy && (state.user != null || activity != null),
                    colors = ButtonDefaults.buttonColors(containerColor = welcomeGold,
                        contentColor = welcomeNight, disabledContainerColor = Color(0xFF615C4E),
                        disabledContentColor = welcomeCream),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("welcome-google-sign-in")) {
                    Text(if (state.busy) {
                        if (language == "en") "Checking account…" else "Проверяем аккаунт…"
                    } else if (state.user != null) {
                        if (language == "en") "Retry synchronization" else "Повторить синхронизацию"
                    } else if (language == "en") "Sign in with Google" else "Войти через Google")
                }
                Text(if (language == "en") "Google account required to continue"
                    else "Для продолжения нужен аккаунт Google",
                    Modifier.fillMaxWidth(), color = welcomeMuted,
                    style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center)
            }
        }
    }
}

@Composable
fun LanguageChips(language: String, dark: Boolean = false, onLanguage: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf(Triple("ru", "🇷🇺", "RU"), Triple("en", "🇺🇸", "EN"))
            .forEach { (value, flag, label) ->
                FilterChip(selected = language == value, onClick = { onLanguage(value) },
                    label = {
                        Row(verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(flag)
                            Text(label)
                        }
                    },
                    colors = if (dark) FilterChipDefaults.filterChipColors(
                        containerColor = welcomeGreen,
                        labelColor = welcomeCream,
                        selectedContainerColor = Color(0xFF2E7770),
                        selectedLabelColor = Color.White) else FilterChipDefaults.filterChipColors(),
                    modifier = Modifier.heightIn(min = 48.dp).testTag("language-$value"))
            }
    }
}

private fun openWebsite(context: Context) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW,
        Uri.parse("https://genesiscalendar.ru/")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}
