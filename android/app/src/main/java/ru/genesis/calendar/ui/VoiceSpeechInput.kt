package ru.genesis.calendar.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.core.content.ContextCompat

/** Keeps collecting recognition chunks until the user taps Finish. Speech services may still end each chunk. */
@Composable
internal fun VoiceSpeechInput(english: Boolean, enabled: Boolean, modifier: Modifier = Modifier,
    onTranscript: (String) -> Unit, onFailure: (String) -> Unit) {
    val context=LocalContext.current
    val transcriptCallback by rememberUpdatedState(onTranscript)
    val failureCallback by rememberUpdatedState(onFailure)
    var recognizer by remember { mutableStateOf<SpeechRecognizer?>(null) }
    var listening by remember { mutableStateOf(false) }
    var processing by remember { mutableStateOf(false) }
    var finishRequested by remember { mutableStateOf(false) }
    var partial by remember { mutableStateOf("") }
    val handler=remember { Handler(Looper.getMainLooper()) }
    val speechIntent=remember(english) { Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE,if(english)"en-US" else "ru-RU")
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1)
        putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS,60_000L)
        putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS,60_000L)
    } }
    fun launchChunk() {
        try { recognizer?.startListening(speechIntent);processing=false }
        catch (_:Exception) {
            listening=false;processing=false
            failureCallback(if(english)"Speech input could not start. Type the command instead."
                else "Не удалось запустить запись. Напишите команду вручную.")
        }
    }
    val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if(granted) {
            listening=true;finishRequested=false;partial=""
            launchChunk()
        } else failureCallback(if(english)"Allow microphone access in Android settings to dictate commands."
            else "Разрешите доступ к микрофону в настройках Android, чтобы диктовать команды.")
    }
    DisposableEffect(context,english) {
        if(SpeechRecognizer.isRecognitionAvailable(context)) {
            val speech=SpeechRecognizer.createSpeechRecognizer(context)
            recognizer=speech
            speech.setRecognitionListener(object: RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) { processing=false }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() { processing=true }
                override fun onPartialResults(results: Bundle?) {
                    partial=results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                }
                override fun onResults(results: Bundle?) {
                    val final=results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                        ?.trim().orEmpty().ifBlank { partial.trim() }
                    partial="";processing=false
                    if(final.isNotBlank()) transcriptCallback(final)
                    if(finishRequested) { listening=false;finishRequested=false }
                    else if(listening) handler.postDelayed({ if(listening&&!finishRequested) launchChunk() },220)
                }
                override fun onError(error: Int) {
                    processing=false
                    if(finishRequested) {
                        if(partial.isNotBlank()) transcriptCallback(partial.trim())
                        partial="";listening=false;finishRequested=false
                    } else if(listening && error in setOf(SpeechRecognizer.ERROR_NO_MATCH,
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT)) {
                        handler.postDelayed({ if(listening&&!finishRequested) launchChunk() },220)
                    } else {
                        listening=false;partial=""
                        failureCallback(if(english)"Speech recognition stopped. Check the connection or type the command."
                            else "Распознавание остановилось. Проверьте соединение или напишите команду.")
                    }
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
        onDispose {
            listening=false;finishRequested=true
            handler.removeCallbacksAndMessages(null)
            speechOrNull(recognizer)?.destroy()
            recognizer=null
        }
    }
    if(listening) {
        Column(modifier) {
        Button(onClick={
            finishRequested=true;processing=true
            recognizer?.stopListening()
        },enabled=enabled&&!finishRequested,modifier=Modifier.fillMaxWidth().testTag("voice-finish")) {
            Text(if(english)"■ Finish and recognize" else "■ Завершить и распознать")
        }
        if(processing) Text(if(english)"Recognizing…" else "Распознаём…",
            style=MaterialTheme.typography.labelSmall)
        }
    } else {
        OutlinedButton(onClick={
            if(!SpeechRecognizer.isRecognitionAvailable(context)) {
                failureCallback(if(english)"Speech recognition is unavailable on this device."
                    else "Распознавание речи недоступно на устройстве.")
            } else if(ContextCompat.checkSelfPermission(context,Manifest.permission.RECORD_AUDIO)
                ==PackageManager.PERMISSION_GRANTED) {
                listening=true;finishRequested=false;partial="";launchChunk()
            } else permission.launch(Manifest.permission.RECORD_AUDIO)
        },enabled=enabled,modifier=modifier.testTag("voice-start")) {
            Text(if(english)"🎙 Start recording" else "🎙 Начать запись")
        }
    }
}

private fun speechOrNull(recognizer: SpeechRecognizer?) = recognizer
