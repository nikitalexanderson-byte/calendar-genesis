package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.R

@Composable
internal fun TodayThemeButton(evening: Boolean, enabled: Boolean, onToggle: () -> Unit) {
    IconButton(onClick = onToggle, enabled = enabled, modifier = Modifier.size(48.dp).testTag("today-theme-toggle")) {
        Icon(painterResource(R.drawable.genesis_theme_contrast),
            contentDescription = genesisTranslate(if (evening) "Включить светлую тему" else "Включить тёмную тему"),
            modifier = Modifier.size(24.dp))
    }
}
