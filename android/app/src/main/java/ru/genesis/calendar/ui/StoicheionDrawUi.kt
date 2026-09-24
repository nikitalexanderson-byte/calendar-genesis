package ru.genesis.calendar.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import java.security.SecureRandom
import kotlin.math.hypot
import ru.genesis.calendar.data.StoicheionDraw
import ru.genesis.calendar.data.StoicheionDraws
import ru.genesis.calendar.domain.StoicheionReading

internal data class StoicheionPosition(val id: String, val direction: String, val meaning: String)

/** Site order is clockwise within the 3×3 cosmic square, with the center in slot five. */
internal val stoicheionPositions = listOf(
    StoicheionPosition("northwest", "Северо-запад", "Мир границ, переходов и рискованных действий. Скрытые угрозы или внезапные прорывы."),
    StoicheionPosition("north", "Север", "Мир ужаса или глубокого познания. Способность вкушать опыт и переваривать сложные ситуации."),
    StoicheionPosition("northeast", "Северо-восток", "Мир завершения, смерти старого и рождения нового. Интуитивное чутьё и материальные ценности."),
    StoicheionPosition("west", "Запад", "Мир опьянения, иллюзий и глубокого видения. Зависимости и способность видеть истину сквозь морок."),
    StoicheionPosition("center", "Центр", "Духовность, координация всех сфер и связь с вечностью. Точка сборки всей ситуации."),
    StoicheionPosition("east", "Восток", "Мир магии, созидания и интеллекта. Здесь, подобно восходящему Солнцу, зарождаются идеи и планы."),
    StoicheionPosition("southwest", "Юго-запад", "Мир ярости, скрытых возможностей и трансформации через страдание. Сектор преодоления препятствий."),
    StoicheionPosition("south", "Юг", "Мир войны, активной деятельности и логического ума. Дисциплина, борьба и прямое действие."),
    StoicheionPosition("southeast", "Юго-восток", "Мир дикой природы и проявления Эго. Инстинкты, первичные импульсы и необузданная сила."),
)

internal data class StoicheionSelection(val letter: StoicheionLetter, val reversed: Boolean? = null,
    val position: StoicheionPosition? = null)

private fun orientation(reversed: Boolean) = if (reversed) "Перевёрнутое положение" else "Парадное положение"
private fun countdown(seconds: Int) = "%02d:%02d".format(seconds / 60, seconds % 60)

@Composable
internal fun StoicheionDrawPanel(letters: List<StoicheionLetter>, draws: StoicheionDraws?, now: Long,
    busy: Boolean, error: String?, onBegin: (String) -> Unit, onSelect: (StoicheionSelection) -> Unit) {
    val daily = draws?.daily
    val dailyLetter = daily?.let { StoicheionReading.cardOfDay(letters, it.seed) }
    val spread = draws?.spread
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Карта дня", style = MaterialTheme.typography.titleLarge)
        Text("Один из 24 авторских образов на сегодня. Выбор сохраняется на этом устройстве.",
            style = MaterialTheme.typography.bodyMedium)
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (dailyLetter == null) {
            Button(onClick = { onBegin("daily") }, enabled = draws != null && !busy,
                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp).testTag("stoicheion-draw-daily")) {
                Text("Начать выбор карты дня")
            }
        } else {
            val reversed = StoicheionReading.reversed(daily.seed)
            Card(onClick = { onSelect(StoicheionSelection(dailyLetter, reversed)) },
                modifier = Modifier.fillMaxWidth().testTag("stoicheion-daily-result")) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StoicheionCardFace(dailyLetter, Modifier.width(126.dp)
                        .graphicsLayer { rotationZ = if (reversed) 180f else 0f })
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(dailyLetter.name, style = MaterialTheme.typography.titleMedium)
                        Text(dailyLetter.tagline, style = MaterialTheme.typography.bodySmall)
                        Text(orientation(reversed), style = MaterialTheme.typography.labelMedium)
                        Text("Открыть полный профиль", color = MaterialTheme.colorScheme.primary,
                            style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
            RerollAction(daily, now, busy, "Перебросить карту") { onBegin("daily") }
            Text("Космический круг и девять ликов силы", style = MaterialTheme.typography.titleLarge)
            Text("Девять букв соотносятся со сторонами света и центром. Расклад начинается с карты дня и вашего движения.",
                style = MaterialTheme.typography.bodyMedium)
            if (spread == null) {
                Button(onClick = { onBegin("spread") }, enabled = !busy,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp).testTag("stoicheion-draw-spread")) {
                    Text("Начать расклад")
                }
                Text("СЗ · Север · СВ\nЗапад · Центр · Восток\nЮЗ · Юг · ЮВ",
                    style = MaterialTheme.typography.bodySmall)
            } else {
                val cards = StoicheionReading.spread(letters, spread.seed)
                stoicheionPositions.chunked(3).forEachIndexed { row, positions ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        positions.forEachIndexed { column, position ->
                            val (letter, reversedCard) = cards[row * 3 + column]
                            Card(onClick = { onSelect(StoicheionSelection(letter, reversedCard, position)) },
                                modifier = Modifier.weight(1f).testTag("stoicheion-spread-${position.id}")) {
                                Column(Modifier.padding(5.dp), horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(position.direction, style = MaterialTheme.typography.labelSmall, maxLines = 2)
                                    StoicheionCardFace(letter, Modifier.fillMaxWidth()
                                        .graphicsLayer { rotationZ = if (reversedCard) 180f else 0f })
                                    Text("${letter.name} · ${letter.value}", style = MaterialTheme.typography.labelSmall,
                                        maxLines = 2)
                                    Text(orientation(reversedCard), style = MaterialTheme.typography.bodySmall,
                                        maxLines = 2)
                                }
                            }
                        }
                    }
                }
                val total = cards.sumOf { it.first.value }
                Card(Modifier.fillMaxWidth().testTag("stoicheion-isopsephy")) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("ἰσοψηφία · Пифмен расклада", style = MaterialTheme.typography.titleMedium)
                        Text("${cards.joinToString(" + ") { it.first.value.toString() }} = $total")
                        Text("${StoicheionReading.trace(total).joinToString(" → ")} · ${StoicheionReading.pythmen(total)}",
                            style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                        Text("Числовые значения девяти букв складываются до корня от 1 до 9.",
                            style = MaterialTheme.typography.bodySmall)
                    }
                }
                RerollAction(spread, now, busy, "Перебросить расклад") { onBegin("spread") }
            }
        }
        HorizontalDivider()
    }
}

