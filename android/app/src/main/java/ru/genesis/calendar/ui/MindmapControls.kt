package ru.genesis.calendar.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable internal fun MapIconButton(label:String,kind:Int,onClick:()->Unit,enabled:Boolean=true) {
    val description=genesisTranslate(label)
    TooltipBox(positionProvider=TooltipDefaults.rememberPlainTooltipPositionProvider(),tooltip={PlainTooltip {Text(label)}},state=rememberTooltipState()) {
        IconButton(onClick,enabled=enabled,modifier=Modifier.size(48.dp).semantics {contentDescription=description}) {MapControlIcon(kind)}
    }
}

/** Original map controls, sharing the site's 24-unit line geometry. */
@Composable internal fun MapControlIcon(kind:Int) {
    val ink=LocalContentColor.current
    Canvas(Modifier.size(24.dp)) {
        val s=size.width/24;val path=Path()
        fun m(x:Float,y:Float)=path.moveTo(x*s,y*s)
        fun l(x:Float,y:Float)=path.lineTo(x*s,y*s)
        when(kind) {
            0->{m(4f,12f);l(9f,12f);l(9f,5f);l(19f,5f);m(9f,12f);l(9f,19f);l(19f,19f)}
            1->{m(5f,4f);l(5f,20f);m(5f,7f);l(20f,7f);m(5f,12f);l(16f,12f);m(5f,17f);l(20f,17f)}
            2->{m(4f,5f);l(10f,5f);l(10f,17f);l(20f,17f);m(16f,13f);l(16f,21f);m(12f,17f);l(20f,17f)}
            3->{m(4f,5f);l(9f,5f);l(9f,19f);l(14f,19f);m(9f,5f);l(14f,5f);m(18f,8f);l(18f,16f);m(14f,12f);l(22f,12f)}
            4->{m(4f,4f);l(20f,4f);l(20f,20f);l(4f,20f);l(4f,4f);m(7f,12f);l(11f,16f);l(18f,8f)}
            5->{m(4f,9f);l(4f,4f);l(9f,4f);m(15f,4f);l(20f,4f);l(20f,9f);m(20f,15f);l(20f,20f);l(15f,20f);m(9f,20f);l(4f,20f);l(4f,15f)}
            6->{m(4f,5f);l(10f,5f);l(10f,19f);l(20f,19f);m(15f,8f);l(18f,11f);l(21f,8f)}
            7,8->{val a=if(kind==7)6f else 18f;val b=if(kind==7)11f else 13f;m(12f,24-a);l(12f,a);m(7f,b);l(12f,a);l(17f,b)}
            9->{m(4f,5f);l(9f,5f);l(9f,19f);l(14f,19f);m(15f,7f);l(22f,14f);m(22f,7f);l(15f,14f)}
            10->{m(9f,5f);l(3f,11f);l(9f,17f);m(3f,11f);l(15f,11f);l(20f,16f);l(20f,21f)}
            else->{m(4f,12f);l(21f,12f);m(16f,7f);l(21f,12f);l(16f,17f)}
        }
        drawPath(path,ink,style=Stroke(1.8f*s))
        if(kind==0){drawCircle(ink,2*s,Offset(3*s,12*s),style=Stroke(1.8f*s));drawCircle(ink,2*s,Offset(20*s,5*s),style=Stroke(1.8f*s));drawCircle(ink,2*s,Offset(20*s,19*s),style=Stroke(1.8f*s))}
    }
}

@Composable internal fun MapColorField(label:String,color:String?,onColor:(String?)->Unit) {
    var input by remember(color) {mutableStateOf(color.orEmpty())}
    OutlinedTextField(input,{input=it;if(it.isBlank()||Regex("#[a-fA-F0-9]{6}").matches(it))onColor(it.takeIf(String::isNotBlank))},label={Text(label)},singleLine=true,placeholder={Text("#255b59")},isError=input.isNotBlank()&&!Regex("#[a-fA-F0-9]{6}").matches(input),modifier=Modifier.fillMaxWidth())
}
