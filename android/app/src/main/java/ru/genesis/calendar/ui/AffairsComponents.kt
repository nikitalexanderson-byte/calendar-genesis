package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/** Native extension of STANDART: Material roles come from the existing green/paper/gold themes. */
internal object AffairsLayout {
    val gutter = 16.dp
    val gap = 8.dp
    val sectionGap = 16.dp
    val touchTarget = 48.dp
    val formMaxWidth = 720.dp
    val shape = RoundedCornerShape(16.dp)
}

internal enum class AffairsAction { BACK, MORE, CLOSE, SEARCH, FILTER, SORT, EXPAND, COLLAPSE, REFRESH, MOVE, ADD, EDIT, SETTINGS, DELETE, REPORT, IMPORT, HISTORY, VIEW, UNDO, TEMPLATE, SUBTASK, DECREASE, TASK, AUTOMATION }

@Composable internal fun GenesisAccountFooter(status: String) {
    Text(status, Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)
        .testTag("app-account-status"), style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
}

/** The same 24-unit, rounded line geometry as GenesisVectorIcon. */
@Composable internal fun AffairsActionIcon(action: AffairsAction, modifier: Modifier = Modifier) {
    val ink = LocalContentColor.current
    Canvas(modifier.size(24.dp).clearAndSetSemantics { }) {
        val unit = size.width / 24
        val path = Path()
        fun move(x: Float, y: Float) = path.moveTo(x * unit, y * unit)
        fun line(x: Float, y: Float) = path.lineTo(x * unit, y * unit)
        fun curve(x1: Float, y1: Float, x2: Float, y2: Float, x: Float, y: Float) =
            path.cubicTo(x1 * unit, y1 * unit, x2 * unit, y2 * unit, x * unit, y * unit)
        when (action) {
            AffairsAction.SORT -> {
                move(3f, 6f); line(13f, 6f); move(3f, 12f); line(10f, 12f); move(3f, 18f); line(7f, 18f)
                move(18f, 4f); line(18f, 20f); move(14f, 16f); line(18f, 20f); line(22f, 16f)
            }
            AffairsAction.BACK -> { move(14f, 5f); line(7f, 12f); line(14f, 19f) }
            AffairsAction.CLOSE -> { move(6f, 6f); line(18f, 18f); move(18f, 6f); line(6f, 18f) }
            AffairsAction.DELETE -> {
                move(4f, 7f); line(20f, 7f); move(9f, 7f); line(9f, 3f); line(15f, 3f); line(15f, 7f)
                move(6f, 7f); line(7f, 21f); line(17f, 21f); line(18f, 7f)
                move(10f, 11f); line(10f, 17f); move(14f, 11f); line(14f, 17f)
            }
            AffairsAction.ADD -> { move(12f, 5f); line(12f, 19f); move(5f, 12f); line(19f, 12f) }
            AffairsAction.DECREASE -> { move(5f, 12f); line(19f, 12f) }
            AffairsAction.TASK -> {
                move(3f, 5f); line(10f, 5f); line(10f, 12f); line(3f, 12f); line(3f, 5f)
                move(5f, 8f); line(6f, 10f); line(9f, 6f); move(14f, 7f); line(21f, 7f)
                move(14f, 11f); line(19f, 11f); move(3f, 17f); line(21f, 17f); move(3f, 21f); line(16f, 21f)
            }
            AffairsAction.TEMPLATE -> {
                move(8f, 3f); line(21f, 3f); line(21f, 17f); move(17f, 7f); line(3f, 7f); line(3f, 21f); line(17f, 21f); line(17f, 7f)
                move(6f, 11f); line(13f, 11f); move(6f, 15f); line(11f, 15f)
            }
            AffairsAction.SUBTASK -> {
                move(4f, 3f); line(4f, 15f); line(9f, 15f); move(7f, 12f); line(10f, 15f); line(7f, 18f)
                move(12f, 11f); line(21f, 11f); line(21f, 21f); line(12f, 21f); line(12f, 11f)
                move(14f, 5f); line(20f, 5f); move(17f, 2f); line(17f, 8f)
            }
            AffairsAction.IMPORT -> {
                move(6f, 6f); line(6f, 3f); line(15f, 3f); line(20f, 8f); line(20f, 21f); line(6f, 21f); line(6f, 18f)
                move(15f, 3f); line(15f, 8f); line(20f, 8f)
                move(2f, 12f); line(13f, 12f); move(9f, 8f); line(13f, 12f); line(9f, 16f)
            }
            AffairsAction.HISTORY -> {
                move(3f, 8f); curve(5f, 2f, 15f, 1f, 20f, 7f); curve(25f, 15f, 16f, 25f, 8f, 20f)
                move(3f, 3f); line(3f, 8f); line(8f, 8f); move(12f, 7f); line(12f, 12f); line(16f, 15f)
            }
            AffairsAction.VIEW -> {
                move(2f, 12f); curve(7f, 3f, 17f, 3f, 22f, 12f); curve(17f, 21f, 7f, 21f, 2f, 12f)
                drawCircle(ink, 3f * unit, Offset(12f * unit, 12f * unit), style = Stroke(1.8f * unit))
            }
            AffairsAction.UNDO -> {
                move(8f, 5f); line(3f, 10f); line(8f, 15f); move(3f, 10f)
                curve(16f, 5f, 23f, 12f, 20f, 20f)
            }
            AffairsAction.REPORT -> {
                move(4f, 3f); line(4f, 21f); line(21f, 21f)
                move(8f, 16f); line(8f, 11f); move(13f, 16f); line(13f, 6f); move(18f, 16f); line(18f, 9f)
            }
            AffairsAction.EDIT -> {
                move(3f, 21f); line(4f, 17f); line(17f, 4f); line(20f, 7f); line(7f, 20f); line(3f, 21f)
                move(15f, 6f); line(18f, 9f)
            }
            AffairsAction.AUTOMATION -> {
                move(13f, 2f); line(4f, 14f); line(11f, 14f); line(10f, 22f)
                line(20f, 9f); line(13f, 9f); line(13f, 2f)
            }
            AffairsAction.SETTINGS -> {
                for ((y, x) in listOf(6f to 13f, 12f to 8f, 18f to 16f)) {
                    move(3f, y); line(x - 3f, y); move(x + 3f, y); line(21f, y)
                    drawCircle(ink, 2.5f * unit, Offset(x * unit, y * unit), style = Stroke(1.8f * unit))
                }
            }
            AffairsAction.SEARCH -> {
                drawCircle(ink, 6 * unit, Offset(10 * unit, 10 * unit), style = Stroke(1.8f * unit))
                move(15f, 15f); line(21f, 21f)
            }
            AffairsAction.FILTER -> {
                move(4f, 7f); line(20f, 7f); move(7f, 12f); line(17f, 12f); move(10f, 17f); line(14f, 17f)
            }
            AffairsAction.EXPAND -> { move(6f, 9f); line(12f, 15f); line(18f, 9f) }
            AffairsAction.COLLAPSE -> { move(6f, 15f); line(12f, 9f); line(18f, 15f) }
            AffairsAction.REFRESH -> {
                move(20f, 8f); curve(18f, 2f, 10f, 1f, 6f, 5f); line(3f, 8f)
                move(3f, 3f); line(3f, 8f); line(8f, 8f)
                move(4f, 16f); curve(6f, 22f, 14f, 23f, 18f, 19f); line(21f, 16f)
                move(21f, 21f); line(21f, 16f); line(16f, 16f)
            }
            AffairsAction.MOVE -> {
                move(12f, 3f); line(12f, 21f); move(3f, 12f); line(21f, 12f)
                move(9f, 6f); line(12f, 3f); line(15f, 6f)
                move(9f, 18f); line(12f, 21f); line(15f, 18f)
                move(6f, 9f); line(3f, 12f); line(6f, 15f)
                move(18f, 9f); line(21f, 12f); line(18f, 15f)
            }
            AffairsAction.MORE -> for (y in listOf(5f, 12f, 19f)) {
                drawCircle(ink, 1.6f * unit, Offset(12 * unit, y * unit))
            }
        }
        drawPath(path, ink, style = Stroke(1.8f * unit, cap = StrokeCap.Round))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable internal fun AffairsIconButton(label: String, action: AffairsAction, onClick: () -> Unit,
    modifier: Modifier = Modifier, enabled: Boolean = true) {
    val description = genesisTranslate(label)
    TooltipBox(positionProvider = TooltipDefaults.rememberPlainTooltipPositionProvider(),
        tooltip = { PlainTooltip { Text(label) } }, state = rememberTooltipState()) {
        IconButton(onClick = onClick, enabled = enabled, modifier = modifier.size(AffairsLayout.touchTarget)
            .semantics { contentDescription = description }) { AffairsActionIcon(action) }
    }
}

@Composable internal fun AffairsPageHeader(title: String, context: String,
    icon: GenesisPageIcon = GenesisPageIcon.PROJECTS, onBack: (() -> Unit)? = null,
    backLabel: String = "Назад", backEnabled: Boolean = true, titleIsUserContent: Boolean = false,
    contextIsUserContent: Boolean = false, contextMaxLines: Int = Int.MAX_VALUE, actions: @Composable RowScope.() -> Unit = {}) {
    Surface(shape = AffairsLayout.shape, color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth().testTag("affairs-page-header")) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (onBack != null) AffairsIconButton(backLabel, AffairsAction.BACK, onBack,
                Modifier.testTag("affairs-back"), enabled = backEnabled)
            else Box(Modifier.size(48.dp), contentAlignment = Alignment.Center) {
                GenesisVectorIcon(icon, Modifier.size(30.dp), MaterialTheme.colorScheme.primary)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                androidx.compose.material3.Text(if (titleIsUserContent) title else genesisTranslate(title),
                    style = MaterialTheme.typography.titleLarge)
                if (context.isNotBlank()) androidx.compose.material3.Text(
                    if (contextIsUserContent) context else genesisTranslate(context), style = MaterialTheme.typography.bodySmall, maxLines = contextMaxLines, overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            actions()
        }
    }
}

@Composable internal fun AffairsDisclosure(title: String, modifier: Modifier = Modifier,
    titleIsUserContent: Boolean = false,
    initiallyExpanded: Boolean = false,
    content: @Composable ColumnScope.() -> Unit) {
    var expanded by rememberSaveable { mutableStateOf(initiallyExpanded) }
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { expanded = !expanded }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
            if (titleIsUserContent) androidx.compose.material3.Text(title, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
            else Text(title, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
            AffairsActionIcon(if (expanded) AffairsAction.COLLAPSE else AffairsAction.EXPAND)
        }
        if (expanded) content()
    }
}

@Composable internal fun AffairsSaveBar(onSave: () -> Unit, enabled: Boolean, busy: Boolean) {
    Surface(color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
        Column {
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Button(onClick = onSave, enabled = enabled && !busy, modifier = Modifier.fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp).heightIn(min = 48.dp).testTag("affairs-save")) {
                if (busy) CircularProgressIndicator(Modifier.size(18.dp).padding(end = 4.dp), strokeWidth = 2.dp)
                Text(if (busy) "Сохранение…" else "Сохранить")
            }
        }
    }
}

@Composable internal fun AffairsSearchField(value: String, onChange: (String) -> Unit,
    label: String, modifier: Modifier = Modifier) {
    OutlinedTextField(value, onChange, label = { Text(label) }, singleLine = true,
        leadingIcon = { AffairsActionIcon(AffairsAction.SEARCH) },
        trailingIcon = if (value.isNotEmpty()) ({
            AffairsIconButton("Очистить поиск", AffairsAction.CLOSE, { onChange("") })
        }) else null,
        shape = AffairsLayout.shape, modifier = modifier.fillMaxWidth())
}

@Composable internal fun AffairsFilterDialog(onDismiss: () -> Unit, onApply: () -> Unit,
    onReset: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Фильтры") },
        text = { Column(Modifier.fillMaxWidth().heightIn(max = 440.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp), content = content) },
        confirmButton = { Button(onClick = onApply, modifier = Modifier.heightIn(min = 48.dp)
            .testTag("affairs-apply-filters")) { Text("Применить фильтры") } },
        dismissButton = { TextButton(onClick = onReset, modifier = Modifier.heightIn(min = 48.dp)) { Text("Сбросить") } })
}

