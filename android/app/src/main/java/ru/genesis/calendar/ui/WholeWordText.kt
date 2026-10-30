package ru.genesis.calendar.ui

import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.foundation.text.modifiers.TextAutoSizeLayoutScope
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/** Optional local observer for native layout acceptance; no user text leaves the composition. */
internal val LocalGenesisTextLayoutAudit = staticCompositionLocalOf<((String, TextLayoutResult) -> Unit)?> { null }

internal fun isInsideWord(text: String, offset: Int): Boolean {
    if (offset <= 0 || offset >= text.length) return false
    fun isWordLetter(char: Char): Boolean = char.isLetterOrDigit() && when (Character.UnicodeScript.of(char.code)) {
        Character.UnicodeScript.HAN, Character.UnicodeScript.HIRAGANA,
        Character.UnicodeScript.KATAKANA, Character.UnicodeScript.HANGUL -> false
        else -> true
    }
    return isWordLetter(text[offset - 1]) && isWordLetter(text[offset])
}

internal fun TextLayoutResult.splitsWord(): Boolean = (0 until (lineCount - 1).coerceAtLeast(0)).any { line ->
    isInsideWord(layoutInput.text.text, getLineEnd(line, visibleEnd = true))
}

/** Preserve the requested size unless the platform breaks a word or a one-line label overflows. */
internal data class WholeWordTextAutoSize(val preferred: TextUnit, val fitSingleLine: Boolean) : TextAutoSize {
    override fun TextAutoSizeLayoutScope.getFontSize(constraints: Constraints, text: AnnotatedString): TextUnit {
        val largest = preferred.toPx()
        val smallest = minOf(largest, 8.sp.toPx())
        val step = .5.sp.toPx()
        var candidate = largest
        while (true) {
            val layout = performLayout(constraints, text, candidate.toSp())
            val overflow = fitSingleLine && (layout.didOverflowWidth || layout.didOverflowHeight ||
                (layout.lineCount > 0 && layout.isLineEllipsized(0)))
            if (!layout.splitsWord() && !overflow) return candidate.toSp()
            if (candidate <= smallest) return candidate.toSp()
            candidate = (candidate - step).coerceAtLeast(smallest)
        }
    }
}
