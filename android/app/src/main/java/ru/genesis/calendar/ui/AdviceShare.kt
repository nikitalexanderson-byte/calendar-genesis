package ru.genesis.calendar.ui

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.core.content.FileProvider
import ru.genesis.calendar.auth.DailyAdvice
import java.io.File
import java.util.UUID
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.size
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

internal const val adviceApplicationUrl = "https://genesiscalendar.com"

@Composable internal fun AdviceShareButton(advice: DailyAdvice, artwork: Bitmap?, copy: JSONObject,
    onFailure: (Boolean) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var preparing by remember(advice.id) { mutableStateOf(false) }
    androidx.compose.material3.IconButton(onClick = {
        preparing = true; onFailure(false)
        scope.launch {
            try {
                val intent = withContext(Dispatchers.IO) { adviceShareIntent(context, advice, artwork) }
                context.startActivity(Intent.createChooser(intent, copy.getString("share")))
            } catch (cancel: CancellationException) { throw cancel }
            catch (_: Exception) { onFailure(true) }
            finally { preparing = false }
        }
    }, enabled = !preparing, modifier = Modifier.size(48.dp).testTag("daily-advice-share")
        .semantics { contentDescription = copy.getString(if (preparing) "sharePreparing" else "share") }) {
        if (preparing) WorkspaceLoadingIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
        else GenesisLucideIcon("share-2")
    }
}

/** Full text and source attribution are laid out before allocating the exported image. */
internal fun adviceShareBitmap(advice: DailyAdvice, artwork: Bitmap?): Bitmap {
    val width = 1080
    val inset = 64
    fun layout(text: String, size: Float, bold: Boolean = false): StaticLayout {
        val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(19, 36, 38); textSize = size
            typeface = Typeface.create("sans-serif", if (bold) Typeface.BOLD else Typeface.NORMAL)
        }
        return StaticLayout.Builder.obtain(text, 0, text.length, paint, width - inset * 2)
            .setAlignment(Layout.Alignment.ALIGN_NORMAL).setIncludePad(false)
            .setLineSpacing(10f, 1f).build()
    }
    val title = layout(advice.title, 48f, true)
    val body = layout(advice.body, 36f)
    val sourceText = advice.sources.joinToString("\n") { source ->
        listOf(source.author, source.work, source.reference).filter { it.isNotBlank() }.joinToString(" · ")
    }
    val sources = layout(sourceText, 26f)
    val imageHeight = if (artwork == null) 0 else 500
    val height = inset + imageHeight + title.height + body.height + sources.height + 280
    require(height <= 20_000) { "ADVICE_SHARE_TOO_LARGE" }
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(Color.rgb(255, 253, 248))
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    var y = inset.toFloat()
    if (artwork != null) {
        val scale = minOf((width - inset * 2f) / artwork.width, imageHeight.toFloat() / artwork.height)
        val artWidth = artwork.width * scale; val artHeight = artwork.height * scale
        canvas.drawBitmap(artwork, null, RectF((width - artWidth) / 2f, y,
            (width + artWidth) / 2f, y + artHeight), paint)
        y += imageHeight + 32
    }
    fun draw(text: StaticLayout) { canvas.save(); canvas.translate(inset.toFloat(), y); text.draw(canvas); canvas.restore(); y += text.height + 28 }
    draw(title); draw(body)
    if (sourceText.isNotBlank()) draw(sources)
    paint.color = Color.rgb(37, 91, 89); paint.strokeWidth = 2f
    canvas.drawLine(inset.toFloat(), height - 142f, width - inset.toFloat(), height - 142f, paint)
    paint.textSize = 38f; paint.typeface = Typeface.create("sans-serif", Typeface.BOLD)
    canvas.drawText("GENESIS", inset.toFloat(), height - 82f, paint)
    paint.textSize = 28f; paint.typeface = Typeface.create("sans-serif", Typeface.NORMAL)
    canvas.drawText(adviceApplicationUrl, inset.toFloat(), height - 36f, paint)
    return bitmap
}

internal fun adviceShareIntent(context: Context, advice: DailyAdvice, artwork: Bitmap?): Intent {
    val directory = File(context.cacheDir, "advice-shares")
    check(directory.isDirectory || directory.mkdirs())
    directory.listFiles()?.filter { it.name.endsWith(".png") && it.lastModified() < System.currentTimeMillis() - 86_400_000 }
        ?.forEach { it.delete() }
    val file = File(directory, "GENESIS-advice-${UUID.randomUUID()}.png")
    val image = artwork ?: advice.image?.let { requireNotNull(DailyAdviceArtwork.load(context,it)) }
    val bitmap = adviceShareBitmap(advice, image)
    try { file.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) } }
    finally { bitmap.recycle() }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", file)
    return Intent(Intent.ACTION_SEND).apply {
        type = "image/png"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_TEXT, advice.title + "\n" + adviceApplicationUrl)
        putExtra(Intent.EXTRA_SUBJECT, advice.title)
        clipData = ClipData.newUri(context.contentResolver, "GENESIS", uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
}
