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
    "ru" to listOf("Плашки «Сегодня», месяца и года переключают календарь целиком с мягкой световой волной. В годовом календаре появилась закрываемая подсказка о начале года в марте.", "Сон, настроение и привычки получили единые блоки, выбор дня и календарь выполнения привычек.", "Исправлено повторное появление удалённых привычек после синхронизации; улучшены переводы и контраст экранов."),
    "en" to listOf("Today, Month and Year cards now switch calendars with a gentle light wave. The Year view offers a dismissible March-start suggestion.", "Sleep, mood and habits now have unified panels, day selection and a habit completion calendar.", "Deleted habits no longer return after sync; translations and screen contrast have improved."),
    "el" to listOf("Οι κάρτες Σήμερα, Μήνας και Έτος αλλάζουν ημερολόγιο με απαλό φωτισμό. Η ετήσια προβολή προτείνει προαιρετική αρχή τον Μάρτιο.", "Ύπνος, διάθεση και συνήθειες έχουν ενιαίες ενότητες, επιλογή ημέρας και ημερολόγιο ολοκλήρωσης.", "Οι διαγραμμένες συνήθειες δεν επιστρέφουν μετά τον συγχρονισμό· βελτιώθηκαν οι μεταφράσεις και η αντίθεση."),
    "de" to listOf("Die Felder Heute, Monat und Jahr wechseln den Kalender mit sanftem Licht. Die Jahresansicht schlägt optional einen Beginn im März vor.", "Schlaf, Stimmung und Gewohnheiten haben gemeinsame Bereiche, Tagesauswahl und einen Erfüllungskalender.", "Gelöschte Gewohnheiten kehren nach der Synchronisierung nicht zurück; Übersetzungen und Kontrast wurden verbessert."),
    "fr" to listOf("Les cartes Aujourd’hui, Mois et Année changent de calendrier avec une douce lumière. Une suggestion facultative propose mars comme début d’année.", "Sommeil, humeur et habitudes réunissent leurs panneaux, le choix du jour et un calendrier de suivi.", "Les habitudes supprimées ne reviennent plus après synchronisation ; traductions et contraste ont été améliorés."),
    "es" to listOf("Las tarjetas Hoy, Mes y Año cambian de calendario con una suave luz. La vista anual propone opcionalmente empezar en marzo.", "Sueño, ánimo y hábitos tienen paneles unificados, selección del día y un calendario de seguimiento.", "Los hábitos eliminados ya no reaparecen tras sincronizar; mejoraron las traducciones y el contraste."),
    "it" to listOf("Le schede Oggi, Mese e Anno cambiano calendario con una luce delicata. La vista annuale propone facoltativamente marzo come inizio.", "Sonno, umore e abitudini hanno pannelli unificati, scelta del giorno e un calendario dei completamenti.", "Le abitudini eliminate non tornano dopo la sincronizzazione; traduzioni e contrasto sono migliorati."),
    "pt" to listOf("Os cartões Hoje, Mês e Ano mudam de calendário com uma luz suave. A vista anual sugere opcionalmente março como início.", "Sono, humor e hábitos têm painéis unificados, seleção do dia e calendário de conclusão.", "Hábitos eliminados não regressam após sincronizar; traduções e contraste foram melhorados."),
    "pl" to listOf("Karty Dzisiaj, Miesiąc i Rok zmieniają kalendarz z delikatną falą światła. Widok roku opcjonalnie sugeruje początek w marcu.", "Sen, nastrój i nawyki mają połączone panele, wybór dnia i kalendarz wykonania.", "Usunięte nawyki nie wracają po synchronizacji; poprawiono tłumaczenia i kontrast."),
    "sr" to listOf("Kartice Danas, Mesec i Godina menjaju kalendar uz blagi talas svetlosti. Godišnji prikaz opciono predlaže početak u martu.", "San, raspoloženje i navike imaju objedinjene celine, izbor dana i kalendar ispunjavanja.", "Obrisane navike se više ne vraćaju posle sinhronizacije; poboljšani su prevodi i kontrast."),
    "uk" to listOf("Блоки Сьогодні, Місяць і Рік перемикають календар із м’якою світловою хвилею. Річний вигляд пропонує початок у березні.", "Сон, настрій і звички мають об’єднані блоки, вибір дня та календар виконання.", "Видалені звички не повертаються після синхронізації; покращено переклади й контраст."),
    "zh" to listOf("“今天”“月”和“年”卡片现在可通过柔和光效切换日历。年视图可选择从三月开始。", "睡眠、心情和习惯采用统一面板，支持选择日期并查看习惯完成日历。", "已删除的习惯不会在同步后再次出现；翻译和对比度也已改善。"),
    "tr" to listOf("Bugün, Ay ve Yıl kartları yumuşak bir ışıkla takvimi değiştirir. Yıl görünümü isteğe bağlı olarak martta başlamayı önerir.", "Uyku, ruh hâli ve alışkanlıklar birleşik paneller, gün seçimi ve tamamlama takvimi içerir.", "Silinen alışkanlıklar eşitlemeden sonra geri gelmez; çeviriler ve kontrast iyileştirildi."),
    "ja" to listOf("「今日」「月」「年」のカード全体で、柔らかな光とともに暦を切り替えられます。年表示では3月開始を選べます。", "睡眠・気分・習慣の表示をまとめ、日付選択と習慣達成カレンダーを追加しました。", "削除した習慣が同期後に戻る問題を修正し、翻訳と画面の見やすさを改善しました。"),
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
