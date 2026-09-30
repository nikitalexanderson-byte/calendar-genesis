package ru.genesis.calendar.ui

import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp

/** Keeps short setting choices on one line without hiding the end of a translated label. */
@Composable
internal fun CompactChoiceLabel(label: String) {
    BasicText(genesisTranslate(label), modifier = Modifier.fillMaxWidth(),
        style = MaterialTheme.typography.labelSmall.copy(color = LocalContentColor.current,
            textAlign = TextAlign.Center),
        maxLines = 1, softWrap = false,
        autoSize = TextAutoSize.StepBased(minFontSize = 8.sp, maxFontSize = 11.sp))
}
