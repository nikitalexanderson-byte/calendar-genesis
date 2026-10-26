package ru.genesis.calendar.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** Search stays above the keyboard and outside the scrolling list. Closing preserves the query. */
@Composable
internal fun WorkspaceSearchDock(query: String, onQuery: (String) -> Unit, label: String,
    tag: String, modifier: Modifier = Modifier, controls: (@Composable () -> Unit)? = null) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    val searchLabel = genesisTranslate(label)
    fun close() { focus.clearFocus(); keyboard?.hide(); expanded = false }
    BackHandler(expanded) { close() }
    Box(modifier.fillMaxWidth().padding(12.dp), contentAlignment = Alignment.BottomEnd) {
        if (!expanded) {
            FilledTonalIconButton(onClick = { expanded = true },
                modifier = Modifier.size(56.dp).testTag("$tag-open").semantics { contentDescription = searchLabel }, shape = AffairsLayout.controlShape,
                colors = IconButtonDefaults.filledTonalIconButtonColors(
                    containerColor = if (query.isNotBlank()) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.primaryContainer,
                    contentColor = if (query.isNotBlank()) MaterialTheme.colorScheme.onPrimary
                        else MaterialTheme.colorScheme.onPrimaryContainer)) {
                GenesisLucideIcon("search", Modifier.size(24.dp))
            }
        } else Surface(Modifier.fillMaxWidth().animateContentSize().testTag("$tag-dock"),
            shape = AffairsLayout.shape, color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
            Column(Modifier.padding(8.dp).heightIn(max = 320.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    AffairsSearchField(query, { onQuery(it.take(200)) }, label,
                        Modifier.weight(1f).testTag(tag), labelAsPlaceholder = true)
                    AffairsIconButton("Свернуть поиск", AffairsAction.CLOSE, ::close,
                        Modifier.fillMaxHeight().testTag("$tag-close"))
                }
                controls?.let { Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)) { it() } }
            }
        }
    }
}
