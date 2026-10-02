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
        "Переведены карты Стойхейона, сектора Теокиклоса, описания календарей и задачи на все языки приложения.",
        "Для нового аккаунта включены григорианские календари, неделя с понедельника, общий свайп и тема по времени устройства.",
        "Предложение подключить Google больше не повторяется при синхронизации.",
        "В разделе «Сегодня» вся плашка переключает календарь, а заголовок мягко подсвечивается.")),
    "en" to Notes("What's new", "Got it", listOf(
        "Stoicheion cards, Theokyklos sectors, calendar descriptions and tasks are translated into every app language.",
        "New accounts start with Gregorian calendars, Monday weeks, shared swiping and a theme based on device time.",
        "The Google connection offer no longer reappears during sync.",
        "The entire Today badge now switches calendars with a subtle title animation.")),
    "el" to Notes("Τι νέο υπάρχει", "Εντάξει", listOf(
        "Μεταφράστηκαν οι κάρτες Στοιχείων, οι τομείς Θεοκύκλου, οι περιγραφές ημερολογίων και οι εργασίες σε όλες τις γλώσσες.",
        "Οι νέοι λογαριασμοί ξεκινούν με Γρηγοριανά ημερολόγια, εβδομάδα από Δευτέρα, κοινή σάρωση και εμφάνιση σύμφωνα με την ώρα της συσκευής.",
        "Η πρόταση σύνδεσης με την υπηρεσία συγχρονισμού δεν επανεμφανίζεται.",
        "Ολόκληρη η ένδειξη Σήμερα αλλάζει ημερολόγιο με διακριτικό φωτισμό των γραμμάτων.")),
    "de" to Notes("Was ist neu?", "Verstanden", listOf("Karten, Sektoren, Kalenderbeschreibungen und Aufgaben sind in alle App-Sprachen übersetzt.", "Neue Konten starten mit gregorianischen Kalendern, Montag als Wochenbeginn, gemeinsamem Wischen und zeitgesteuertem Design.", "Das Angebot zur Google-Verknüpfung erscheint bei der Synchronisierung nicht erneut.", "Das gesamte Heute-Feld wechselt den Kalender; der Titel leuchtet kurz auf.")),
    "fr" to Notes("Nouveautés", "Compris", listOf("Les cartes, secteurs, descriptions des calendriers et tâches sont traduits dans toutes les langues.", "Les nouveaux comptes utilisent les calendriers grégoriens, la semaine dès lundi, le balayage commun et le thème selon l'heure de l'appareil.", "La proposition de connexion Google ne revient plus pendant la synchronisation.", "Toute la zone Aujourd'hui change de calendrier avec une légère animation du titre.")),
    "es" to Notes("Novedades", "Entendido", listOf("Las cartas, sectores, descripciones de calendarios y tareas están traducidos a todos los idiomas.", "Las cuentas nuevas usan calendarios gregorianos, semanas desde el lunes, deslizamiento común y tema según la hora del dispositivo.", "La invitación a conectar Google ya no se repite al sincronizar.", "Toda la placa Hoy cambia de calendario con un leve brillo en el título.")),
    "it" to Notes("Novità", "Ho capito", listOf("Carte, settori, descrizioni dei calendari e attività sono tradotti in tutte le lingue.", "I nuovi account iniziano con calendari gregoriani, settimana dal lunedì, scorrimento condiviso e tema secondo l'ora del dispositivo.", "La richiesta di collegare Google non riappare durante la sincronizzazione.", "L'intera etichetta Oggi cambia calendario con una lieve animazione del titolo.")),
    "pt" to Notes("Novidades", "Entendi", listOf("Cartas, setores, descrições dos calendários e tarefas foram traduzidos para todos os idiomas.", "Contas novas começam com calendários gregorianos, semana na segunda-feira, deslize geral e tema conforme a hora do dispositivo.", "O convite para conectar o Google não reaparece na sincronização.", "Toda a faixa Hoje muda o calendário com uma leve animação do título.")),
    "pl" to Notes("Co nowego", "Rozumiem", listOf("Karty, sektory, opisy kalendarzy i zadania przetłumaczono na wszystkie języki.", "Nowe konta używają kalendarzy gregoriańskich, tygodnia od poniedziałku, wspólnego przesuwania i motywu według czasu urządzenia.", "Prośba o połączenie z Google nie wraca podczas synchronizacji.", "Cała plakietka Dzisiaj zmienia kalendarz z delikatnym podświetleniem liter.")),
    "sr" to Notes("Шта је ново", "Разумем", listOf("Карте, сектори, описи календара и задаци преведени су на све језике.", "Нови налози користе грегоријанске календаре, недељу од понедељка, заједничко превлачење и тему према времену уређаја.", "Понуда за повезивање са Гуглом не понавља се при синхронизацији.", "Цела ознака Данас мења календар уз благо осветљавање слова.")),
    "uk" to Notes("Що нового", "Зрозуміло", listOf("Карти Стойхейону, сектори Теокіклосу, описи календарів і завдання перекладено всіма мовами.", "Нові облікові записи використовують григоріанські календарі, тиждень від понеділка, спільний свайп і тему за часом пристрою.", "Пропозиція підключити Google не повторюється під час синхронізації.", "Уся плашка Сьогодні перемикає календар із легким підсвічуванням літер.")),
    "zh" to Notes("本次更新", "知道了", listOf("卡牌、扇区、日历说明和任务已翻译为应用支持的所有语言。", "新账户默认使用公历、周一为一周之始、统一滑动切换，以及按设备时间变化的主题。", "同步时不再重复弹出连接 Google 的提示。", "点击整个“今天”标签即可切换日历，标题会轻微依次亮起。")),
    "tr" to Notes("Yenilikler", "Anladım", listOf("Kartlar, bölümler, takvim açıklamaları ve görevler tüm uygulama dillerine çevrildi.", "Yeni hesaplar Gregoryen takvim, pazartesi başlayan hafta, ortak kaydırma ve cihaz saatine göre tema ile açılır.", "Google bağlantı önerisi eşitleme sırasında tekrar görünmez.", "Bugün etiketinin tamamı takvimi değiştirir; başlık hafifçe parlar.")),
    "ja" to Notes("今回の更新", "了解", listOf("カード、各区画、カレンダーの説明、タスクをすべての対応言語に翻訳しました。", "新規アカウントではグレゴリオ暦、月曜始まり、共通スワイプ、端末の時刻に合わせたテーマが初期設定です。", "同期時に Google 接続の案内が繰り返し表示されなくなりました。", "「今日」の表示全体で暦を切り替えられ、文字が控えめに順番に光ります。")),
)

