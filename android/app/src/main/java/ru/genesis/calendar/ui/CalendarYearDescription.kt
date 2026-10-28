package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material3.Text as MaterialText
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.ui.Dialog
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.GenesisCalendar
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.time.temporal.ChronoUnit
import java.util.Locale

private val yearCardBackground = Color(0xff08282a)
private val yearCardSurface = Color(0xff123638)
private val yearCardText = Color(0xfff5edda)
private val yearCardMuted = Color(0xffb8cac4)
private val yearCardGold = Color(0xffe4bd64)

private data class YearMetric(val value: String, val label: String)

@Composable
internal fun CalendarYearDescriptionCard(calendar: GenesisCalendar, shown: LocalDate, mode: CalendarMode,
    gregorianYearStartsInMarch: Boolean = false, onOpenDate: (LocalDate) -> Unit = {}) {
    if (!LocalSacredFeaturesEnabled.current) return
    val language = LocalGenesisLanguage.current
    val context = LocalContext.current
    fun copy(russian: String, englishText: String) = when (language) {
        "ru" -> russian
        "en" -> englishText
        else -> translateGenesisText(context, russian, language)
    }
    val sacredYear = if (mode == CalendarMode.LUNAR) calendar.lunarDate(shown).year.sacredYear else calendar.sacredDate(shown).sacredYear
    val lunarYear = remember(sacredYear) { calendar.lunarYear(sacredYear) }
    val lunarDays = ChronoUnit.DAYS.between(lunarYear.startDate, lunarYear.endDate).toString()
    var detailsOpen by rememberSaveable { mutableStateOf(false) }
    var modelOpen by rememberSaveable { mutableStateOf(false) }

    val title: String
    val eyebrow: String
    val paragraphs: List<String>
    val metrics: List<YearMetric>
    when (mode) {
        CalendarMode.SACRED -> {
            eyebrow = copy("РИТМ GENESIS", "GENESIS RHYTHM")
            title = copy("Солнечно-лунный календарь", "Solar-lunar calendar")
            paragraphs = listOf(
                copy("Год GENESIS начинается в день весеннего равноденствия и раскрывается через двенадцать месяцев. Каждый месяц несёт собственный образ, цвет, стихию и смысл — не просто отрезок времени, а отдельную ступень годового пути.",
                    "The GENESIS year begins on the spring equinox and unfolds through twelve months. Each month carries its own image, color, element, and meaning—a distinct stage of the annual path."),
                copy("В каждом месяце ровно 30 дней. Вместо привычных недель время собрано в шесть пят: коротких пятидневных ритмов, где нечётные и чётные пяты сменяют друг друга. Так солнечная мера года соединяется с живым лунным дыханием.",
                    "Each month has exactly 30 days, arranged into six five-day rhythms instead of ordinary weeks. The solar measure of the year meets the living breath of the Moon."),
                copy("Равноденствия и солнцестояния образуют четыре праздничные опоры. После двенадцатого месяца наступает Апейрон — несколько дней вне обычного счёта, пространство тишины перед новым весенним началом.",
                    "The equinoxes and solstices form four festive supports. After the twelfth month comes Apeiron: several days outside ordinary counting, a quiet space before the new spring beginning."),
            )
            metrics = listOf(YearMetric("12", copy("символических месяцев", "symbolic months")),
                YearMetric("30", copy("дней в каждом месяце", "days in each month")),
                YearMetric("6", copy("пят вместо недель", "pentads instead of weeks")),
                YearMetric("4", copy("солнечных праздника года", "solar festivals")))
        }
        CalendarMode.PROFANE -> {
            eyebrow = copy("ГРИГОРИАНСКИЙ КАЛЕНДАРЬ", "GREGORIAN CALENDAR")
            title = copy("Григорианский календарь (профанский)", "Gregorian calendar (civil)")
            paragraphs = listOf(
                copy("Современный григорианский календарь — профанская гражданская система с многослойной историей. Его месяцы и счёт года унаследованы от Рима. Семидневный ритм соединил вавилонскую астрологию, иудейскую субботу и греко-римскую планетарную традицию.",
                    "The modern Gregorian calendar is a civil system with a layered history. Its months and year count came from Rome, while its seven-day rhythm joins Babylonian astrology, the Jewish Sabbath, and Greco-Roman planetary tradition."),
                copy("Январь связывали с Янусом, богом дверей и начал. Реформа Юлия Цезаря закрепила 1 января как гражданское начало года, а реформа папы Григория XIII в 1582 году вернула весеннее равноденствие к церковному расчёту Пасхи.",
                    "January was linked to Janus, god of doors and beginnings. Julius Caesar's reform established January 1 as the civil opening of the year, and Pope Gregory XIII's 1582 reform restored the spring equinox to the Church's Easter reckoning."),
                copy("В GENESIS покровителем этого летоисчисления выступает Кронос — образ времени, меры, предела и хода циклов. Суббота понимается как сакральный день покоя, восстановления тела и возвращения к внутренней тишине.",
                    "In GENESIS, Cronus presides over this chronology as an image of time, measure, limits, and the course of cycles. Saturday becomes a sacred day of rest, bodily restoration, and return to inner quiet."),
                copy("Касание дня открывает задачи, сакральный смысл, фазу Луны, точное время восхода и заката для региона устройства.",
                    "Tap a day to open tasks, sacred meaning, Moon phase, and precise sunrise and sunset times for the device region."),
            )
            metrics = listOf(YearMetric("12", copy("месяцев", "months")),
                YearMetric((if (gregorianYearStartsInMarch) ChronoUnit.DAYS.between(shown, shown.plusYears(1)).toInt()
                    else shown.lengthOfYear()).toString(), copy("дней в круге", "days in the cycle")),
                YearMetric("3", copy("системы дат в каждом дне", "date systems per day")),
                YearMetric("4", copy("солнечные точки", "solar points")))
        }
        CalendarMode.LUNAR -> {
            eyebrow = copy("ЛУННЫЙ КАЛЕНДАРЬ", "LUNAR CALENDAR")
            title = copy("Лунный год", "Lunar year")
            val start = lunarYear.startDate.format(DateTimeFormatter.ofPattern(
                if (LocalGenesisLanguage.current == "ru") "EEEE, d MMMM yyyy г." else "EEEE, d MMMM yyyy",
                Locale.forLanguageTag(LocalGenesisLanguage.current))).replaceFirstChar { it.titlecase() }
            paragraphs = listOf(
                (if (language == "ru") "Год начинается {date} — в день первого точного новолуния после весеннего равноденствия — и включает {months} лунных месяцев по 29 или 30 суток."
                    else if (language == "en") "The year begins on {date}, the first exact new moon after the spring equinox, and includes {months} lunar months of 29 or 30 days."
                    else translateGenesisText(context, "__lunarStartTemplate", language))
                    .replace("{date}", start).replace("{months}", lunarYear.monthCount.toString()),
                copy("В системе GENESIS это магический «женский» год: его внутренняя ткань определяется не месяцами и неделями солнечного года, а ростом, полнотой и исходом Луны. Весеннее равноденствие служит только ежегодной точкой настройки.",
                    "In GENESIS this is a magical feminine year, shaped by the Moon's growth, fullness, and waning rather than the months and weeks of the solar year. The spring equinox is only its annual tuning point."),
                copy("Это современная символическая система GENESIS, а не реконструкция единого древнегреческого календаря. Её античная опора — образ Селены и полнота Луны в середине месяца; греческие лунно-солнечные календари удерживали месяцы рядом с сезонами вставочным месяцем.",
                    "This is a modern GENESIS symbolic system, not a reconstruction of a single ancient Greek calendar. It draws on Selene and the Moon's fullness at mid-month; Greek lunisolar calendars kept months near the seasons with an intercalary month."),
            )
            metrics = listOf(YearMetric(lunarYear.monthCount.toString(), copy("месяцев", "months")),
                YearMetric(lunarDays, copy("дней в круге", "days in the cycle")),
                YearMetric("3", copy("системы дат в каждом дне", "date systems per day")),
                YearMetric("4", copy("солнечные точки", "solar points")))
        }
    }

    Surface(Modifier.fillMaxWidth().testTag("calendar-year-description-${mode.wireValue}"),
        shape = RoundedCornerShape(24.dp), color = yearCardBackground,
        border = BorderStroke(1.dp, Color(0x665f8a7d))) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                MaterialText(eyebrow, style = MaterialTheme.typography.labelMedium, color = yearCardGold)
                MaterialText(title, style = MaterialTheme.typography.headlineSmall, color = yearCardText)
                paragraphs.take(if (mode == CalendarMode.SACRED) 2 else paragraphs.size).forEach {
                    MaterialText(it, style = MaterialTheme.typography.bodyMedium, color = yearCardMuted)
                }
                metrics.chunked(2).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { metric -> YearMetricTile(metric, Modifier.weight(1f)) }
                    }
                }
                if (mode == CalendarMode.SACRED) {
                    MaterialText(paragraphs.last(), style = MaterialTheme.typography.bodyMedium, color = yearCardMuted)
                    SacredYearDetailsButton(copy("Подробнее", "Learn more"),
                        copy("Сакральная геометрия времени", "Sacred geometry of time")) { detailsOpen = true }
                    SacredYearDetailsButton(copy("Круг GENESIS", "GENESIS circle"),
                        copy("Интерактивная модель календаря", "Interactive calendar model"),
                        tag = "solar-model-open", icon = GenesisPageIcon.MONTH) { modelOpen = true }
                }
            }
        }
    }
    if (detailsOpen) SacredYearDetailsDialog { detailsOpen = false }
    if (modelOpen) SolarCalendarModel(calendar, shown, onOpenDate) { modelOpen = false }
}

