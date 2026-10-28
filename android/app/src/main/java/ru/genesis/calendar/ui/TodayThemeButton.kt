package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.size
import androidx.compose.foundation.BorderStroke
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.R

@Composable
internal fun TodayThemeButton(evening: Boolean, enabled: Boolean, calendar: Boolean = false, onToggle: () -> Unit) {
    val gold = Color(0xffdfc17e)
    OutlinedIconButton(onClick = onToggle, enabled = enabled, shape = AffairsLayout.controlShape,
        border = BorderStroke(1.dp, gold.copy(alpha = if (enabled) .55f else .25f)),
        colors = IconButtonDefaults.outlinedIconButtonColors(containerColor = Color(0xff173b38), contentColor = gold),
        modifier = Modifier.size(48.dp).testTag(if (calendar) "calendar-theme-toggle" else "today-theme-toggle")) {
        Icon(painterResource(R.drawable.genesis_theme_contrast),
            contentDescription = genesisTranslate(if (evening) "Включить светлую тему" else "Включить тёмную тему"),
            modifier = Modifier.size(24.dp))
    }
}
