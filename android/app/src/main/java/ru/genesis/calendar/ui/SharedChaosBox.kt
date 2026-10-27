package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

/** A display preference scoped to the account and owning workspace/project, never task data. */
@Composable internal fun rememberSharedChaosLayout(owner: String): Pair<PersonalInboxLayout, (PersonalInboxLayout) -> Unit> {
    val context=LocalContext.current;val account=LocalGenesisUserId.current
    val prefs=remember(context) {context.getSharedPreferences("genesis.shared-inbox-layout.v1",0)}
    val key="$account:$owner"
    var layout by remember(key) {mutableStateOf(PersonalInboxLayout(prefs.getBoolean("$key:hidden",false),prefs.getBoolean("$key:bottom",false)))}
    return layout to {next->layout=next;prefs.edit().putBoolean("$key:hidden",next.hidden).putBoolean("$key:bottom",next.atBottom).apply()}
}

/** Same hierarchy as the personal inbox: heading, count, ordinary task/list rows and a small menu. */
@Composable internal fun SharedChaosBox(taskCount:Int,listCount:Int,layout:PersonalInboxLayout,
    onLayout:(PersonalInboxLayout)->Unit,modifier:Modifier=Modifier,onCreateTask:(()->Unit)?=null,
    onCreateList:(()->Unit)?=null,content:@Composable ColumnScope.()->Unit) {
    if(layout.hidden) {
        OutlinedButton(onClick={onLayout(layout.copy(hidden=false))},modifier=modifier.fillMaxWidth().testTag("shared-show-inbox")) {
            AffairsActionIcon(AffairsAction.VIEW);Spacer(Modifier.width(8.dp));Text("Показать хаос-бокс")
        }
        return
    }
    var actions by remember {mutableStateOf(false)}
    Surface(modifier.fillMaxWidth().testTag("shared-project-inbox"),shape=AffairsLayout.shape,
        color=chaosBoxColor(),border=BorderStroke(1.dp,chaosBoxBorder())) {
        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    Text("Хаос-бокс",style=MaterialTheme.typography.titleMedium)
                    Text("$taskCount задач · "+genesisTranslate("Списки задач")+": $listCount",
                        style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Box {
                    AffairsIconButton("Действия с хаос-боксом",AffairsAction.MORE,{actions=true},Modifier.testTag("shared-inbox-actions"))
                    DropdownMenu(actions,{actions=false}) {
                        onCreateTask?.let {create->DropdownMenuItem(text={Text("Создать задачу")},leadingIcon={AffairsActionIcon(AffairsAction.ADD)},
                            modifier=Modifier.testTag("shared-inbox-create-task"),onClick={actions=false;create()})}
                        onCreateList?.let {create->DropdownMenuItem(text={Text("Создать список задач")},leadingIcon={AffairsActionIcon(AffairsAction.TASK_LIST)},
                            modifier=Modifier.testTag("shared-inbox-create-list"),onClick={actions=false;create()})}
                        DropdownMenuItem(text={Text(if(layout.atBottom)"Переместить вверх" else "Переместить вниз")},
                            leadingIcon={AffairsActionIcon(if(layout.atBottom)AffairsAction.MOVE_UP else AffairsAction.MOVE_DOWN)},
                            modifier=Modifier.testTag("shared-move-inbox"),onClick={actions=false;onLayout(layout.copy(atBottom=!layout.atBottom))})
                        DropdownMenuItem(text={Text("Скрыть хаос-бокс")},leadingIcon={AffairsActionIcon(AffairsAction.HIDE)},
                            modifier=Modifier.testTag("shared-hide-inbox"),onClick={actions=false;onLayout(layout.copy(hidden=true))})
                    }
                }
            }
            content()
        }
    }
}
