package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.format.TextStyle
import java.time.format.DateTimeFormatter
import java.util.Locale
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.SacredCatalog

private val elementNames = listOf("🜃 Земля", "🜄 Вода", "🜁 Воздух", "🜂 Огонь", "✦ Эфир")
private val elementMeanings = listOf("Опора · Тело", "Эмоции · Поток", "Интеллект · Связь",
    "Воля · Действие", "Дух · Синтез")
private val numberNames = listOf("Монада", "Диада", "Триада", "Тетрада", "Пентада")
private val numberMeanings = listOf("Удержание · Стабильность", "Разделение · Текучесть · Выбор пути",
    "Одухотворение · Связь верха и низа", "Справедливость · Полнота", "Всецелостность · Синтез")
internal val pyataDescriptions = listOf(
    "Явление идеи. Выделение первичного импульса из пустоты. Бог месяца заявляет о себе, мы ставим цель.",
    "Установление границ и «снаряжение корабля». Стихии начинают конфликтовать, выстраивается иерархия. Время подготовки ресурсов.",
    "Срединная битва. Пик сопротивления материала. Преодоление хаоса и наведение порядка в делах.",
    "Проявление доблести. Энергия месяца достигает своего зенита. Лучшая версия реализации наших планов.",
    "Путь домой. Божественная энергия спускается на уровень человеческого действия. Сбор плодов и оценка результатов.",
    "Переход в вечность и память. Угасание формы, но кристаллизация опыта. Очищение места и подготовка к передаче эстафеты следующему месяцу."
)

/** Shared native day facts from the web calendar, independent of the display/input calendar choice. */
@Composable
fun DayKnowledgePanel(date: LocalDate, calendar: GenesisCalendar = GenesisCalendar()) {
    val locale = if (LocalGenesisLanguage.current == "en") Locale.ENGLISH else Locale.forLanguageTag("ru")
    val sacred = calendar.sacredDate(date)
    val month = SacredCatalog.months[sacred.monthIndex]
    val day = month.days[sacred.day - 1]
    val lunar = calendar.lunarDate(date)
    val moon = calendar.moonInfo(date)
    val elementIndex = if (sacred.monthIndex == 12) 4 else (sacred.day - 1) % 5
    Card(Modifier.fillMaxWidth().testTag("day-knowledge")) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Три ритма дня", style = MaterialTheme.typography.titleLarge)
            Text("Сакральный · ${sacred.day} день · ${month.name} (${month.roman})",
                style = MaterialTheme.typography.titleSmall)
            Text("${day.name}. ${day.description}", style = MaterialTheme.typography.bodyMedium)
            HorizontalDivider()
            Row(verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MoonPhaseIcon(moon.phaseStep, size = 44.dp)
                Column(Modifier.weight(1f)) {
                    Text("Луна · ${moon.day} день · ${moon.phase}", style = MaterialTheme.typography.titleSmall)
                    Text("${lunar.month.name} · ${lunar.decade}${if (lunar.isThreshold) " · Рубеж" else ""}",
                        style = MaterialTheme.typography.bodySmall)
                    Text("${moon.epithet} · ${moon.direction} · ${moon.illumination}% освещённости",
                        style = MaterialTheme.typography.bodySmall)
                }
            }
            if (moon.event.isNotBlank()) Text(moon.event, color = MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.labelLarge)
            HorizontalDivider()
            Text("Григорианский · ${date.dayOfWeek.getDisplayName(TextStyle.FULL_STANDALONE, locale)}, ${date.dayOfMonth}.${date.monthValue}.${date.year}",
                style = MaterialTheme.typography.titleSmall)
            Text("${date.dayOfYear}-й из ${date.lengthOfYear()} дней года · ${date.lengthOfMonth()} дней в месяце",
                style = MaterialTheme.typography.bodySmall)
            calendar.solarEvent(date)?.let { event ->
                Text("${event.symbol} ${event.name} · ${event.instant.atZone(calendar.zoneId).format(DateTimeFormatter.ofPattern("HH:mm z", locale))}",
                    color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleSmall)
            }
            HorizontalDivider()
            Text(if (sacred.monthIndex == 12) "Апейрон · вне обычного цикла"
                else "Пята ${day.pyata} · ${day.pyataTitle}", style = MaterialTheme.typography.titleSmall)
            if (sacred.monthIndex != 12) Text(pyataDescriptions[(day.pyata - 1).coerceIn(0, 5)],
                style = MaterialTheme.typography.bodySmall)
            Text("Стихия · ${elementNames[elementIndex]} — ${elementMeanings[elementIndex]}",
                style = MaterialTheme.typography.bodySmall)
            Text(if (sacred.monthIndex == 12) "Пифагорейский смысл · Апейрон — Безграничное · Пространство первообразов"
                else "Пифагорейский смысл · ${numberNames[elementIndex]} — ${numberMeanings[elementIndex]}",
                style = MaterialTheme.typography.bodySmall)
        }
    }
}
