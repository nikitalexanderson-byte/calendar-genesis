package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable internal fun MapIconButton(label:String,kind:Int,onClick:()->Unit,enabled:Boolean=true) {
    AffairsIconButton(label,when(kind) {
        0 -> AffairsAction.MINDMAP
        1 -> AffairsAction.LIST
        2 -> AffairsAction.SUBTASK
        3 -> AffairsAction.ADD
        4 -> AffairsAction.TASK
        5 -> AffairsAction.VIEW
        6 -> AffairsAction.COLLAPSE
        7 -> AffairsAction.MOVE_UP
        8 -> AffairsAction.MOVE_DOWN
        9 -> AffairsAction.DELETE
        10 -> AffairsAction.BACK
        else -> AffairsAction.LINK
    },onClick,enabled=enabled)
    }

@Composable internal fun MapColorField(label:String,color:String?,onColor:(String?)->Unit) {
    var input by remember(color) {mutableStateOf(color.orEmpty())}
    OutlinedTextField(input,{input=it;if(it.isBlank()||Regex("#[a-fA-F0-9]{6}").matches(it))onColor(it.takeIf(String::isNotBlank))},label={Text(label)},singleLine=true,placeholder={Text("#255b59")},isError=input.isNotBlank()&&!Regex("#[a-fA-F0-9]{6}").matches(input),modifier=Modifier.fillMaxWidth())
}
