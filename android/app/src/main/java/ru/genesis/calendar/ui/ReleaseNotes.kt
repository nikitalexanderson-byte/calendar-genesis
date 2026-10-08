package ru.genesis.calendar.ui

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TextButton
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
        "Проекты, задачи и списки собраны в разделе «Дела» с личной и общей вкладками.",
        "Общие пространства: приглашения через Gmail, дерево проектов, до 30 досок и отдельные настройки команды и досок. Раскрытие проектов сохраняется на сервере.",
        "Меню откликается в начале свайпа. Для новых установок включены иконки, общий свайп, общая обводка меню и григорианские календари.",
        "Подробности дня открываются только в сакральном режиме. Фаза Луны и сведения о лунном месяце показаны в основном блоке. Сайт и вход через Google работают на genesiscalendar.com.")),
    "en" to Notes("What’s new", "Got it", listOf(
        "Projects, tasks and lists share one Affairs section with Personal and Shared tabs.",
        "Shared workspaces include Gmail invitations, a project tree, up to 30 boards and separate team and board settings. Expanded projects are remembered by the server.",
        "The menu responds at the start of a swipe. New installations use icons, global swiping, a shared menu outline and Gregorian calendars.",
        "Day details are available only in Sacred mode. Moon phases and lunar month information appear in the main card. The website and Google sign-in use genesiscalendar.com.")),
    "el" to Notes("Τι νέο υπάρχει", "Κατάλαβα", listOf(
        "Έργα, εργασίες και λίστες βρίσκονται σε μία ενότητα με προσωπική και κοινή καρτέλα.",
        "Οι κοινοί χώροι περιλαμβάνουν προσκλήσεις, δέντρο έργων, έως τριάντα πίνακες και ξεχωριστές ρυθμίσεις ομάδας και πίνακα. Η ανάπτυξη αποθηκεύεται στον διακομιστή.",
        "Το μενού ανταποκρίνεται από την αρχή της σάρωσης. Οι νέες εγκαταστάσεις χρησιμοποιούν εικονίδια, κοινή σάρωση και περίγραμμα και Γρηγοριανά ημερολόγια.",
        "Οι λεπτομέρειες της ημέρας εμφανίζονται μόνο στην Ιερή λειτουργία. Οι φάσεις της Σελήνης και ο σεληνιακός μήνας εμφανίζονται στην κύρια κάρτα. Η σύνδεση γίνεται μέσω Γκούγκλ στον νέο ιστότοπο.")),
    "de" to Notes("Was ist neu", "Verstanden", listOf(
        "Projekte, Aufgaben und Listen sind in einem Bereich mit privaten und gemeinsamen Registerkarten vereint.",
        "Gemeinsame Räume bieten Gmail-Einladungen, einen Projektbaum, bis zu 30 Boards sowie eigene Team- und Board-Einstellungen. Aufgeklappte Projekte werden auf dem Server gespeichert.",
        "Das Menü reagiert schon zu Beginn einer Wischgeste. Neuinstallationen verwenden Symbole, gemeinsames Wischen, eine gemeinsame Menüumrandung und gregorianische Kalender.",
        "Tagesdetails erscheinen nur im sakralen Modus. Mondphase und Mondmonat stehen in der Hauptkarte. Website und Google-Anmeldung verwenden genesiscalendar.com.")),
    "fr" to Notes("Nouveautés", "Compris", listOf(
        "Projets, tâches et listes sont réunis dans une section avec des onglets personnels et partagés.",
        "Les espaces partagés proposent des invitations Gmail, une arborescence, jusqu’à 30 tableaux et des réglages distincts pour l’équipe et les tableaux. Les projets dépliés sont mémorisés sur le serveur.",
        "Le menu réagit dès le début du balayage. Les nouvelles installations utilisent des icônes, un balayage global, un contour commun du menu et des calendriers grégoriens.",
        "Les détails du jour sont réservés au mode sacré. La phase de la Lune et le mois lunaire figurent dans la carte principale. Le site et la connexion Google utilisent genesiscalendar.com.")),
    "es" to Notes("Novedades", "Entendido", listOf(
        "Proyectos, tareas y listas comparten una sección con pestañas personales y compartidas.",
        "Los espacios compartidos incluyen invitaciones de Gmail, un árbol de proyectos, hasta 30 tableros y ajustes independientes de equipo y tablero. Los proyectos desplegados se recuerdan en el servidor.",
        "El menú responde desde el inicio del gesto. Las nuevas instalaciones usan iconos, deslizamiento global, un contorno común del menú y calendarios gregorianos.",
        "Los detalles del día aparecen solo en modo sagrado. La fase lunar y el mes lunar están en la tarjeta principal. El sitio y el acceso con Google usan genesiscalendar.com.")),
    "it" to Notes("Novità", "Ho capito", listOf(
        "Progetti, attività ed elenchi sono riuniti in una sezione con schede personali e condivise.",
        "Gli spazi condivisi includono inviti Gmail, un albero dei progetti, fino a 30 bacheche e impostazioni separate per squadra e bacheca. I progetti espansi vengono ricordati dal server.",
        "Il menu reagisce all’inizio dello scorrimento. Le nuove installazioni usano icone, scorrimento globale, un contorno comune del menu e calendari gregoriani.",
        "I dettagli del giorno sono disponibili solo in modalità sacra. La fase lunare e il mese lunare compaiono nella scheda principale. Il sito e l’accesso Google usano genesiscalendar.com.")),
    "pt" to Notes("Novidades", "Entendi", listOf(
        "Projetos, tarefas e listas estão numa secção com separadores pessoais e partilhados.",
        "Os espaços partilhados incluem convites Gmail, uma árvore de projetos, até 30 quadros e definições próprias de equipa e quadro. O servidor guarda os projetos expandidos.",
        "O menu reage logo no início do gesto. As novas instalações usam ícones, deslize global, um contorno comum do menu e calendários gregorianos.",
        "Os detalhes do dia aparecem apenas no modo sagrado. A fase da Lua e o mês lunar estão no cartão principal. O site e o acesso Google usam genesiscalendar.com.")),
    "pl" to Notes("Co nowego", "Rozumiem", listOf(
        "Projekty, zadania i listy znajdują się w jednej sekcji z zakładkami prywatną i wspólną.",
        "Wspólne przestrzenie mają zaproszenia Gmail, drzewo projektów, do 30 tablic oraz osobne ustawienia zespołu i tablic. Rozwinięte projekty są zapamiętywane na serwerze.",
        "Menu reaguje na początku gestu. Nowe instalacje używają ikon, wspólnego przesuwania, wspólnego obramowania menu i kalendarzy gregoriańskich.",
        "Szczegóły dnia są dostępne tylko w trybie sakralnym. Faza Księżyca i miesiąc księżycowy są w głównej karcie. Strona i logowanie Google korzystają z genesiscalendar.com.")),
    "sr" to Notes("Шта је ново", "Разумем", listOf(
        "Пројекти, задаци и листе су у једном одељку са личном и заједничком картицом.",
        "Заједнички простори имају Gmail позивнице, дрво пројеката, до 30 табли и посебна подешавања тима и табли. Сервер памти проширене пројекте.",
        "Мени реагује на почетку превлачења. Нове инсталације користе иконе, заједничко превлачење, заједничку обводну линију менија и грегоријанске календаре.",
        "Детаљи дана су доступни само у сакралном режиму. Месечева фаза и лунарни месец су у главном блоку. Сајт и Google пријава користе genesiscalendar.com.")),
    "uk" to Notes("Що нового", "Зрозуміло", listOf(
        "Проєкти, завдання та списки об’єднані в розділі «Справи» з особистою та спільною вкладками.",
        "Спільні простори мають запрошення через Gmail, дерево проєктів, до 30 дощок і окремі налаштування команди та дощок. Розкриття проєктів зберігається на сервері.",
        "Меню реагує на початку свайпу. Нові встановлення використовують іконки, загальний свайп, спільну обводку меню та григоріанські календарі.",
        "Подробиці дня доступні лише в сакральному режимі. Фаза Місяця й відомості про місячний місяць показані в основному блоці. Сайт і вхід через Google працюють на genesiscalendar.com.")),
    "zh" to Notes("本次更新", "知道了", listOf(
        "项目、任务和清单整合到同一版块，分为个人与共享标签。",
        "共享空间支持 Gmail 邀请、项目树、最多 30 个看板以及独立的团队和看板设置。服务器会记住项目的展开状态。",
        "菜单在滑动开始时立即响应。新安装默认使用图标、全局滑动、菜单共同边框和公历。",
        "日期详情仅在神圣日历模式显示。月相和月历月份信息已放入主卡片。网站与 Google 登录使用 genesiscalendar.com。")),
    "tr" to Notes("Yenilikler", "Anladım", listOf(
        "Projeler, görevler ve listeler kişisel ve ortak sekmeleri olan tek bir bölümde toplandı.",
        "Ortak alanlarda Gmail davetleri, proje ağacı, en fazla 30 pano ve ayrı ekip ve pano ayarları bulunur. Açılan projeler sunucuda hatırlanır.",
        "Menü kaydırmanın başında tepki verir. Yeni kurulumlar simgeleri, ortak kaydırmayı, ortak menü çerçevesini ve Gregoryen takvimleri kullanır.",
        "Gün ayrıntıları yalnızca kutsal modda gösterilir. Ay evresi ve ay takvimi bilgileri ana karttadır. Site ve Google girişi genesiscalendar.com adresini kullanır.")),
    "ja" to Notes("今回の更新", "了解", listOf(
        "プロジェクト、タスク、リストを個人用と共有のタブを持つ一つの画面にまとめました。",
        "共有スペースでは Gmail 招待、プロジェクトツリー、最大30個のボード、チームとボードの個別設定が利用できます。展開状態はサーバーに保存されます。",
        "スワイプ開始時にメニューが反応します。新規インストールではアイコン、共通スワイプ、メニューの共通枠、グレゴリオ暦を使用します。",
        "日付の詳細は神聖モードのみ表示します。月相と太陰暦の月の情報はメインカードにまとめました。サイトと Google ログインは genesiscalendar.com を使用します。"))
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