@Composable
private fun SacredYearDetailsButton(title: String, subtitle: String,
    tag: String = "sacred-year-details-open", icon: GenesisPageIcon? = null, onClick: () -> Unit) {
    val evening = LocalEveningTheme.current
    val motion = rememberInfiniteTransition(label = "sacred-details-glow")
    val pulse by motion.animateFloat(initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1_600), RepeatMode.Reverse), label = "pulse")
    val shape = RoundedCornerShape(18.dp)
    val base = if (evening) Color(0xff123b39) else Color(0xffeddbb1)
    val accent = if (evening) Color(0xff377067) else Color(0xffd7b46b)
    val ink = if (evening) Color(0xfffff1cf) else Color(0xff18332f)
    Surface(onClick = onClick, modifier = Modifier.fillMaxWidth().heightIn(min = 60.dp)
        .testTag(tag), shape = shape, color = base,
        shadowElevation = (5 + pulse * 4).dp,
        border = BorderStroke(1.5.dp, yearCardGold.copy(alpha = .58f + pulse * .28f))) {
        Row(Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(base,
            lerp(base, accent, .28f + pulse * .18f), base)))
            .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Surface(Modifier.size(34.dp).graphicsLayer {
                scaleX = .96f + pulse * .08f
                scaleY = .96f + pulse * .08f
                rotationZ = pulse * 8f
            }, shape = RoundedCornerShape(50), color = if (evening) Color(0xff08282a) else Color(0xff20433d)) {
                Box(contentAlignment = Alignment.Center) {
                    if (icon == null) MaterialText("✦", color = Color(0xffffe7ae), style = MaterialTheme.typography.titleMedium)
                    else GenesisVectorIcon(icon, Modifier.size(22.dp), Color(0xffffe7ae))
                }
            }
            Column(Modifier.padding(start = 11.dp).weight(1f)) {
                MaterialText(title.uppercase(), color = ink, style = MaterialTheme.typography.labelLarge)
                MaterialText(subtitle, color = ink.copy(alpha = .82f),
                    style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun YearMetricTile(metric: YearMetric, modifier: Modifier) {
    Surface(modifier.heightIn(min = 88.dp), shape = RoundedCornerShape(14.dp), color = yearCardSurface,
        border = BorderStroke(1.dp, Color(0x445f8a7d))) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            MaterialText(metric.value, style = MaterialTheme.typography.headlineSmall, color = yearCardGold)
            MaterialText(metric.label.uppercase(), style = MaterialTheme.typography.labelSmall, color = yearCardMuted)
        }
    }
}

