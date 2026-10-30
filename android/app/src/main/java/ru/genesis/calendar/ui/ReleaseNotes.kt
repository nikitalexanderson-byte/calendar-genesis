package ru.genesis.calendar.ui

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import ru.genesis.calendar.ui.AlertDialog
import androidx.compose.material3.MaterialTheme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.BuildConfig
import ru.genesis.calendar.ui.Text

internal data class Notes(val title: String, val close: String, val changes: List<String>)

internal val notes = mapOf(
    "ru" to Notes("Что нового", "Понятно", listOf(
        "Обновлены настроение и трекеры «Сегодня»: сон и воздержание появляются только для созданных планов. Воздержанием можно управлять в «Привычках».",
        "Таймер оформлен отдельным блоком внутри привычки. Его можно включать и отключать для каждой привычки.",
        "Календари стали компактнее: текст на иллюстрациях, полные описания месяцев и сворачиваемая справка года. Исправлены переходы между месяцем и днём.",
        "Улучшены размеры текста и расположение действий. Переключатель темы, загрузка и сообщения синхронизации перенесены в боковую панель.",
        "В Стойхейоне добавлен расклад из трёх карт: прошлое, настоящее и будущее, с прямыми и перевёрнутыми положениями.",
        "В Оракуле появились изопсефия олимпийцев и руководство по моделированию будущего с секторами, целями и практикой.")),
    "en" to Notes("What’s new", "Got it", listOf(
        "Updated Today mood and trackers: sleep and abstinence appear only for configured plans. Manage abstinence in Habits.",
        "The timer has its own block inside each habit and can be enabled or disabled separately.",
        "More compact calendars put text over artwork, show full month descriptions and collapse year information. Month and day navigation is improved.",
        "Improved text sizing and action alignment. Theme switching, loading and synchronization messages are now in the sidebar.",
        "Stoicheion adds a three-card spread for the past, present and future, with upright and reversed positions.",
        "The Oracle adds Olympian isopsephy and a future-modeling guide with sectors, goals and practice.")),
    "el" to Notes("Τι νέο υπάρχει", "Κατάλαβα", listOf(
        "Ανανεώθηκαν η διάθεση και οι καταγραφές της σημερινής προβολής: ύπνος και αποχή εμφανίζονται μόνο για δημιουργημένα προγράμματα. Η διαχείριση αποχής γίνεται στις Συνήθειες.",
        "Το χρονόμετρο έχει δικό του πλαίσιο μέσα σε κάθε συνήθεια και ενεργοποιείται ή απενεργοποιείται ξεχωριστά.",
        "Πιο συμπαγή ημερολόγια με κείμενο πάνω στις εικόνες, πλήρεις περιγραφές μηνών και πτυσσόμενες πληροφορίες έτους. Βελτιώθηκε η πλοήγηση μήνα και ημέρας.",
        "Βελτιώθηκαν το μέγεθος κειμένου και η στοίχιση ενεργειών. Η αλλαγή θέματος, η φόρτωση και τα μηνύματα συγχρονισμού βρίσκονται στην πλαϊνή στήλη.",
        "Το Στοιχεῖον προσθέτει άνοιγμα τριών καρτών για παρελθόν, παρόν και μέλλον, με όρθιες και ανεστραμμένες θέσεις.",
        "Το Μαντείο προσθέτει ισοψηφία των Ολυμπίων και οδηγό διαμόρφωσης του μέλλοντος με τομείς, στόχους και πρακτική.")),
    "de" to Notes("Was ist neu", "Verstanden", listOf(
        "Stimmung und Tracker in Heute wurden überarbeitet: Schlaf und Abstinenz erscheinen nur für eingerichtete Pläne. Abstinenz wird unter Gewohnheiten verwaltet.",
        "Der Timer hat einen eigenen Bereich innerhalb jeder Gewohnheit und lässt sich einzeln ein- oder ausschalten.",
        "Kompaktere Kalender mit Text auf den Bildern, vollständigen Monatsbeschreibungen und einklappbaren Jahresinformationen. Die Monats- und Tagesnavigation wurde verbessert.",
        "Textgrößen und die Ausrichtung der Aktionen wurden verbessert. Themenwechsel, Lade- und Synchronisationsmeldungen stehen jetzt in der Seitenleiste.",
        "Stoicheion bietet eine Drei-Karten-Legung für Vergangenheit, Gegenwart und Zukunft mit aufrechten und umgekehrten Positionen.",
        "Das Orakel ergänzt die Isopsephie der Olympier und eine Anleitung zur Zukunftsgestaltung mit Bereichen, Zielen und Praxis.")),
    "fr" to Notes("Nouveautés", "Compris", listOf(
        "Humeur et suivis d’Aujourd’hui revus : sommeil et abstinence apparaissent uniquement pour les programmes créés. L’abstinence se gère dans Habitudes.",
        "Le minuteur possède son propre bloc dans chaque habitude et peut être activé ou désactivé séparément.",
        "Calendriers plus compacts : texte sur les illustrations, descriptions mensuelles complètes et informations annuelles repliables. Navigation entre mois et jour améliorée.",
        "Taille du texte et alignement des actions améliorés. Le thème, le chargement et les messages de synchronisation se trouvent dans la barre latérale.",
        "Stoicheion ajoute un tirage de trois cartes pour le passé, le présent et l’avenir, avec positions droites et renversées.",
        "L’Oracle ajoute l’isopséphie des Olympiens et un guide de modélisation de l’avenir avec secteurs, objectifs et pratique.")),
    "es" to Notes("Novedades", "Entendido", listOf(
        "Estado de ánimo y seguimientos de Hoy renovados: sueño y abstinencia aparecen solo para planes creados. La abstinencia se gestiona en Hábitos.",
        "El temporizador tiene su propio bloque dentro de cada hábito y puede activarse o desactivarse por separado.",
        "Calendarios más compactos con texto sobre las ilustraciones, descripciones mensuales completas e información anual plegable. Navegación de meses y días mejorada.",
        "Mejorados el tamaño del texto y la alineación de acciones. El tema, la carga y los mensajes de sincronización están en la barra lateral.",
        "Stoicheion añade una tirada de tres cartas para pasado, presente y futuro, con posiciones derechas e invertidas.",
        "El Oráculo incorpora la isopsefía de los olímpicos y una guía para modelar el futuro con sectores, objetivos y práctica.")),
    "it" to Notes("Novità", "Ho capito", listOf(
        "Umore e tracciamenti di Oggi rinnovati: sonno e astinenza appaiono solo per i piani creati. L’astinenza si gestisce in Abitudini.",
        "Il timer ha un blocco dedicato in ogni abitudine e può essere attivato o disattivato separatamente.",
        "Calendari più compatti con testo sulle illustrazioni, descrizioni mensili complete e informazioni annuali richiudibili. Navigazione tra mesi e giorni migliorata.",
        "Migliorati dimensioni del testo e allineamento delle azioni. Tema, caricamento e messaggi di sincronizzazione si trovano nella barra laterale.",
        "Stoicheion aggiunge una stesa di tre carte per passato, presente e futuro, con posizioni dritte e rovesciate.",
        "L’Oracolo aggiunge l’isopsefia degli olimpici e una guida per modellare il futuro con settori, obiettivi e pratica.")),
    "pt" to Notes("Novidades", "Entendi", listOf(
        "Humor e acompanhamentos de Hoje renovados: sono e abstinência aparecem apenas para planos criados. A abstinência é gerida em Hábitos.",
        "O temporizador tem um bloco próprio dentro de cada hábito e pode ser ativado ou desativado separadamente.",
        "Calendários mais compactos com texto sobre as ilustrações, descrições mensais completas e informações anuais recolhíveis. Navegação entre meses e dias melhorada.",
        "Melhorados os tamanhos do texto e o alinhamento das ações. Tema, carregamento e mensagens de sincronização estão na barra lateral.",
        "Stoicheion acrescenta uma tiragem de três cartas para passado, presente e futuro, com posições direitas e invertidas.",
        "O Oráculo acrescenta a isopsefia dos olímpicos e um guia para modelar o futuro com setores, objetivos e prática.")),
    "pl" to Notes("Co nowego", "Rozumiem", listOf(
        "Odświeżono nastrój i śledzenie w Dzisiaj: sen i abstynencja pojawiają się tylko dla utworzonych planów. Abstynencją zarządza się w Nawykach.",
        "Timer ma własny blok wewnątrz każdego nawyku i można go osobno włączać lub wyłączać.",
        "Bardziej zwarte kalendarze z tekstem na ilustracjach, pełnymi opisami miesięcy i zwijanymi informacjami o roku. Poprawiono nawigację miesięcy i dni.",
        "Poprawiono rozmiary tekstu i wyrównanie działań. Zmiana motywu, ładowanie i komunikaty synchronizacji są w panelu bocznym.",
        "Stoicheion dodaje rozkład trzech kart na przeszłość, teraźniejszość i przyszłość, z pozycjami prostymi i odwróconymi.",
        "Wyrocznia dodaje izopsefię olimpijczyków i przewodnik modelowania przyszłości z obszarami, celami i praktyką.")),
    "sr" to Notes("Шта је ново", "Разумем", listOf(
        "Обновљени су расположење и праћења у Данас: сан и уздржавање приказују се само за направљене планове. Уздржавањем се управља у Навикама.",
        "Тајмер има посебан блок у свакој навици и може се засебно укључити или искључити.",
        "Компактнији календари са текстом преко илустрација, целим описима месеци и склопивим подацима о години. Побољшана је навигација месеци и дана.",
        "Побољшани су величина текста и поравнање радњи. Промена теме, учитавање и поруке синхронизације налазе се у бочном панелу.",
        "Стојхејон додаје распоред три карте за прошлост, садашњост и будућност, са усправним и обрнутим положајима.",
        "Пророчиште додаје изопсефију олимпијаца и водич за обликовање будућности са секторима, циљевима и праксом.")),
    "uk" to Notes("Що нового", "Зрозуміло", listOf(
        "Оновлено настрій і трекери «Сьогодні»: сон та утримання з’являються лише для створених планів. Утриманням можна керувати в «Звичках».",
        "Таймер має окремий блок усередині кожної звички, і його можна вмикати або вимикати окремо.",
        "Компактніші календарі: текст на ілюстраціях, повні описи місяців і згортана довідка року. Покращено переходи між місяцем і днем.",
        "Покращено розміри тексту та вирівнювання дій. Перемикання теми, завантаження й повідомлення синхронізації перенесено до бічної панелі.",
        "У Стойхейоні додано розклад із трьох карт: минуле, сьогодення та майбутнє, із прямими й перевернутими положеннями.",
        "В Оракулі з’явилися ізопсефія олімпійців і посібник із моделювання майбутнього із секторами, цілями та практикою.")),
    "zh" to Notes("本次更新", "知道了", listOf(
        "更新“今天”的心情与记录：仅显示已创建计划的睡眠和戒除内容。可在“习惯”中管理戒除计划。",
        "每个习惯内设独立计时器区域，可分别开启或关闭。",
        "日历更加紧凑：文字叠加在插图上，月份描述完整显示，年度说明可折叠。改进了月份和日期导航。",
        "改进了文字大小和操作按钮对齐。主题切换、加载和同步消息已移至侧边栏。",
        "字母占卜新增过去、现在与未来的三张牌展开，并区分正位与逆位。",
        "神谕新增奥林匹斯诸神等值数法与未来塑造指南，涵盖领域、目标和实践。")),
    "tr" to Notes("Yenilikler", "Anladım", listOf(
        "Bugün ekranındaki ruh hâli ve takipler yenilendi: uyku ve uzak durma yalnızca oluşturulan planlarda görünür. Uzak durma Alışkanlıklar bölümünden yönetilir.",
        "Zamanlayıcı her alışkanlığın içinde ayrı bir blokta yer alır ve ayrı ayrı açılıp kapatılabilir.",
        "Takvimler daha kompakt: metinler görsellerin üzerinde, ay açıklamaları eksiksiz, yıl bilgileri daraltılabilir. Ay ve gün gezintisi iyileştirildi.",
        "Metin boyutları ve işlem hizalaması iyileştirildi. Tema değiştirme, yükleme ve eşitleme mesajları yan panele taşındı.",
        "Stoicheion geçmiş, şimdi ve gelecek için düz ve ters konumları olan üç kartlık bir açılım ekler.",
        "Kâhin bölümüne Olimposluların izopsefisi ve alanlar, hedefler ve uygulamalar içeren geleceği şekillendirme rehberi eklendi.")),
    "ja" to Notes("今回の更新", "了解", listOf(
        "「今日」の気分と記録を更新しました。睡眠と禁欲は作成済みのプランのみ表示され、禁欲プランは「習慣」で管理できます。",
        "各習慣内に独立したタイマー欄を設け、習慣ごとに有効・無効を切り替えられます。",
        "カレンダーの余白を減らし、画像上の文章、月の説明全文、折りたためる年の案内を表示します。月と日の移動も改善しました。",
        "文字サイズと操作ボタンの配置を改善しました。テーマ切替、読み込み、同期メッセージはサイドバーに移動しました。",
        "ストイケイオンに過去・現在・未来の3枚引きを追加し、正位置と逆位置を区別します。",
        "神託にオリンポス神々のイソプセフィと、領域・目標・実践を含む未来を形づくるガイドを追加しました。"))
)

