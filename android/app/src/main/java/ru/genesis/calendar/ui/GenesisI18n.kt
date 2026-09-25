package ru.genesis.calendar.ui

import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.domain.SacredCatalog
import java.util.concurrent.ConcurrentHashMap

/** The web's reviewed English copy is bundled into the offline APK. */
val LocalGenesisLanguage = compositionLocalOf { "ru" }

private val nativeCopy = mapOf(
    "Настройки" to "Settings", "Задачи" to "Tasks", "Сон и настроение" to "Sleep & mood",
    "Новая привычка" to "New habit", "Обычные привычки" to "Habits",
    "Подборка" to "Suggestions", "Скрыть подборку" to "Hide suggestions",
    "Путь Героя и награды" to "Hero's path & rewards", "История отметок" to "Completion history",
    "Мои привычки" to "My habits", "Открыть путь и награды" to "Open path & rewards",
    "Свернуть путь" to "Collapse path", "Древо рангов, достижения и защита серии. Накопленный XP не тратится." to
        "Rank tree, achievements, and streak protection. Earned XP is never spent.",
    "Оставить изменения телефона" to "Keep phone changes", "Оставить изменения сайта" to "Keep website changes",
    "Оставить версию телефона?" to "Keep the phone version?", "Оставить версию сайта?" to "Keep the website version?",
    "Оставить на телефоне" to "Keep on phone", "Оставить на сайте" to "Keep on website",
    "Одно и то же поле изменено на сайте и на телефоне. Обычная синхронизация остановлена; обе копии сохранены." to
        "The same field changed on the website and phone. Automatic sync stopped; both copies are safe.",
    "Совпавшее поле на сайте будет заменено вашей локальной версией. Остальные изменения сайта сохранятся. Задачи Google это действие не затрагивает." to
        "The conflicting website field will use your phone version. Other website changes and Google tasks are preserved.",
    "Только совпавшие изменения телефона будут заменены версией сайта. Остальные ваши изменения и задачи Google сохранятся." to
        "Only conflicting phone changes will use the website version. Your other changes and Google tasks are preserved.",
    "ЕЖЕДНЕВНЫЙ РИТМ" to "DAILY RHYTHM", "Свободный день" to "A free day",
    "ГРИГОРИАНСКИЙ ДЕНЬ" to "GREGORIAN DAY", "ЛУННЫЙ ДЕНЬ" to "LUNAR DAY",
    "САКРАЛЬНЫЙ ДЕНЬ" to "SACRED DAY", "Открыть день и задачи" to "Open day and tasks",
    "ГРИГОРИАНСКИЙ КАЛЕНДАРЬ" to "GREGORIAN CALENDAR",
    "Воскресенье" to "Sunday", "Понедельник" to "Monday", "Вторник" to "Tuesday",
    "Среда" to "Wednesday", "Четверг" to "Thursday", "Пятница" to "Friday",
    "Суббота" to "Saturday", "Части тела:" to "Body parts:",
    "День Аполлона" to "Day of Apollo", "День Луны — Селены, Гекаты и Артемиды" to
        "Day of the Moon — Selene, Hecate, and Artemis", "День Ареса" to "Day of Ares",
    "День Гермеса" to "Day of Hermes", "День Зевса и Геры" to "Day of Zeus and Hera",
    "День Афродиты, Гестии и Диониса" to "Day of Aphrodite, Hestia, and Dionysus",
    "День Кроноса, Аида и Посейдона" to "Day of Cronus, Hades, and Poseidon",
    "К текущему месяцу" to "Current month", "Год" to "Year", "Календарь отображения" to "Display calendar",
    "Календарь ввода и повторений" to "Task & recurrence calendar",
    "Русский" to "Russian", "English" to "English", "Язык интерфейса" to "Interface language",
    "Личные данные сохраняются на этом устройстве до входа в аккаунт." to
        "Your data stays on this device until you sign in.",
    "Ежедневная практика, сон и настроение в одном защищённом пространстве." to
        "Daily practice, sleep and mood in one protected space.",
    "Защищённая копия аккаунта GENESIS · изменения синхронизируются с сайтом" to
        "Protected GENESIS account copy · changes sync with the website",
    "Здесь появятся ваши практики. Выберите идею из подборки или создайте свою." to
        "Your practices will appear here. Pick a suggestion or create your own.",
    "XP открывает ступени ранга; Лавры можно тратить на защиту серии. Ранги не заменяют ваши привычки." to
        "XP unlocks ranks; Laurels can protect your streak. Ranks never replace your habits.",
)

