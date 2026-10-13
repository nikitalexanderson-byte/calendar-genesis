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
        "Уведомления задач и привычек используют разные звуки, цвета и значки. Настройки уведомлений сохранены. Описание и оформление майндмепов сохраняются при редактировании.",
        "Окно подключения Google Calendar и Tasks закрывается после успешного подключения. Причина временной ошибки синхронизации теперь показывается точнее.",
        "Сайт и приложение используют общий зашифрованный кэш GENESIS. Личные изменения отправляются сразу, изменения из Google проверяются не чаще раза в 15 минут при активном использовании; полная сверка — раз в сутки. Общие дела отправляются в Google только при включении синхронизации проекта.",
        "Google Tasks ограничивает весь проект GENESIS 50 000 запросами в сутки для всех пользователей сайта и приложения. При исчерпании квоты синхронизация восстановится после ежедневного сброса Google в полночь по тихоокеанскому времени, в течение суток. Вход через Google не расходует эту квоту.")),
    "en" to Notes("What’s new", "Got it", listOf(
        "Task and habit notifications use distinct sounds, colors and icons. Notification preferences are preserved. Mind map descriptions and appearance are retained when editing.",
        "The Google Calendar and Tasks connection window closes after a successful connection. Temporary sync errors now explain the cause more clearly.",
        "The website and app share an encrypted GENESIS cache. Personal changes are sent immediately; Google changes are checked at most every 15 minutes during active use, with a full daily reconciliation. Shared affairs reach Google only when project sync is enabled.",
        "Google Tasks allows 50,000 daily requests for the entire GENESIS project, shared by all website and app users. If exhausted, sync resumes after Google’s daily reset at midnight Pacific, within 24 hours. Google sign-in does not use this quota.")),
    "el" to Notes("Τι νέο υπάρχει", "Κατάλαβα", listOf(
        "Οι ειδοποιήσεις εργασιών και συνηθειών έχουν διαφορετικούς ήχους, χρώματα και εικονίδια. Οι ρυθμίσεις ειδοποιήσεων διατηρούνται. Οι περιγραφές και η εμφάνιση των χαρτών διατηρούνται κατά την επεξεργασία.",
        "Το παράθυρο σύνδεσης Google Calendar και Tasks κλείνει μετά την επιτυχή σύνδεση. Τα προσωρινά σφάλματα συγχρονισμού εξηγούν πλέον την αιτία.",
        "Ο ιστότοπος και η εφαρμογή χρησιμοποιούν κοινή κρυπτογραφημένη προσωρινή μνήμη GENESIS. Οι προσωπικές αλλαγές αποστέλλονται αμέσως. Οι αλλαγές της Google ελέγχονται το πολύ κάθε 15 λεπτά κατά την ενεργή χρήση, με πλήρη έλεγχο καθημερινά. Τα κοινά δεδομένα αποστέλλονται μόνο με ενεργό συγχρονισμό έργου.",
        "Το Google Tasks επιτρέπει 50 000 αιτήματα ημερησίως για ολόκληρο το GENESIS, για όλους τους χρήστες. Αν εξαντληθούν, ο συγχρονισμός επανέρχεται μετά την καθημερινή επαναφορά τα μεσάνυχτα ώρα Ειρηνικού, εντός 24 ωρών. Η σύνδεση Google δεν καταναλώνει αυτό το όριο.")),
    "de" to Notes("Was ist neu", "Verstanden", listOf(
        "Aufgaben und Gewohnheiten haben unterschiedliche Benachrichtigungstöne, Farben und Symbole. Ihre Einstellungen bleiben erhalten. Beschreibungen und Darstellung der Mindmaps bleiben beim Bearbeiten erhalten.",
        "Das Verbindungsfenster für Google Calendar und Tasks schließt nach erfolgreicher Verbindung. Vorübergehende Synchronisierungsfehler erklären jetzt die Ursache genauer.",
        "Website und App teilen einen verschlüsselten GENESIS-Cache. Persönliche Änderungen werden sofort gesendet. Google-Änderungen werden bei aktiver Nutzung höchstens alle 15 Minuten geprüft; ein vollständiger Abgleich erfolgt täglich. Gemeinsame Daten gelangen nur bei aktivierter Projektsynchronisierung zu Google.",
        "Google Tasks erlaubt dem gesamten GENESIS-Projekt 50.000 Anfragen täglich, gemeinsam für alle Nutzer. Ist das Kontingent erschöpft, wird die Synchronisierung nach dem täglichen Zurücksetzen um Mitternacht pazifischer Zeit innerhalb von 24 Stunden fortgesetzt. Die Google-Anmeldung verbraucht dieses Kontingent nicht.")),
    "fr" to Notes("Nouveautés", "Compris", listOf(
        "Les tâches et les habitudes ont des sons, couleurs et icônes de notification distincts. Vos préférences sont conservées. Les descriptions et la présentation des cartes sont préservées lors des modifications.",
        "La fenêtre de connexion Google Calendar et Tasks se ferme après une connexion réussie. Les erreurs temporaires de synchronisation expliquent mieux leur cause.",
        "Le site et l’application partagent un cache GENESIS chiffré. Les modifications personnelles sont envoyées immédiatement. Les changements Google sont vérifiés au plus toutes les 15 minutes pendant l’utilisation active, avec une vérification complète quotidienne. Les données partagées sont envoyées seulement si la synchronisation du projet est activée.",
        "Google Tasks autorise 50 000 requêtes par jour pour tout le projet GENESIS, partagées entre tous les utilisateurs. Si le quota est épuisé, la synchronisation reprend après la remise à zéro quotidienne à minuit, heure du Pacifique, sous 24 heures. La connexion Google ne consomme pas ce quota.")),
    "es" to Notes("Novedades", "Entendido", listOf(
        "Las tareas y los hábitos tienen sonidos, colores e iconos de notificación distintos. Se conservan tus preferencias. Las descripciones y el aspecto de los mapas se mantienen al editarlos.",
        "La ventana de conexión de Google Calendar y Tasks se cierra tras una conexión correcta. Los errores temporales de sincronización explican mejor su causa.",
        "El sitio y la aplicación comparten una caché GENESIS cifrada. Los cambios personales se envían inmediatamente. Los cambios de Google se comprueban como máximo cada 15 minutos durante el uso activo, con una revisión completa diaria. Los datos compartidos se envían solo al activar la sincronización del proyecto.",
        "Google Tasks permite 50 000 solicitudes diarias para todo GENESIS, compartidas entre todos los usuarios. Si se agotan, la sincronización se reanuda tras el reinicio diario a medianoche del Pacífico, en un plazo de 24 horas. El inicio de sesión con Google no consume esta cuota.")),
    "it" to Notes("Novità", "Ho capito", listOf(
        "Le notifiche di attività e abitudini hanno suoni, colori e icone diversi. Le preferenze vengono mantenute. Descrizioni e aspetto delle mappe vengono conservati durante le modifiche.",
        "La finestra di collegamento a Google Calendar e Tasks si chiude dopo un collegamento riuscito. Gli errori temporanei di sincronizzazione spiegano meglio la causa.",
        "Sito e app condividono una cache GENESIS cifrata. Le modifiche personali vengono inviate subito. Le modifiche Google vengono controllate al massimo ogni 15 minuti durante l’uso attivo, con una verifica completa giornaliera. I dati condivisi vengono inviati solo attivando la sincronizzazione del progetto.",
        "Google Tasks consente 50.000 richieste al giorno per tutto GENESIS, condivise fra tutti gli utenti. Se esaurite, la sincronizzazione riprende dopo il ripristino quotidiano a mezzanotte del Pacifico, entro 24 ore. L’accesso Google non consuma questa quota.")),
    "pt" to Notes("Novidades", "Entendi", listOf(
        "As notificações de tarefas e hábitos têm sons, cores e ícones diferentes. As preferências são mantidas. As descrições e a aparência dos mapas são preservadas ao editar.",
        "A janela de ligação ao Google Calendar e Tasks fecha após uma ligação bem-sucedida. Os erros temporários de sincronização explicam melhor a causa.",
        "O site e a aplicação partilham uma cache GENESIS encriptada. As alterações pessoais são enviadas imediatamente. As alterações Google são verificadas no máximo a cada 15 minutos durante a utilização ativa, com uma verificação completa diária. Os dados partilhados são enviados apenas com a sincronização do projeto ativada.",
        "O Google Tasks permite 50 000 pedidos diários para todo o GENESIS, partilhados por todos os utilizadores. Se esgotados, a sincronização retoma após a reposição diária à meia-noite do Pacífico, dentro de 24 horas. O início de sessão Google não consome esta quota.")),
    "pl" to Notes("Co nowego", "Rozumiem", listOf(
        "Powiadomienia zadań i nawyków mają różne dźwięki, kolory i ikony. Ustawienia są zachowane. Opisy i wygląd map myśli pozostają zachowane podczas edycji.",
        "Okno łączenia z Google Calendar i Tasks zamyka się po udanym połączeniu. Tymczasowe błędy synchronizacji dokładniej wyjaśniają przyczynę.",
        "Strona i aplikacja korzystają ze wspólnej szyfrowanej pamięci GENESIS. Zmiany osobiste są wysyłane od razu. Zmiany Google są sprawdzane najwyżej co 15 minut podczas aktywnego używania, z pełnym sprawdzeniem raz dziennie. Dane wspólne trafiają do Google tylko po włączeniu synchronizacji projektu.",
        "Google Tasks pozwala na 50 000 zapytań dziennie dla całego GENESIS, wspólnie dla wszystkich użytkowników. Po wyczerpaniu limitu synchronizacja wróci po codziennym resetowaniu o północy czasu pacyficznego, w ciągu 24 godzin. Logowanie Google nie zużywa tego limitu.")),
    "sr" to Notes("Шта је ново", "Разумем", listOf(
        "Обавештења за задатке и навике имају различите звукове, боје и иконе. Подешавања су сачувана. Описи и изглед мапа остају сачувани током уређивања.",
        "Прозор за повезивање Google Calendar и Tasks затвара се после успешног повезивања. Привремене грешке синхронизације сада јасније објашњавају узрок.",
        "Сајт и апликација деле шифровану GENESIS кеш меморију. Личне измене шаљу се одмах. Измене у Google-у проверавају се највише једном у 15 минута током активног коришћења, уз потпуну дневну проверу. Заједнички подаци шаљу се само када је синхронизација пројекта укључена.",
        "Google Tasks дозвољава 50 000 захтева дневно за цео GENESIS, за све кориснике заједно. Ако се квота исцрпи, синхронизација се наставља после дневног ресетовања у поноћ по пацифичком времену, у року од 24 сата. Google пријава не троши ову квоту.")),
    "uk" to Notes("Що нового", "Зрозуміло", listOf(
        "Сповіщення завдань і звичок мають різні звуки, кольори та значки. Налаштування збережено. Описи й оформлення карт зберігаються під час редагування.",
        "Вікно підключення Google Calendar і Tasks закривається після успішного підключення. Причина тимчасової помилки синхронізації тепер пояснюється точніше.",
        "Сайт і застосунок використовують спільний зашифрований кеш GENESIS. Особисті зміни надсилаються відразу. Зміни з Google перевіряються не частіше ніж раз на 15 хвилин під час активного використання; повна перевірка — щодня. Спільні справи надсилаються лише після ввімкнення синхронізації проєкту.",
        "Google Tasks обмежує весь GENESIS 50 000 запитами на добу для всіх користувачів. Після вичерпання квоти синхронізація відновиться після щоденного скидання Google опівночі за тихоокеанським часом, протягом доби. Вхід через Google не витрачає цю квоту.")),
    "zh" to Notes("本次更新", "知道了", listOf(
        "任务和习惯通知使用不同的声音、颜色和图标，并保留通知设置。编辑导图时会保留描述和外观。",
        "成功连接后，Google Calendar 和 Tasks 连接窗口会关闭。临时同步错误现在会更清楚地说明原因。",
        "网站和应用共用加密的 GENESIS 缓存。个人修改会立即发送。活跃使用期间，最多每 15 分钟检查一次 Google 修改，并每天进行一次完整核对。共享数据仅在启用项目同步后发送至 Google。",
        "Google Tasks 每天允许整个 GENESIS 项目使用 50,000 次请求，由所有网站和应用用户共享。额度耗尽后，同步会在 Google 每天太平洋时间午夜重置后恢复，等待不超过 24 小时。Google 登录不消耗此额度。")),
    "tr" to Notes("Yenilikler", "Anladım", listOf(
        "Görev ve alışkanlık bildirimleri farklı sesler, renkler ve simgeler kullanır. Bildirim tercihleri korunur. Zihin haritası açıklamaları ve görünümü düzenleme sırasında korunur.",
        "Google Calendar ve Tasks bağlantı penceresi başarılı bağlantıdan sonra kapanır. Geçici eşitleme hataları artık nedenini daha açık belirtir.",
        "Site ve uygulama şifreli GENESIS önbelleğini paylaşır. Kişisel değişiklikler hemen gönderilir. Aktif kullanım sırasında Google değişiklikleri en sık 15 dakikada bir kontrol edilir; tam kontrol günlük yapılır. Ortak veriler yalnızca proje eşitlemesi açıldığında Google’a gönderilir.",
        "Google Tasks, tüm GENESIS projesi için tüm kullanıcıların paylaştığı günlük 50.000 istek sınırına sahiptir. Kota tükenirse eşitleme, Google’ın Pasifik saatiyle gece yarısı yaptığı günlük sıfırlamadan sonra 24 saat içinde devam eder. Google girişi bu kotayı tüketmez.")),
    "ja" to Notes("今回の更新", "了解", listOf(
        "タスクと習慣の通知で異なる音、色、アイコンを使用します。通知設定は保持されます。マインドマップの説明と外観は編集時も保持されます。",
        "Google Calendar と Tasks の接続ウィンドウは、接続成功後に閉じます。一時的な同期エラーの原因をより明確に表示します。",
        "サイトとアプリは暗号化された GENESIS キャッシュを共有します。個人データの変更はすぐに送信されます。使用中は Google の変更を最短15分間隔で確認し、毎日一度すべてを照合します。共有データはプロジェクト同期を有効にした場合のみ Google に送信されます。",
        "Google Tasks の1日50,000リクエストの制限は、GENESIS 全体の全ユーザーで共有されます。上限に達した場合、太平洋時間の毎日午前0時のリセット後、24時間以内に同期が再開します。Google ログインはこの制限を消費しません。"))
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
