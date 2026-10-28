package ru.genesis.calendar.ui

import java.time.ZoneId

/** Short historical notes; April's disputed etymology is deliberately left open. */
internal fun gregorianMonthOrigin(month: Int): String = listOf(
    "В честь Януса", "От обряда Februa", "В честь Марса", "Латинское Aprilis",
    "В честь Майи", "В честь Юноны", "В честь Юлия Цезаря", "В честь Августа",
    "От septem — семь", "От octo — восемь", "От novem — девять", "От decem — десять",
)[month - 1]

/** The selected region supplies a seasonal description, never a weather forecast. */
internal fun gregorianMonthNature(month: Int, zone: ZoneId): String {
    val region = seasonArtRegion(zone)
    val shifted = if (isSouthernSeasonRegion(zone)) (month + 5) % 12 + 1 else month
    val season = when (shifted) { 12, 1, 2 -> 0; 3, 4, 5 -> 1; 6, 7, 8 -> 2; else -> 3 }
    return when (region) {
        SeasonArtRegion.TROPICAL -> "Тропическая зелень"
        SeasonArtRegion.ARID -> listOf("Прохладные ночи", "Весеннее цветение", "Жаркий сухой сезон", "Спад летней жары")[season]
        SeasonArtRegion.MEDITERRANEAN -> listOf("Мягкая влажная зима", "Весеннее цветение", "Сухое тёплое лето", "Осенние дожди")[season]
        SeasonArtRegion.BOREAL -> listOf("Снег и долгие ночи", "Пробуждение севера", "Долгие светлые дни", "Золотая хвоя и листва")[season]
        else -> listOf("Зимний покой", "Первые проталины", "Пробуждение природы", "Молодая зелень",
            "Цветение садов", "Долгие светлые дни", "Летнее разнотравье", "Созревание плодов",
            "Первые краски осени", "Золотая листва", "Подготовка к зиме", "Короткие зимние дни")[shifted - 1]
    }
}
