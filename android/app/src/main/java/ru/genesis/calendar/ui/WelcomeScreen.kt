package ru.genesis.calendar.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.genesis.calendar.auth.AuthController
import ru.genesis.calendar.auth.AuthPanelState
import ru.genesis.calendar.auth.activity
import ru.genesis.calendar.BuildConfig
import ru.genesis.calendar.R
import com.yandex.authsdk.YandexAuthLoginOptions
import com.yandex.authsdk.YandexAuthOptions
import com.yandex.authsdk.YandexAuthResult
import com.yandex.authsdk.YandexAuthSdk

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
    var yandexAvailable by remember { mutableStateOf(false) }
    LaunchedEffect(controller, state.ready, state.busy) {
        if (!state.busy) {
            yandexAvailable = controller.yandexAvailable()
        }
    }
    val yandexSdk = remember(context) {
        if (BuildConfig.YANDEX_CLIENT_ID.isNotBlank()) YandexAuthSdk.create(YandexAuthOptions(context)) else null
    }
    val yandexSignInError = genesisTranslate("Вход через Яндекс не завершён")
    val yandexLauncher = if (yandexSdk != null) rememberLauncherForActivityResult(yandexSdk.contract) { result ->
        when (result) {
            is YandexAuthResult.Success -> controller.signInWithYandex(result.token.value, preferredLanguage ?: language)
            is YandexAuthResult.Failure -> Toast.makeText(context, yandexSignInError, Toast.LENGTH_SHORT).show()
            YandexAuthResult.Cancelled -> Unit
        }
    } else null
    val showYandex = yandexAvailable && yandexLauncher != null
    BoxWithConstraints(Modifier.fillMaxSize().background(Brush.verticalGradient(
        listOf(welcomeNight, welcomeGreen, welcomeNight)))
        .safeDrawingPadding().imePadding().testTag("genesis-welcome")) {
        val intro: @Composable () -> Unit = {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                OriginalImage("icons/icon-192.png", "GENESIS", Modifier.size(44.dp))
                Text("GENESIS", Modifier.padding(start = 10.dp),
                    color = welcomeCream,
                    style = MaterialTheme.typography.titleLarge.copy(fontFamily = FontFamily.Serif))
            }
            Text("Выбор языка", color = welcomeMuted, style = MaterialTheme.typography.labelMedium)
            LanguageChips(language, dark = true, flagsOnly = true, onLanguage = onLanguage)
            HorizontalDivider(color = welcomeGold.copy(alpha = 0.24f))
            Column(Modifier.testTag("welcome-intro"),
                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (language == "en") "GENESIS · CALENDAR AND PROJECT MANAGER"
                    else "GENESIS · КАЛЕНДАРЬ И МЕНЕДЖЕР ПРОЕКТОВ",
                    color = welcomeGold, style = MaterialTheme.typography.labelMedium)
                Text("GENESIS", color = welcomeCream,
                    style = MaterialTheme.typography.displayMedium.copy(
                        fontFamily = FontFamily.Serif, letterSpacing = 5.sp))
                Text(if (language == "en") "Task and project\ncalendar"
                    else "Календарь задач\nи проектов",
                    color = welcomeGold,
                    style = MaterialTheme.typography.headlineLarge.copy(
                        fontFamily = FontFamily.Serif, fontStyle = FontStyle.Italic))
                Text(if (language == "en")
                    "Plan tasks, projects and recurring practices. Keep your private workspace synchronized across the web and your devices."
                    else "Планируйте задачи, проекты и повторяющиеся практики. Личное пространство синхронизируется с сайтом и вашими устройствами.",
                    color = welcomeMuted, style = MaterialTheme.typography.bodyLarge)
            }
        }
        val details: @Composable () -> Unit = {
            Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(
                topStart = 6.dp, topEnd = 26.dp, bottomStart = 26.dp, bottomEnd = 6.dp),
                color = welcomeCream) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Surface(Modifier.size(52.dp), shape = CircleShape, color = welcomeNight,
                            border = BorderStroke(1.dp, welcomeGold)) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("•", color = welcomeGold,
                                    style = MaterialTheme.typography.displaySmall)
                            }
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(if (language == "en") "PRIVATE WORKSPACE" else "ЛИЧНОЕ ПРОСТРАНСТВО",
                                color = welcomeGold, style = MaterialTheme.typography.labelSmall)
                            Text(if (language == "en") "Sign in to GENESIS" else "Войти в GENESIS",
                                color = welcomeNight,
                                style = MaterialTheme.typography.titleLarge.copy(fontFamily = FontFamily.Serif))
                        }
                    }
                    Text(if (showYandex && language == "en")
                            "Choose Google or Yandex sign-in. GENESIS receives basic profile data from your chosen provider. Connect the calendar separately."
                        else if (showYandex)
                            "Выберите вход через Google или Яндекс. GENESIS получит основные данные профиля от выбранного сервиса. Подключение календаря выполняется отдельно."
                        else if (language == "en")
                            "Sign in with Google to open your encrypted GENESIS data and synchronized tasks."
                        else "Войдите через Google, чтобы открыть зашифрованные данные GENESIS и синхронизированные задачи.",
                        color = Color(0xFF405B59), style = MaterialTheme.typography.bodyMedium)
                    if (showYandex) Text(if (language == "en") "Russian law provides local sign-in methods for users in Russia (Federal Law 149-FZ, Article 8)."
                        else "Для пользователей, находящихся в России, закон РФ предусматривает российские способы входа (149-ФЗ, ст. 8).",
                        color = Color(0xFF405B59), style = MaterialTheme.typography.bodySmall)
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                WelcomeTrustLine("▣", if (showYandex && language == "en")
                    "Tasks sync through the selected calendar after connection"
                    else if (showYandex)
                    "Задачи синхронизируются через выбранный календарь после подключения"
                    else if (language == "en") "Tasks stay in Google and on your device"
                    else "Задачи остаются в Google и на вашем устройстве")
                WelcomeTrustLine("◇", if (language == "en") "Project structure is transmitted encrypted"
                    else "Структура проектов передаётся зашифрованной")
                WelcomeTrustLine("◉", if (language == "en") "Private data opens only after sign-in"
                    else "Личные данные открываются только после входа")
            }
        }
        val wideLayout = maxWidth >= 760.dp
        Column(Modifier.fillMaxSize()) {
            if (wideLayout) {
                Row(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 28.dp), horizontalArrangement = Arrangement.spacedBy(32.dp)) {
                    Column(Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState())
                        .padding(top = 24.dp, bottom = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)) { intro() }
                    Column(Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState())
                        .padding(top = 24.dp, bottom = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)) { details() }
                }
            } else Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())
                .padding(start = 20.dp, top = 16.dp, end = 20.dp,
                    bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)) { intro(); details() }
            Surface(Modifier.align(Alignment.CenterHorizontally).widthIn(max = 720.dp).fillMaxWidth(),
                color = welcomeNight, shadowElevation = 12.dp) {
                Column(Modifier.testTag("welcome-actions").padding(horizontal = 20.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(if (showYandex) "Безопасный вход"
                        else if (language == "en") "SECURE SIGN-IN THROUGH GOOGLE"
                        else "БЕЗОПАСНЫЙ ВХОД ЧЕРЕЗ GOOGLE",
                        Modifier.fillMaxWidth(), color = welcomeGold,
                        style = MaterialTheme.typography.labelSmall)
                    Text(state.message, Modifier.fillMaxWidth().testTag("welcome-status")
                        .semantics { liveRegion = LiveRegionMode.Polite },
                        color = welcomeMuted, style = MaterialTheme.typography.bodySmall)
                    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth(),
                        color = welcomeGold, trackColor = welcomeGreen)
                    if (state.user == null) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            ProviderSignInIcon("google", Color.White, Color(0xFF202124),
                                if (language == "en") "Sign in with Google" else "Войти через Google",
                                "welcome-google-sign-in", !state.busy && activity != null,
                                Modifier.weight(1f)) { activity?.let { controller.signIn(it, preferredLanguage) } }
                            if (showYandex) ProviderSignInIcon("yandex", Color(0xFFFFF7F4), Color(0xFF202124),
                                if (language == "en") "Sign in with Yandex" else "Войти через Яндекс",
                                "welcome-yandex-sign-in", !state.busy,
                                Modifier.weight(1f)) { yandexLauncher?.launch(YandexAuthLoginOptions()) }
                        }
                        if (showYandex) Row(Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(if (language == "en") "Recommended for users who are not Russian citizens"
                                else "Рекомендуется тем, кто не является гражданином России",
                                Modifier.weight(1f), color = welcomeMuted,
                                style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center)
                            Text(if (language == "en") "Recommended for Russian citizens"
                                else "Рекомендуется гражданам России",
                                Modifier.weight(1f), color = welcomeMuted,
                                style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center)
                        }
                    } else {
                        Button(onClick = controller::checkSession, enabled = !state.busy,
                            colors = ButtonDefaults.buttonColors(containerColor = welcomeGold,
                                contentColor = welcomeNight, disabledContainerColor = Color(0xFF615C4E),
                                disabledContentColor = welcomeCream),
                            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("welcome-google-sign-in")) {
                            Text(if (state.busy) {
                                if (language == "en") "Checking account…" else "Проверяем аккаунт…"
                            } else if (language == "en") "Retry synchronization" else "Повторить синхронизацию")
                        }
                    }
                    TextButton(onClick = { openWebsite(context) }, modifier = Modifier.fillMaxWidth()
                        .testTag("welcome-open-web")) {
                        Text(if (language == "en") "Open the web version" else "Открыть веб-версию",
                            color = welcomeMuted, style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }
    }
}