@Composable
private fun RerollAction(draw: StoicheionDraw, now: Long, busy: Boolean, label: String, onClick: () -> Unit) {
    if (draw.canReroll(now)) OutlinedButton(onClick = onClick, enabled = !busy,
        modifier = Modifier.testTag("stoicheion-reroll-${draw.kind}")) {
        Text("$label · ${countdown(draw.remainingSeconds(now))}")
    } else Text(if (draw.attempts == 2) "Переброс на сегодня использован"
        else "Выбор закреплён до завтра", style = MaterialTheme.typography.bodySmall)
}

@Composable
internal fun StoicheionMotionDialog(mode: String, busy: Boolean, onCancel: () -> Unit,
    onFinish: (Long) -> Unit) {
    var travel by remember(mode) { mutableFloatStateOf(0f) }
    var seed by remember(mode) { mutableLongStateOf(SecureRandom().nextInt().toUInt().toLong()) }
    var submitted by remember(mode) { mutableStateOf(false) }
    val density = LocalDensity.current.density
    Dialog(onDismissRequest = onCancel, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxWidth().fillMaxHeight(.92f).padding(12.dp),
            shape = RoundedCornerShape(22.dp), color = Color(0xff071d20)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(if (mode == "daily") "Проведите рукой над знаками" else "Соберите девять ликов движением",
                        Modifier.weight(1f), style = MaterialTheme.typography.titleLarge,
                        color = Color(0xfffffcf6))
                    TextButton(onClick = onCancel) { Text("×", color = Color(0xffdfc17e)) }
                }
                Text("Проведите пальцем несколько раз. Движение создаёт зерно расклада.",
                    color = Color(0xfffffcf6), style = MaterialTheme.typography.bodyMedium)
                Box(Modifier.fillMaxWidth().weight(1f).clip(RoundedCornerShape(16.dp))
                    .background(Color(0xff15413d))
                    .pointerInput(mode, busy) {
                        detectDragGestures { change, drag ->
                            change.consume()
                            if (!submitted && !busy) {
                                travel = (travel + hypot(drag.x, drag.y) / density).coerceAtMost(4480f)
                                seed = StoicheionReading.mix(seed,
                                    change.position.x / size.width * 100f,
                                    change.position.y / size.height * 100f, System.nanoTime())
                                if (travel >= 4480f) { submitted = true; onFinish(seed) }
                            }
                        }
                    }
                    .semantics { contentDescription = "Поле движения для случайного выбора" }
                    .testTag("stoicheion-motion-field"), contentAlignment = Alignment.Center) {
                    Text("Α · Β · Γ · Δ · Ε\nΖ · Η · Θ · Ι · Κ\nΛ · Μ · Ν · Ξ · Ο",
                        color = Color(0xffdfc17e), style = MaterialTheme.typography.headlineLarge)
                }
                LinearProgressIndicator(progress = { travel / 4480f }, modifier = Modifier.fillMaxWidth())
                Text("${(travel / 44.8f).toInt()}% · ${if (travel < 1568f) "Пробуждение поля"
                    else if (travel < 3360f) "Знаки смешиваются" else "Образ почти проявился"}",
                    color = Color(0xfffffcf6), style = MaterialTheme.typography.bodyMedium)
                OutlinedButton(onClick = {
                    if (!submitted) { submitted = true; onFinish(SecureRandom().nextInt().toUInt().toLong()) }
                }, enabled = !busy && !submitted,
                    modifier = Modifier.fillMaxWidth().testTag("stoicheion-accessible-draw")) {
                    Text("Выбрать без жеста")
                }
                Text("Доступный способ выбора для управления без движения пальцем.",
                    color = Color(0xffdfc17e), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