@Composable
private fun SacredYearDetailsDialog(onDismiss: () -> Unit) {
    val language = LocalGenesisLanguage.current
    val context = LocalContext.current
    fun copy(russian: String, englishText: String) = when (language) {
        "ru" -> russian
        "en" -> englishText
        else -> translateGenesisText(context, russian, language)
    }
    Dialog(onDismissRequest = onDismiss) {
        Surface(Modifier.fillMaxWidth().fillMaxHeight(0.92f).testTag("sacred-year-details-dialog"),
            shape = AffairsLayout.shape, color = MaterialTheme.colorScheme.surface) {
            LazyColumn(contentPadding = PaddingValues(AffairsLayout.gutter), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    EditorDialogHeader(copy("САКРАЛЬНАЯ ГЕОМЕТРИЯ ВРЕМЕНИ", "SACRED GEOMETRY OF TIME"),
                        "sacred-year-details-close", onDismiss)
                    MaterialText(copy("Почему наш год устроен именно так?", "Why is our year structured this way?"),
                        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                item { YearDetailsSection("✦", copy("Основа", "Foundation"), listOf(
                    copy("Почему наш год начинается в день весеннего равноденствия? Почему в месяце ровно 30 дней, разбитых на 6 «пят», а самих месяцев 12, плюс «скрытый» 13-й месяц?", "Why does the year begin on the spring equinox? Why does each month contain 30 days arranged into six pentads, with twelve months plus a hidden thirteenth?"),
                    copy("Это классическая сакральная геометрия времени, где каждый день — шаг в эволюции духа. Рассмотрим её через оптику Пифагора, Гесиода и Гомера.", "This is sacred geometry of time, where every day is a step in the evolution of spirit. We can read it through Pythagoras, Hesiod, and Homer."))) }
                item { YearDetailsSection("🌱", copy("Почему год начинается в весеннее равноденствие?", "Why does the year begin at the spring equinox?"), listOf(
                    copy("20 марта — точка преодоления инерции зимы, первый день месяца Арейос. 12 месяцев — полный солярный круг, а 5–6 оставшихся дней — Апейрон, время чистого Хаоса вне времени, когда старый мир рухнул, а новый ещё не рождён.", "March 20 overcomes winter's inertia and opens Areios. Twelve months complete the solar circle; the remaining five or six days are Apeiron, pure Chaos outside time between the old world and the unborn new one."))) }
                item { YearDetailsSection("🖐", copy("Пентада: 5 стихий и геометрия восхождения", "Pentad: five elements and the geometry of ascent"), listOf(
                    copy("Каждая Пята — микрокосм восхождения души: Земля — Вода — Воздух — Огонь — Эфир.", "Each Pentad is a microcosm of the soul's ascent: Earth, Water, Air, Fire, and Aether."),
                    copy("Пифагор: мир идёт от стабильного к тонкому. Гесиод: творение идёт от тяжести к сиянию. Гомер: движение всегда идёт снизу вверх. Успех дела требует пройти путь от «заземления» идеи до её «одухотворения» в эфире.", "Pythagoras moves from stability to subtlety; Hesiod from heaviness to radiance; Homer from below to above. Every undertaking moves from grounding an idea to spiritualizing it in Aether."))) }
                item { YearDetailsSection("🎲", copy("Гексада: 6 Пят и Куб Событий", "Hexad: six Pentads and the Cube of Events"), listOf(
                    copy("Если Пята — инструмент стихий, то Гексада — рамка времени. 6 пят образуют 30 дней месяца.", "If the Pentad is the elemental instrument, the Hexad is its frame in time. Six Pentads form a 30-day month."),
                    copy("Для пифагорейцев 6 — первое совершенное число, число сотворения мира и шести граней куба. Шесть Пят — шесть сторон «событийного куба» месяца. У Гесиода это шесть поколений, у Гомера — шесть граней эпического пути героя.", "For the Pythagoreans, six is the first perfect number and the number of the cube's faces. Six Pentads are the six sides of the month's event cube; Hesiod sees six generations, and Homer six faces of the heroic path."))) }
            }
        }
    }
}

@Composable
private fun YearDetailsSection(symbol: String, title: String, paragraphs: List<String>) {
    Surface(Modifier.fillMaxWidth(), shape = AffairsLayout.shape, color = MaterialTheme.colorScheme.surfaceContainerLow,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(AffairsLayout.gutter), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            MaterialText(symbol, style = MaterialTheme.typography.headlineSmall)
            MaterialText(title, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
            paragraphs.forEach { MaterialText(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
}
