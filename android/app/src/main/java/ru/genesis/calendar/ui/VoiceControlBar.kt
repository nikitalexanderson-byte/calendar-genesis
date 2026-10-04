package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException

/** Foreground voice control stays visible while the user moves between app sections. */
@Composable
internal fun VoiceControlBar(english: Boolean, onCommand: suspend (String) -> String, onStop: () -> Unit) {
    var feedback by remember { mutableStateOf("") }
    var executing by remember { mutableStateOf(false) }
    val scope=rememberCoroutineScope()
    val context=LocalContext.current
    LaunchedEffect(feedback) {
        if(feedback.isNotBlank()) { delay(5_000); feedback="" }
    }
    Surface(Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=4.dp)
        .testTag("voice-control-bar"),
        shape=RoundedCornerShape(16.dp), color=Color(0xff173b38),
        border=BorderStroke(1.dp,Color(0xffdfc17e))) {
        Column(Modifier.padding(10.dp),verticalArrangement=Arrangement.spacedBy(4.dp)) {
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                Text(if(english)"Voice control is on" else "Голосовое управление включено",
                    Modifier.weight(1f),style=MaterialTheme.typography.titleSmall,
                    color=Color(0xfffff5df))
                TextButton(onClick=onStop,modifier=Modifier.testTag("voice-control-stop")) {
                    Text(if(english)"Turn off" else "Выключить",color=Color(0xffdfc17e))
                }
            }
            VoiceSpeechInput(english,true,autoStart=true,controlMode=true,
                onTranscript={ transcript -> if(!executing) { executing=true; scope.launch {
                    feedback=try { onCommand(transcript) }
                    catch (cancelled: CancellationException) { throw cancelled }
                    catch (invalid: IllegalArgumentException) {
                        val translated=translateGenesisText(context,invalid.message.orEmpty(),if(english)"en" else "ru")
                        if(translated.isNotBlank() && (!english || translated.none { it.code in 0x400..0x52f }))
                            translated
                        else if(english)"Could not run the command. Check the item name and date."
                        else "Не удалось выполнить команду. Проверьте название и дату."
                    }
                    catch (_: Exception) { if(english)"Could not run the command. Check the item name and date."
                        else "Не удалось выполнить команду. Проверьте название и дату." }
                    finally { executing=false }
                } } },
                onFailure={ feedback=it })
            Text(if(english)"Android's speech service may send audio to its provider."
                else "Служба распознавания Android может передавать аудио своему поставщику.",
                style=MaterialTheme.typography.labelSmall,color=Color(0xffdfc17e))
            if(feedback.isNotBlank()) Text(feedback,
                Modifier.fillMaxWidth().semantics { liveRegion=LiveRegionMode.Polite }
                    .testTag("voice-control-feedback"),
                style=MaterialTheme.typography.bodySmall,color=Color(0xffffe4a6))
        }
    }
}
