package ru.genesis.calendar.ui

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONObject
import ru.genesis.calendar.BuildConfig
import java.net.HttpURLConnection
import java.net.URL

internal data class AndroidRelease(val versionCode: Int, val versionName: String)

internal fun newerAndroidRelease(body: String, installedCode: Int): AndroidRelease? {
    val json = JSONObject(body)
    val code = json.getInt("versionCode")
    val name = json.getString("versionName")
    if (code <= installedCode || !Regex("[0-9]+(?:\\.[0-9]+){1,3}").matches(name)) return null
    return AndroidRelease(code, name)
}

private fun fetchAndroidRelease(): AndroidRelease? {
    val connection = URL("https://genesiscalendar.ru/android-update.json").openConnection() as HttpURLConnection
    connection.connectTimeout = 5_000
    connection.readTimeout = 5_000
    connection.useCaches = false
    try {
        if (connection.responseCode != HttpURLConnection.HTTP_OK) return null
        val body = connection.inputStream.bufferedReader().use { it.readText() }
        if (body.length > 8_192) return null
        return newerAndroidRelease(body, BuildConfig.VERSION_CODE)
    } finally { connection.disconnect() }
}

/** Checks after a completed account sync, once per offered version in this app session. */
@Composable
internal fun AndroidUpdatePrompt(context: Context, synchronizedAt: Long?, enabled: Boolean) {
    var release by remember { mutableStateOf<AndroidRelease?>(null) }
    var lastOffered by remember { mutableIntStateOf(0) }
    LaunchedEffect(enabled, synchronizedAt) {
        if (enabled && synchronizedAt != null) {
            val found = withContext(Dispatchers.IO) { runCatching(::fetchAndroidRelease).getOrNull() }
            if (found != null && found.versionCode != lastOffered) {
                lastOffered = found.versionCode
                release = found
            }
        }
    }
    release?.let { offered ->
        AndroidUpdateDialog(context, offered) { release = null }
    }
}

@Composable
private fun AndroidUpdateDialog(context: Context, release: AndroidRelease, onDismiss: () -> Unit) {
    val downloads = remember(context) { context.getSystemService(DownloadManager::class.java) }
    var downloadId by remember(release) { mutableLongStateOf(0L) }
    var downloaded by remember(release) { mutableStateOf<Uri?>(null) }
    var error by remember(release) { mutableStateOf(false) }
    LaunchedEffect(downloadId) {
        if (downloadId <= 0) return@LaunchedEffect
        while (true) {
            val status = withContext(Dispatchers.IO) {
                downloads.query(DownloadManager.Query().setFilterById(downloadId)).use { cursor ->
                    if (cursor.moveToFirst()) cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                    else DownloadManager.STATUS_FAILED
                }
            }
            when (status) {
                DownloadManager.STATUS_SUCCESSFUL -> {
                    downloaded = downloads.getUriForDownloadedFile(downloadId)
                    error = downloaded == null
                    break
                }
                DownloadManager.STATUS_FAILED -> { error = true; break }
            }
            delay(1_000)
        }
    }
    AlertDialog(onDismissRequest = onDismiss,
        title = { Text("${genesisTranslate("Доступна новая версия GENESIS")} ${release.versionName}") },
        text = {
            Text(when {
                error -> "Не удалось скачать обновление. Проверьте соединение и попробуйте снова."
                downloaded != null -> "Обновление скачано. Установите его через системный установщик Android."
                downloadId > 0 -> "Скачиваем обновление…"
                else -> "После синхронизации доступно обновление приложения. Скачайте его прямо здесь."
            })
        },
        confirmButton = {
            Button(onClick = {
                val file = downloaded
                if (file != null) {
                    if (Build.VERSION.SDK_INT >= 26 && !context.packageManager.canRequestPackageInstalls()) {
                        context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:${context.packageName}"))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    } else {
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW)
                                .setDataAndType(file, "application/vnd.android.package-archive")
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION))
                        }.onFailure { error = true }
                    }
                } else if (downloadId == 0L || error) {
                    error = false
                    runCatching {
                        val request = DownloadManager.Request(Uri.parse("https://genesiscalendar.ru/api/android/download"))
                            .setTitle("GENESIS ${release.versionName}")
                            .setDescription("Обновление приложения")
                            .setMimeType("application/vnd.android.package-archive")
                            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                            .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS,
                                "GENESIS-${release.versionName}-${System.currentTimeMillis()}.apk")
                        downloadId = downloads.enqueue(request)
                    }.onFailure { error = true; downloadId = 0L }
                }
            }, modifier = Modifier.testTag("android-update-download")) {
                Text(if (downloaded != null) "Установить" else if (downloadId > 0 && !error) "Скачивается…" else "Скачать")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Позже") } },
        modifier = Modifier.testTag("android-update-dialog"))
}