@Composable
private fun ProviderSignInIcon(provider: String, background: Color, foreground: Color,
    description: String, tag: String, enabled: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val translatedDescription = genesisTranslate(description)
    Button(onClick = onClick, enabled = enabled,
        modifier = modifier.heightIn(min = 56.dp).testTag(tag)
            .semantics { contentDescription = translatedDescription },
        shape = AffairsLayout.controlShape,
        border = BorderStroke(1.dp, welcomeGold.copy(alpha = .42f)),
        contentPadding = PaddingValues(horizontal = 8.dp),
        colors = ButtonDefaults.buttonColors(containerColor = background, contentColor = foreground,
            disabledContainerColor = welcomeGreen, disabledContentColor = welcomeMuted)) {
        if (provider == "google") Image(painterResource(R.drawable.google_signin_mark), null,
            Modifier.size(30.dp))
        else Surface(Modifier.size(30.dp), shape = CircleShape, color = Color(0xFFE32924)) {
            Box(contentAlignment = Alignment.Center) {
                Text("Я", color = Color.White,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
            }
        }
        Spacer(Modifier.width(5.dp))
        androidx.compose.material3.Text(translatedDescription,
            modifier = Modifier.testTag("$tag-label"),
            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
            textAlign = TextAlign.Start, maxLines = 2)
    }
}

@Composable
private fun WelcomeTrustLine(symbol: String, text: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Surface(Modifier.size(36.dp), shape = CircleShape, color = welcomeGreen,
            border = BorderStroke(1.dp, welcomeGold.copy(alpha = .42f))) {
            Box(contentAlignment = Alignment.Center) {
                Text(symbol, color = welcomeGold, style = MaterialTheme.typography.titleMedium)
            }
        }
        Text(text, Modifier.weight(1f), color = welcomeMuted,
            style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
fun LanguageChips(language: String, dark: Boolean = false, flagsOnly: Boolean = false,
    onLanguage: (String) -> Unit) {
    val languages = listOf(Triple("ru", "🇷🇺", "Русский"), Triple("en", "🇬🇧", "English"),
            Triple("el", "🇬🇷", "Ελληνικά"), Triple("de", "🇩🇪", "Deutsch"),
            Triple("fr", "🇫🇷", "Français"), Triple("es", "🇪🇸", "Español"),
            Triple("it", "🇮🇹", "Italiano"), Triple("pt", "🇵🇹", "Português"),
            Triple("pl", "🇵🇱", "Polski"), Triple("sr", "🇷🇸", "Српски"),
            Triple("uk", "🇺🇦", "Українська"), Triple("zh", "🇨🇳", "简体中文"),
            Triple("tr", "🇹🇷", "Türkçe"), Triple("ja", "🇯🇵", "日本語"))
    if (flagsOnly) {
        BoxWithConstraints(Modifier.fillMaxWidth().testTag("welcome-language-grid")) {
            // Keep complete rows as languages are added; compact cells still have a 48 dp height.
            val columns = balancedLanguageColumns(languages.size, ((maxWidth.value + 2f) / 46f).toInt())
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                languages.chunked(columns).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        row.forEach { (value, flag, label) ->
                            val active = language == value
                            Surface(onClick = { onLanguage(value) },
                                modifier = Modifier.weight(1f).height(48.dp).testTag("language-$value")
                                    .semantics {
                                        contentDescription = label
                                        role = Role.RadioButton
                                        selected = active
                                    },
                                shape = RoundedCornerShape(10.dp),
                                color = if (active) Color(0xFF2E7770) else welcomeGreen,
                                border = BorderStroke(1.dp, if (active) welcomeGold else welcomeMuted)) {
                                Box(contentAlignment = Alignment.Center) {
                                    androidx.compose.material3.Text(flag, fontSize = 20.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    } else {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)) {
        languages.forEach { (value, flag, label) ->
                FilterChip(selected = language == value, onClick = { onLanguage(value) },
                    label = {
                        Row(verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            androidx.compose.material3.Text(flag)
                            if (!flagsOnly) androidx.compose.material3.Text(label)
                        }
                    },
                    colors = if (dark) FilterChipDefaults.filterChipColors(
                        containerColor = welcomeGreen,
                        labelColor = welcomeCream,
                        selectedContainerColor = Color(0xFF2E7770),
                        selectedLabelColor = Color.White) else FilterChipDefaults.filterChipColors(),
                    modifier = Modifier.heightIn(min = 48.dp).testTag("language-$value")
                        .semantics { contentDescription = label })
            }
    }
    }
}

internal fun balancedLanguageColumns(count: Int, availableColumns: Int): Int =
    (minOf(count, availableColumns.coerceAtLeast(1), 7) downTo 1).first { count % it == 0 }

private fun openWebsite(context: Context) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW,
        Uri.parse("${ru.genesis.calendar.auth.AUTH_ORIGIN}/")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}
