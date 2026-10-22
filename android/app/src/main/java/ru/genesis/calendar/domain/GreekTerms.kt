package ru.genesis.calendar.domain

/** Localize authored glossary words; individual alphabet symbols stay Greek. */
internal fun formatGreekTerms(text: String, language: String): String {
    if (language == "el") return text
    val alphabet = "αβγδεζηθικλμνξοπρστυφχψως"
    val latin = listOf("a","b","g","d","e","z","e","th","i","k","l","m","n","x","o","p","r","s","t","y","ph","ch","ps","o","s")
    val cyrillic = listOf("а","б","г","д","е","з","е","т","и","к","л","м","н","кс","о","п","р","с","т","и","ф","х","пс","о","с")
    val letters = if (language in setOf("ru", "uk", "sr")) cyrillic else latin
    // Android 8/9's ICU regex does not accept Java's IsGreek property alias.
    // Scan Unicode code points so accents and standalone alphabet symbols stay intact.
    return buildString(text.length) {
        var offset = 0
        while (offset < text.length) {
            val first = text.codePointAt(offset)
            if (!greekCodePoint(first)) {
                appendCodePoint(first)
                offset += Character.charCount(first)
                continue
            }
            val start = offset
            var greekCount = 0
            while (offset < text.length) {
                val point = text.codePointAt(offset)
                if (!greekCodePoint(point) && !combiningMark(point)) break
                if (greekCodePoint(point)) greekCount++
                offset += Character.charCount(point)
            }
            val token = text.substring(start, offset)
            if (greekCount < 2) {
                append(token)
                continue
            }
            val normalized = java.text.Normalizer.normalize(token, java.text.Normalizer.Form.NFD)
            val plain = buildString {
                var index = 0
                while (index < normalized.length) {
                    val point = normalized.codePointAt(index)
                    if (!combiningMark(point)) appendCodePoint(point)
                    index += Character.charCount(point)
                }
            }
            val converted = plain.lowercase(java.util.Locale.ROOT).map { char ->
                alphabet.indexOf(char).takeIf { it >= 0 }?.let { letters[it] } ?: char.toString()
            }.joinToString("")
            append(if (Character.isUpperCase(plain.codePointAt(0))) converted.replaceFirstChar { it.uppercase() } else converted)
        }
    }
}

private fun greekCodePoint(point: Int) = Character.UnicodeScript.of(point) == Character.UnicodeScript.GREEK
private fun combiningMark(point: Int) = when (Character.getType(point)) {
    Character.NON_SPACING_MARK.toInt(), Character.COMBINING_SPACING_MARK.toInt(), Character.ENCLOSING_MARK.toInt() -> true
    else -> false
}
