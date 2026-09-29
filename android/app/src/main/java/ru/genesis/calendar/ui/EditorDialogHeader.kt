package ru.genesis.calendar.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

@Composable
internal fun EditorDialogHeader(title: String, closeTag: String, onClose: () -> Unit) {
    val closeLabel = genesisTranslate("Закрыть")
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
        IconButton(onClick = onClose, modifier = Modifier.size(48.dp).testTag(closeTag)
            .semantics { contentDescription = closeLabel }) {
            val ink = LocalContentColor.current
            Canvas(Modifier.size(22.dp)) {
                val inset = size.width * .23f
                drawLine(ink, Offset(inset, inset), Offset(size.width - inset, size.height - inset),
                    strokeWidth = 2.dp.toPx(), cap = StrokeCap.Round)
                drawLine(ink, Offset(size.width - inset, inset), Offset(inset, size.height - inset),
                    strokeWidth = 2.dp.toPx(), cap = StrokeCap.Round)
            }
        }
    }
}
