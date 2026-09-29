package ru.genesis.calendar.ui

import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextDecoration
import ru.genesis.calendar.data.LocalTask

internal val completedTaskSurface = Color(0xffecebe7)
internal val completedTaskInk = Color(0xff626967)

@Composable
internal fun TaskTitle(task: LocalTask, modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current, color: Color = Color.Unspecified,
    completedColor: Color = completedTaskInk, maxLines: Int = Int.MAX_VALUE,
    label: String = task.title) {
    androidx.compose.material3.Text(label, modifier = modifier, style = style,
        color = if (task.done) completedColor else color, maxLines = maxLines,
        textDecoration = if (task.done) TextDecoration.LineThrough else TextDecoration.None)
}