/** One task anatomy shared by personal and team affairs; callers keep their own data/permission rules. */
@Composable internal fun AffairsTaskRow(title: String, completed: Boolean, onOpen: () -> Unit,
    modifier: Modifier = Modifier, metadata: List<String> = emptyList(), unreadComments: Int = 0,
    onComplete: (() -> Unit)? = null, enabled: Boolean = true,
    actions: @Composable (() -> Unit)? = null, extra: @Composable (() -> Unit)? = null,
    titleContent: @Composable (() -> Unit)? = null) {
    OutlinedCard(onClick = onOpen, enabled = enabled, modifier = modifier.fillMaxWidth(), shape = AffairsLayout.shape,
        colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, if (unreadComments > 0) MaterialTheme.colorScheme.secondary
            else MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.fillMaxWidth().padding(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                if (onComplete != null) {
                    val label = genesisTranslate(if (completed) "Вернуть в работу" else "Завершить задачу")
                    Checkbox(completed, { onComplete() }, enabled = enabled,
                        modifier = Modifier.size(48.dp).semantics { contentDescription = "$label: $title" })
                }
                Column(Modifier.weight(1f).padding(start = if (onComplete == null) 8.dp else 0.dp,
                    top = 9.dp, bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (titleContent != null) titleContent() else androidx.compose.material3.Text(title, style = MaterialTheme.typography.titleSmall,
                        fontWeight = if (unreadComments > 0) FontWeight.Bold else FontWeight.Medium,
                        color = if (completed) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
                }
                actions?.invoke()
            }
            if (metadata.isNotEmpty()) androidx.compose.material3.Text(metadata.filter(String::isNotBlank).joinToString(" · "),
                modifier = Modifier.padding(horizontal = 8.dp), style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (unreadComments > 0 && titleContent == null) Box(Modifier.padding(horizontal = 8.dp)) { UnreadCommentBadge(unreadComments) }
            extra?.invoke()
        }
    }
}