private object TranslationCatalog {
    @Volatile private var dictionary: Map<String, String>? = null
    @Volatile private var fragments: List<Map.Entry<String, String>> = emptyList()
    private val resolved = ConcurrentHashMap<String, String>()
    private val cyrillic = Regex("[А-Яа-яЁё]")

    private fun source(context: android.content.Context): Map<String, String> =
        dictionary ?: synchronized(this) {
            dictionary ?: runCatching {
                fun objectAsset(name: String): JSONObject = context.assets.open("originals/i18n/$name")
                    .bufferedReader().use { JSONObject(it.readText()) }
                val web = objectAsset("translations.en.json")
                val curated = objectAsset("curated-translations.en.json")
                val englishDays = context.assets.open("originals/i18n/calendar-days.en.json")
                    .bufferedReader().use { JSONArray(it.readText()) }
                val sacredDays = SacredCatalog.months.flatMap { it.days }
                require(englishDays.length() == sacredDays.size)
                buildMap {
                    web.keys().forEach { put(it, web.getString(it)) }
                    curated.keys().forEach { put(it, curated.getString(it)) }
                    sacredDays.forEachIndexed { index, day ->
                        val english = englishDays.getJSONObject(index)
                        put(day.name, english.getString("name"))
                        put(day.description, english.getString("description"))
                    }
                }
            }.getOrElse { emptyMap() }.also {
                fragments = (it + nativeCopy).entries.filter { entry -> entry.key.length in 4..180 }
                    .sortedByDescending { entry -> entry.key.length }
                dictionary = it
            }
        }

    fun translate(context: android.content.Context, text: String): String = resolved.getOrPut(text) {
        val translations = source(context)
        val normalized = text.trim()
        (nativeCopy[normalized] ?: translations[normalized])?.let { return@getOrPut it }
        if (!cyrillic.containsMatchIn(normalized)) return@getOrPut text
        var result = normalized
        for ((russian, english) in fragments) {
            if (!result.contains(russian)) continue
            result = result.replace(russian, english)
        }
        if (!cyrillic.containsMatchIn(result)) result else text
    }
}

@Composable
fun genesisTranslate(source: String): String {
    if (LocalGenesisLanguage.current != "en") return source
    val context = LocalContext.current
    return remember(source, context) { TranslationCatalog.translate(context, source) }
}

/** Local Text facade keeps the Android screens in step with the bundled web translation catalog. */
@Composable
fun Text(text: String, modifier: Modifier = Modifier, color: Color = Color.Unspecified,
    fontSize: TextUnit = TextUnit.Unspecified, fontStyle: FontStyle? = null,
    fontWeight: FontWeight? = null, fontFamily: FontFamily? = null,
    letterSpacing: TextUnit = TextUnit.Unspecified, textDecoration: TextDecoration? = null,
    textAlign: TextAlign? = null, lineHeight: TextUnit = TextUnit.Unspecified,
    overflow: TextOverflow = TextOverflow.Clip, softWrap: Boolean = true,
    maxLines: Int = Int.MAX_VALUE, minLines: Int = 1,
    onTextLayout: (TextLayoutResult) -> Unit = {}, style: TextStyle = LocalTextStyle.current) {
    androidx.compose.material3.Text(text = genesisTranslate(text), modifier = modifier,
        color = color, fontSize = fontSize, fontStyle = fontStyle, fontWeight = fontWeight,
        fontFamily = fontFamily, letterSpacing = letterSpacing, textDecoration = textDecoration,
        textAlign = textAlign, lineHeight = lineHeight, overflow = overflow, softWrap = softWrap,
        maxLines = maxLines, minLines = minLines, onTextLayout = onTextLayout, style = style)
}