@Composable
internal fun releaseNotesTitle(): String = notes[LocalGenesisLanguage.current]?.title ?: notes.getValue("ru").title

@Composable
internal fun ReleaseNotesDialog(onDismiss: () -> Unit) {
    val copy = notes[LocalGenesisLanguage.current] ?: notes.getValue("ru")
    AlertDialog(onDismissRequest = onDismiss,
        modifier = Modifier.testTag("release-notes-dialog"),
        title = { Text("${copy.title} · ${BuildConfig.VERSION_NAME}") },
        text = { Column(Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(10.dp)) {
            copy.changes.forEach {
                Text("• $it", style = MaterialTheme.typography.bodyMedium)
            }
        } },
        confirmButton = { TextButton(onClick = onDismiss) { Text(copy.close) } })
}

@Composable
internal fun ReleaseNotesAutoDialog(enabled: Boolean) {
    val context = LocalContext.current
    var show by remember { mutableStateOf(false) }
    LaunchedEffect(context, enabled) {
        if (!enabled) return@LaunchedEffect
        val prefs = context.getSharedPreferences("genesis.release-notes", Context.MODE_PRIVATE)
        val seen = prefs.getInt("seenVersionCode", 0)
        if (seen >= BuildConfig.VERSION_CODE) return@LaunchedEffect
        val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
        val updated = packageInfo.lastUpdateTime > packageInfo.firstInstallTime
        prefs.edit().putInt("seenVersionCode", BuildConfig.VERSION_CODE).apply()
        show = updated
    }
    if (show) ReleaseNotesDialog { show = false }
}