private val finalChange = mapOf(
    "ru" to "В настройках появилась плашка обновления; реклама в «Сегодня» показывается только после публикации администратором.",
    "en" to "Settings now show an update banner; Today ads appear only after an administrator publishes them.",
    "el" to "Οι ρυθμίσεις δείχνουν διαθέσιμες ενημερώσεις· οι διαφημίσεις εμφανίζονται μόνο μετά από δημοσίευση διαχειριστή.",
    "de" to "In den Einstellungen erscheint ein Update-Hinweis; Anzeigen werden erst nach Freigabe durch einen Administrator gezeigt.",
    "fr" to "Les réglages affichent les mises à jour; les publicités n'apparaissent qu'après publication par un administrateur.",
    "es" to "Los ajustes muestran las actualizaciones; los anuncios solo aparecen tras su publicación por un administrador.",
    "it" to "Le impostazioni mostrano gli aggiornamenti; gli annunci appaiono solo dopo la pubblicazione da parte di un amministratore.",
    "pt" to "As definições mostram as atualizações; anúncios só aparecem após publicação por um administrador.",
    "pl" to "Ustawienia pokazują aktualizacje; reklamy pojawiają się dopiero po publikacji przez administratora.",
    "sr" to "Подешавања приказују ажурирања; рекламе се појављују тек када их администратор објави.",
    "uk" to "У налаштуваннях видно оновлення; реклама з’являється лише після публікації адміністратором.",
    "zh" to "设置中会显示更新提示；广告仅在管理员发布后才会出现。",
    "tr" to "Ayarlar güncellemeleri gösterir; reklamlar yalnızca yönetici yayımladıktan sonra görünür.",
    "ja" to "設定に更新通知を表示します。広告は管理者が公開した場合にのみ表示されます。",
)

