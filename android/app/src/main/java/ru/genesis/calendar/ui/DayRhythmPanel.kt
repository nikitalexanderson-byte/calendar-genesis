package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.delay

/** Authored watches and four elemental periods from app/day-rhythm.ts. */
internal data class RhythmWatch(val start: Int, val deity: String, val title: String, val description: String, val symbol: String)
internal data class RhythmPeriod(val name: String, val element: String, val start: Int, val symbol: String,
    val alchemy: String, val source: String, val description: String, val watches: List<RhythmWatch>)

internal val rhythmPeriods = listOf(
    RhythmPeriod("Утро", "Воздуха", 6, "🌬", "🜁", "Время «Пневмы» Гомера",
        "Пробуждение мысли и настройка связей.", listOf(
            RhythmWatch(6, "Арес", "Первый бросок", "Энергия волевого импульса. Время встать и заявить права на свой день.", "♂"),
            RhythmWatch(8, "Афродита", "Красота воплощения", "Забота о теле, эстетика быта и первый вкус жизни.", "♀"),
            RhythmWatch(10, "Гермес", "Летящее слово", "Час вестника: коммуникации, почта, обмен информацией.", "☿"))),
    RhythmPeriod("День", "Огня", 12, "🔥", "🜂", "Время «Логоса» Гераклита",
        "Максимальная трансформация материи в результат.", listOf(
            RhythmWatch(12, "Артемида", "Зенит защиты", "Удержание фокуса и границ эффективности в пик дневного зноя.", "☾"),
            RhythmWatch(14, "Аполлон", "Лик ясности", "Время солнца и чистого разума. Час для принятия ключевых решений.", "☀"),
            RhythmWatch(16, "Деметра", "Жатва момента", "Упорядочивание и шлифовка того, что было сделано за день.", "⚘"))),
    RhythmPeriod("Вечер", "Воды", 18, "💧", "🜄", "Время «Катарсиса» Аристотеля",
        "Очищение чувств и спуск во внутренний мир.", listOf(
            RhythmWatch(18, "Гефест", "Закалка баланса", "Вечерняя кузня: переплавка дневного опыта в мудрость покоя.", "⚒"),
            RhythmWatch(20, "Афина", "Зоркость совы", "Глубокий анализ смыслов, скрытых за дневной суетой.", "⚴"),
            RhythmWatch(22, "Зевс", "Закон и Итог", "Час высшего суда над собой и утверждение планов на завтра.", "♃"))),
    RhythmPeriod("Ночь", "Земли", 0, "⛰", "🜃", "Время «Корней» Гесиода",
        "Глубина подсознания и восстановление основ.", listOf(
            RhythmWatch(0, "Гестия", "Центр Очага", "Точка абсолютной стабильности и охраны внутреннего огня души.", "🕯"),
            RhythmWatch(2, "Гера", "Небесный Порядок", "Время глубокой структуры сна и восстановления иерархии психики.", "♛"),
            RhythmWatch(4, "Посейдон", "Океан Предбытия", "Растворение старых форм перед новым рождением на рассвете.", "Ψ")))
)

@Composable
fun DayRhythmPanel(use24Hour: Boolean) {
    val zone = remember { ZoneId.systemDefault() }
    var now by remember { mutableStateOf(LocalTime.now(zone)) }
    LaunchedEffect(zone) { while (true) { now = LocalTime.now(zone); delay(1_000) } }
    val period = rhythmPeriods.firstOrNull {
        if (it.start == 0) now.hour < 6 else now.hour in it.start until (it.start + 6)
    } ?: rhythmPeriods.last()
    val watch = period.watches.first { now.hour in it.start until (it.start + 2) }
    var expanded by remember { mutableStateOf(false) }
    var inspected by remember { mutableStateOf<String?>(null) }
    val selected = rhythmPeriods.firstOrNull { it.name == inspected } ?: period
    val parchment = Color(0xfff6efdf)
    val gold = Color(0xffdfc17e)
    val clockPattern = if (use24Hour) "HH:mm:ss" else "h:mm:ss a"
    fun hourLabel(hour: Int): String = LocalTime.of(hour % 24, 0)
        .format(DateTimeFormatter.ofPattern(if (use24Hour) "HH:mm" else "h:mm a"))

    Card(Modifier.fillMaxWidth().testTag("today-day-rhythm"),
        colors = CardDefaults.cardColors(containerColor = Color(0xff071d20))) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("РИТМ СУТОК · ВРЕМЯ УСТРОЙСТВА", color = gold,
                style = MaterialTheme.typography.labelMedium)
            Text("Сейчас — ${period.name} · Стихия ${period.element}", color = parchment,
                style = MaterialTheme.typography.titleLarge)
            Text("${hourLabel(watch.start)}–${hourLabel(watch.start + 2)} · ${watch.deity} · «${watch.title}»",
                color = parchment, style = MaterialTheme.typography.bodyMedium)
            Text("${now.format(DateTimeFormatter.ofPattern(clockPattern))} · ${zone.id}",
                color = gold, style = MaterialTheme.typography.titleMedium)
            TextButton(onClick = { expanded = !expanded }, modifier = Modifier.testTag("day-rhythm-expand")) {
                Text(if (expanded) "Свернуть ритм суток" else "Развернуть ритм суток", color = gold)
            }
            if (expanded) {
                HorizontalDivider(color = gold.copy(alpha = .35f))
                Text("${watch.symbol} ${watch.deity} · «${watch.title}»", color = parchment,
                    style = MaterialTheme.typography.titleMedium)
                Text(watch.description, color = parchment, style = MaterialTheme.typography.bodyMedium)
                val elapsedSeconds = (now.hour - watch.start) * 3_600 + now.minute * 60 + now.second
                val remainingSeconds = 7_200 - elapsedSeconds
                LinearProgressIndicator(progress = { (elapsedSeconds / 7_200f).coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth(), color = gold)
                Text("До смены часа · ${remainingSeconds / 60}:${(remainingSeconds % 60).toString().padStart(2, '0')}",
                    color = gold, style = MaterialTheme.typography.labelMedium)
                Text("Двенадцать двухчасовых периодов", color = parchment,
                    style = MaterialTheme.typography.titleSmall)
                Row(Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    rhythmPeriods.flatMap { it.watches }.forEach { item ->
                        FilterChip(selected = item == watch, onClick = { inspected = rhythmPeriods
                            .first { item in it.watches }.name },
                            label = { Text("${hourLabel(item.start)} ${item.symbol}") })
                    }
                }
                Text("Периоды суток", color = parchment, style = MaterialTheme.typography.titleSmall)
                Row(Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    rhythmPeriods.forEach { item ->
                        FilterChip(selected = selected == item, onClick = { inspected = item.name },
                            label = { Text("${item.symbol} ${item.name}") })
                    }
                }
                Surface(color = Color(0xff103632), shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, gold.copy(alpha = .4f))) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text("${selected.alchemy} ${selected.name.uppercase()} · СТИХИЯ ${selected.element.uppercase()}",
                            color = gold, style = MaterialTheme.typography.labelLarge)
                        Text(selected.source, color = parchment, style = MaterialTheme.typography.titleSmall)
                        Text(selected.description, color = parchment, style = MaterialTheme.typography.bodySmall)
                        selected.watches.forEach { item ->
                            Text("${hourLabel(item.start)}–${hourLabel(item.start + 2)} · ${item.deity} · «${item.title}»",
                                color = gold, style = MaterialTheme.typography.labelMedium)
                            Text(item.description, color = parchment, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}