private val currentReleaseChanges = mapOf(
    "ru" to listOf("Добавлен вход через Яндекс ID на сайте и Android. Аккаунты Google и Яндекса разделены.", "При входе через Яндекс проекты и привычки синхронизируются с GENESIS; задачи и списки пока остаются на устройстве."),
    "en" to listOf("Yandex ID sign-in is now available on the website and Android. Google and Yandex accounts remain separate.", "With Yandex sign-in, projects and habits sync with GENESIS; tasks and lists stay on this device for now."),
    "el" to listOf("Η σύνδεση με Yandex ID είναι διαθέσιμη στον ιστότοπο και στο Android. Οι λογαριασμοί Google και Yandex παραμένουν ξεχωριστοί.", "Με σύνδεση Yandex, τα έργα και οι συνήθειες συγχρονίζονται με το GENESIS· οι εργασίες και οι λίστες μένουν προς το παρόν στη συσκευή."),
    "de" to listOf("Die Anmeldung mit Yandex ID ist jetzt auf der Website und unter Android verfügbar. Google- und Yandex-Konten bleiben getrennt.", "Bei Anmeldung mit Yandex werden Projekte und Gewohnheiten mit GENESIS synchronisiert; Aufgaben und Listen bleiben vorerst auf diesem Gerät."),
    "fr" to listOf("La connexion avec Yandex ID est disponible sur le site et Android. Les comptes Google et Yandex restent séparés.", "Avec Yandex, projets et habitudes se synchronisent avec GENESIS ; tâches et listes restent pour le moment sur cet appareil."),
    "es" to listOf("Ya puedes iniciar sesión con Yandex ID en la web y Android. Las cuentas de Google y Yandex permanecen separadas.", "Con Yandex, los proyectos y hábitos se sincronizan con GENESIS; las tareas y listas permanecen por ahora en este dispositivo."),
    "it" to listOf("L'accesso con Yandex ID è disponibile sul sito e su Android. Gli account Google e Yandex restano separati.", "Con Yandex, progetti e abitudini si sincronizzano con GENESIS; attività ed elenchi restano per ora su questo dispositivo."),
    "pt" to listOf("O início de sessão com Yandex ID está disponível no site e no Android. As contas Google e Yandex permanecem separadas.", "Com Yandex, projetos e hábitos sincronizam com o GENESIS; tarefas e listas ficam por enquanto neste dispositivo."),
    "pl" to listOf("Logowanie przez Yandex ID jest dostępne w witrynie i na Androidzie. Konta Google i Yandex pozostają oddzielne.", "Po zalogowaniu przez Yandex projekty i nawyki synchronizują się z GENESIS; zadania i listy na razie pozostają na tym urządzeniu."),
    "sr" to listOf("Prijavljivanje preko Yandex ID-a dostupno je na sajtu i Androidu. Google i Yandex nalozi ostaju odvojeni.", "Uz Yandex prijavu, projekti i navike se sinhronizuju sa GENESIS-om; zadaci i liste za sada ostaju na ovom uređaju."),
    "uk" to listOf("Вхід через Yandex ID доступний на сайті й Android. Облікові записи Google і Yandex залишаються окремими.", "За входу через Yandex проєкти та звички синхронізуються з GENESIS; завдання й списки поки залишаються на цьому пристрої."),
    "zh" to listOf("网站和 Android 现已支持 Yandex ID 登录。Google 与 Yandex 账户保持独立。", "使用 Yandex 登录时，项目和习惯会与 GENESIS 同步；任务和清单暂时仅保存在此设备上。"),
    "tr" to listOf("Yandex ID ile giriş artık web sitesinde ve Android'de kullanılabilir. Google ve Yandex hesapları ayrı kalır.", "Yandex ile girişte projeler ve alışkanlıklar GENESIS ile eşitlenir; görevler ve listeler şimdilik bu cihazda kalır."),
    "ja" to listOf("ウェブサイトと Android で Yandex ID ログインが利用できます。Google と Yandex のアカウントは別々に管理されます。", "Yandex でログインすると、プロジェクトと習慣は GENESIS と同期します。タスクとリストは当面この端末に保存されます。"),
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
            (currentReleaseChanges[LocalGenesisLanguage.current] ?: currentReleaseChanges.getValue("ru")).forEach {
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
