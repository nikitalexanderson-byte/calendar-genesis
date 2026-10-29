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
        "«Возвращение к мере»: перевёрнутая карта → миф и дополнительная помощь Теокиклоса → ресурсная буква по пифмену → сакральная привычка и тетрактис из 10 выполнений.",
        "Пауза выключает расписание и напоминания. Архив сохраняет историю и награды. Восстановление вернёт привычку на паузу. Награды и прежний штраф не изменятся.",
        "Резервная копия JSON: Включает всю историю, независимо от выбранного периода отчёта. Подключения Google не переносятся.",
        "Проценты целей и объёма рассчитываются отдельно. Сравниваются только прошедшие дни обоих периодов.",
        "Исторические исправления обновляют статистику и серии без новых XP и Лавров. Выданные награды и потраченная защита сохраняются.",
        "Для работы с новой историей обновите GENESIS на остальных устройствах.")),
    "en" to Notes("What’s new", "Got it", listOf(
        "Return to measure: reversed card → myth and extra Theokyklos support → resource letter by pythmen → sacred habit and a tetractys of 10 completions.",
        "Pause turns off scheduling and reminders. Archive keeps history and rewards. Restore returns the habit to paused. Rewards and any earlier penalty stay unchanged.",
        "JSON backup: Includes the full history, regardless of the selected report period. Google connections are not transferred.",
        "Goal and volume percentages are calculated separately. Only elapsed days in both periods are compared.",
        "Historical corrections update statistics and streaks without new XP or Laurels. Existing rewards and spent protection are retained.",
        "Update GENESIS on your other devices to work with the new history.")),
    "el" to Notes("Τι νέο υπάρχει", "Κατάλαβα", listOf(
        "«Επιστροφή στο μέτρο»: ανεστραμμένη κάρτα → μύθος και πρόσθετη στήριξη του Θεόκυκλου → γράμμα βάσει του πυθμένα → ιερή συνήθεια και τετρακτύς 10 εκτελέσεων.",
        "Η παύση απενεργοποιεί το πρόγραμμα και τις υπενθυμίσεις. Η αρχειοθέτηση διατηρεί ιστορικό και ανταμοιβές. Η επαναφορά θέτει τη συνήθεια σε παύση. Ανταμοιβές και προηγούμενες ποινές δεν αλλάζουν.",
        "Αντίγραφο ασφαλείας JSON: Περιλαμβάνει όλο το ιστορικό, ανεξάρτητα από την επιλεγμένη περίοδο αναφοράς. Οι συνδέσεις Google δεν μεταφέρονται.",
        "Τα ποσοστά στόχων και όγκου υπολογίζονται χωριστά. Συγκρίνονται μόνο οι ημέρες που έχουν περάσει και στις δύο περιόδους.",
        "Οι διορθώσεις ιστορικού ενημερώνουν στατιστικά και σερί χωρίς νέους πόντους εμπειρίας ή Δάφνες. Οι υπάρχουσες ανταμοιβές και η χρησιμοποιημένη προστασία διατηρούνται.",
        "Ενημερώστε το GENESIS στις άλλες συσκευές σας για να χρησιμοποιήσετε το νέο ιστορικό.")),
    "de" to Notes("Was ist neu", "Verstanden", listOf(
        "Rückkehr zum Maß: umgekehrte Karte → Mythos und zusätzliche Hilfe im Theokyklos → unterstützender Buchstabe nach Pythmen → heilige Gewohnheit und Tetraktys mit 10 Ausführungen.",
        "Eine Pause deaktiviert Zeitplan und Erinnerungen. Das Archiv bewahrt Verlauf und Belohnungen. Die Wiederherstellung pausiert die Gewohnheit. Belohnungen und frühere Abzüge bleiben unverändert.",
        "JSON-Sicherung: Enthält den gesamten Verlauf, unabhängig vom ausgewählten Berichtszeitraum. Google-Verbindungen werden nicht übertragen.",
        "Zielquote und Mengenanteil werden getrennt berechnet. Verglichen werden nur die bereits vergangenen Tage beider Zeiträume.",
        "Verlaufskorrekturen ändern Statistiken und Serien ohne neue XP oder Lorbeeren. Bestehende Belohnungen und verbrauchter Schutz bleiben erhalten.",
        "Aktualisiere GENESIS auf deinen anderen Geräten, um den neuen Verlauf zu nutzen.")),
    "fr" to Notes("Nouveautés", "Compris", listOf(
        "Retour à la juste mesure : carte renversée → mythe et soutien complémentaire du Théokyklos → lettre ressource selon le pythmen → habitude sacrée et tétraktys de 10 réalisations.",
        "La pause désactive le planning et les rappels. L’archivage conserve l’historique et les récompenses. La restauration remet l’habitude en pause. Les récompenses et les pénalités antérieures restent inchangées.",
        "Sauvegarde JSON: Inclut tout l’historique, quelle que soit la période sélectionnée pour le rapport. Les connexions Google ne sont pas transférées.",
        "Les pourcentages d’objectifs et de volume sont calculés séparément. Seuls les jours écoulés des deux périodes sont comparés.",
        "Les corrections mettent à jour les statistiques et les séries sans nouveaux XP ni Lauriers. Les récompenses acquises et la protection utilisée sont conservées.",
        "Mettez GENESIS à jour sur vos autres appareils pour utiliser le nouvel historique.")),
    "es" to Notes("Novedades", "Entendido", listOf(
        "Volver a la medida: carta invertida → mito y apoyo adicional del Teokyklos → letra de apoyo según el pifmen → hábito sagrado y tetraktys de 10 realizaciones.",
        "La pausa desactiva el calendario y los recordatorios. El archivo conserva el historial y las recompensas. La restauración deja el hábito en pausa. Las recompensas y penalizaciones anteriores no cambian.",
        "Copia de seguridad JSON: Incluye todo el historial, independientemente del período seleccionado para el informe. Las conexiones con Google no se transfieren.",
        "Los porcentajes de objetivos y de volumen se calculan por separado. Solo se comparan los días transcurridos de ambos períodos.",
        "Las correcciones actualizan las estadísticas y las rachas sin nuevos XP ni Laureles. Se conservan las recompensas existentes y la protección utilizada.",
        "Actualiza GENESIS en tus otros dispositivos para utilizar el nuevo historial.")),
    "it" to Notes("Novità", "Ho capito", listOf(
        "Ritorno alla misura: carta rovesciata → mito e sostegno aggiuntivo del Teokyklos → lettera di sostegno secondo il pythmen → abitudine sacra e tetraktys di 10 esecuzioni.",
        "La pausa disattiva programma e promemoria. L’archivio conserva cronologia e ricompense. Il ripristino mette l’abitudine in pausa. Ricompense e penalità precedenti restano invariate.",
        "Backup JSON: Include tutta la cronologia, indipendentemente dal periodo selezionato nel rapporto. I collegamenti Google non vengono trasferiti.",
        "Le percentuali degli obiettivi e del volume sono calcolate separatamente. Si confrontano solo i giorni trascorsi di entrambi i periodi.",
        "Le correzioni aggiornano statistiche e serie senza nuovi XP o Allori. I premi esistenti e la protezione utilizzata vengono mantenuti.",
        "Aggiorna GENESIS sugli altri dispositivi per utilizzare la nuova cronologia.")),
    "pt" to Notes("Novidades", "Entendi", listOf(
        "Regresso à medida: carta invertida → mito e apoio adicional do Teokyklos → letra de apoio segundo o pythmen → hábito sagrado e tetraktys de 10 realizações.",
        "A pausa desativa o agendamento e os lembretes. O arquivo preserva o histórico e as recompensas. A restauração deixa o hábito em pausa. As recompensas e penalizações anteriores não mudam.",
        "Cópia de segurança JSON: Inclui todo o histórico, independentemente do período selecionado no relatório. As ligações ao Google não são transferidas.",
        "As percentagens de objetivos e de volume são calculadas separadamente. São comparados apenas os dias decorridos de ambos os períodos.",
        "As correções atualizam estatísticas e sequências sem novos XP ou Louros. As recompensas existentes e a proteção utilizada são mantidas.",
        "Atualize o GENESIS nos outros dispositivos para utilizar o novo histórico.")),
    "pl" to Notes("Co nowego", "Rozumiem", listOf(
        "Powrót do miary: odwrócona karta → mit i dodatkowe wsparcie Teokyklosu → litera wsparcia według pytmenu → sakralny nawyk i tetraktys z 10 wykonań.",
        "Pauza wyłącza harmonogram i przypomnienia. Archiwum zachowuje historię i nagrody. Przywrócenie wstrzyma nawyk. Nagrody i wcześniejsze kary nie zmienią się.",
        "Kopia zapasowa JSON: Obejmuje całą historię niezależnie od wybranego okresu raportu. Połączenia z Google nie są przenoszone.",
        "Odsetek celów i procent objętości są obliczane osobno. Porównywane są tylko dni, które upłynęły w obu okresach.",
        "Korekty aktualizują statystyki i serie bez nowych XP ani Laurów. Zdobyte nagrody i zużyta ochrona pozostają bez zmian.",
        "Zaktualizuj GENESIS na pozostałych urządzeniach, aby korzystać z nowej historii.")),
    "sr" to Notes("Шта је ново", "Разумем", listOf(
        "Повратак мери: обрнута карта → мит и додатна помоћ Теокиклоса → слово подршке према питмену → сакрална навика и тетрактис од 10 извршења.",
        "Пауза искључује распоред и подсетнике. Архива чува историју и награде. Враћање ставља навику на паузу. Награде и раније казне остају непромењене.",
        "Резервна копија JSON: Обухвата целу историју, без обзира на изабрани период извештаја. Везе са Google се не преносе.",
        "Проценти циљева и обима рачунају се засебно. Пореде се само протекли дани оба периода.",
        "Исправке ажурирају статистику и низове без нових XP или Ловорика. Постојеће награде и потрошена заштита се чувају.",
        "Ажурирајте GENESIS на осталим уређајима да бисте користили нову историју.")),
    "uk" to Notes("Що нового", "Зрозуміло", listOf(
        "«Повернення до міри»: перевернута карта → міф і додаткова допомога Теокіклоса → ресурсна літера за піфменом → сакральна звичка й тетрактис із 10 виконань.",
        "Пауза вимикає розклад і нагадування. Архів зберігає історію та нагороди. Відновлення поверне звичку на паузу. Нагороди та попередній штраф не зміняться.",
        "Резервна копія JSON: Містить усю історію, незалежно від вибраного періоду звіту. Підключення Google не переносяться.",
        "Відсотки цілей та обсягу розраховуються окремо. Порівнюються лише дні обох періодів, що вже минули.",
        "Історичні виправлення оновлюють статистику та серії без нових XP і Лаврів. Видані нагороди та витрачений захист зберігаються.",
        "Оновіть GENESIS на інших пристроях для роботи з новою історією.")),
    "zh" to Notes("本次更新", "知道了", listOf(
        "回归适度：逆位牌 → 神话与 Theokyklos 的额外支持 → 按数根选择助力字母 → 神圣习惯与完成 10 次的四重数周期。",
        "暂停会关闭计划和提醒。归档会保留历史记录和奖励。 恢复后习惯将处于暂停状态。奖励和之前的扣罚不会改变。",
        "JSON 备份: 包括全部历史记录，不受所选报告时段限制。 不会转移 Google 连接。",
        "目标完成率和数量达成率分开计算。 仅比较两个时段中已经过去的天数。",
        "历史更正会更新统计和连续记录，不会新增 XP 或月桂奖励。已有奖励和已使用的保护保持不变。",
        "请在其他设备上更新 GENESIS，以使用新的历史记录。")),
    "tr" to Notes("Yenilikler", "Anladım", listOf(
        "Ölçüye dönüş: ters kart → mit ve ek Teokyklos desteği → pitmene göre destek harfi → kutsal alışkanlık ve 10 tamamlamalık tetraktis.",
        "Duraklatma, programı ve hatırlatıcıları kapatır. Arşiv, geçmişi ve ödülleri korur. Geri yükleme alışkanlığı duraklatır. Ödüller ve önceki cezalar değişmez.",
        "JSON yedeği: Seçilen rapor döneminden bağımsız olarak tüm geçmişi içerir. Google bağlantıları aktarılmaz.",
        "Hedef ve miktar yüzdeleri ayrı hesaplanır. Yalnızca her iki dönemin geçmiş günleri karşılaştırılır.",
        "Geçmiş düzeltmeleri yeni XP veya Defne vermeden istatistikleri ve serileri günceller. Mevcut ödüller ve kullanılmış koruma korunur.",
        "Yeni geçmişi kullanmak için diğer cihazlarınızdaki GENESIS’i güncelleyin.")),
    "ja" to Notes("今回の更新", "了解", listOf(
        "節度への回帰：逆位置のカード → 神話とテオキュクロスの補助 → ピュトメンに合う助けの文字 → 聖なる習慣と10回の実践によるテトラクテュス。",
        "一時停止すると予定とリマインダーが無効になります。アーカイブは履歴と報酬を保持します。 復元後、習慣は一時停止状態になります。報酬と以前のペナルティは変わりません。",
        "JSON バックアップ: 選択したレポート期間に関係なく、全履歴を含みます。 Google の接続は引き継がれません。",
        "目標の達成率と量の達成率は別に計算します。 両方の期間で、すでに経過した日だけを比較します。",
        "履歴の修正は新しいXPや月桂を付与せず、統計と連続記録を更新します。獲得済みの報酬と使用済みの保護は保持されます。",
        "新しい履歴を使用するには、ほかの端末のGENESISも更新してください。"))
)

@Composable
internal fun releaseNotesTitle(): String = notes[LocalGenesisLanguage.current]?.title ?: notes.getValue("ru").title

@Composable
internal fun ReleaseNotesDialog(onDismiss: () -> Unit) {
    val copy = (notes[LocalGenesisLanguage.current] ?: notes.getValue("ru")).copy(changes = release311Changes[LocalGenesisLanguage.current] ?: release311Changes.getValue("ru"))
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

private val release311Changes = mapOf(
    "ru" to listOf(
        "Советом можно поделиться картинкой с иллюстрацией, полным текстом и ссылкой на приложение.",
        "Переписки, календари и майндмепы стали удобнее: компактные действия, светлые подложки и меню карты.",
        "Исправлены переносы задач и списков, отмена связей и открытие месяца из годового вида.",
        "Обновления проверяются без входа. Статус отсутствия сети перенесён в боковую панель."),
    "en" to listOf(
        "Share advice as an image with its artwork, full text and an app link.",
        "Chats, calendars and mind maps have clearer actions, light surfaces and map menus.",
        "Fixed task and list moves, cancelling connections and opening months from the year view.",
        "Check for updates without signing in. Offline status is now in the sidebar."),
    "de" to listOf(
        "Ratschläge als Bild mit Illustration, vollständigem Text und App-Link teilen.",
        "Chats, Kalender und Mindmaps bieten übersichtlichere Aktionen, helle Flächen und Kartenmenüs.",
        "Aufgaben und Listen verschieben, Verbindungen abbrechen und Monate aus der Jahresansicht öffnen: Fehler behoben.",
        "Updates ohne Anmeldung prüfen. Der Offline-Status steht jetzt in der Seitenleiste."),
    "el" to listOf(
        "Μοιραστείτε συμβουλές ως εικόνα με εικονογράφηση, πλήρες κείμενο και σύνδεσμο εφαρμογής.",
        "Συνομιλίες, ημερολόγια και νοητικοί χάρτες με σαφέστερες ενέργειες, φωτεινά πλαίσια και μενού χάρτη.",
        "Διορθώθηκαν οι μετακινήσεις εργασιών και λιστών, η ακύρωση συνδέσεων και το άνοιγμα μήνα από την προβολή έτους.",
        "Έλεγχος ενημερώσεων χωρίς σύνδεση. Η κατάσταση εκτός δικτύου βρίσκεται στην πλαϊνή στήλη."),
    "es" to listOf(
        "Comparte consejos como imagen con ilustración, texto completo y enlace a la aplicación.",
        "Chats, calendarios y mapas mentales con acciones más claras, superficies claras y menús del mapa.",
        "Corregidos los movimientos de tareas y listas, la cancelación de conexiones y la apertura de meses desde la vista anual.",
        "Busca actualizaciones sin iniciar sesión. El estado sin conexión está en la barra lateral."),
    "fr" to listOf(
        "Partagez un conseil en image avec son illustration, le texte intégral et un lien vers l’application.",
        "Discussions, calendriers et cartes mentales : actions plus claires, surfaces claires et menus de carte.",
        "Déplacement des tâches et listes, annulation des liens et ouverture des mois depuis la vue annuelle corrigés.",
        "Vérifiez les mises à jour sans connexion au compte. L’état hors ligne apparaît dans la barre latérale."),
    "it" to listOf(
        "Condividi consigli come immagini con illustrazione, testo completo e link all’app.",
        "Chat, calendari e mappe mentali con azioni più chiare, superfici chiare e menu della mappa.",
        "Corretti gli spostamenti di attività ed elenchi, l’annullamento dei collegamenti e l’apertura dei mesi dalla vista annuale.",
        "Controlla gli aggiornamenti senza accedere. Lo stato offline è nella barra laterale."),
    "ja" to listOf(
        "イラスト、全文、アプリへのリンクを含む画像でアドバイスを共有できます。",
        "チャット、カレンダー、マインドマップの操作、明るい背景、マップメニューを改善しました。",
        "タスクとリストの移動、接続のキャンセル、年表示から月を開く動作を修正しました。",
        "ログインせずに更新を確認できます。オフライン状態はサイドバーに表示されます。"),
    "pl" to listOf(
        "Udostępniaj porady jako obraz z ilustracją, pełnym tekstem i linkiem do aplikacji.",
        "Czaty, kalendarze i mapy myśli mają czytelniejsze działania, jasne tła i menu mapy.",
        "Poprawiono przenoszenie zadań i list, anulowanie połączeń i otwieranie miesięcy z widoku roku.",
        "Sprawdzaj aktualizacje bez logowania. Stan offline jest teraz w panelu bocznym."),
    "pt" to listOf(
        "Partilhe conselhos como imagem com ilustração, texto completo e ligação à aplicação.",
        "Conversas, calendários e mapas mentais com ações mais claras, superfícies claras e menus do mapa.",
        "Corrigidos movimentos de tarefas e listas, cancelamento de ligações e abertura de meses na vista anual.",
        "Verifique atualizações sem iniciar sessão. O estado offline está na barra lateral."),
    "sr" to listOf(
        "Поделите савет као слику са илустрацијом, целим текстом и везом ка апликацији.",
        "Преписке, календари и мапе ума имају прегледније радње, светле подлоге и меније мапе.",
        "Исправљени су премештање задатака и листа, отказивање веза и отварање месеца из годишњег приказа.",
        "Провера ажурирања без пријаве. Статус без мреже је у бочном панелу."),
    "uk" to listOf(
        "Діліться порадою як зображенням з ілюстрацією, повним текстом і посиланням на застосунок.",
        "Листування, календарі та мапи думок мають зручніші дії, світлі підкладки й меню мапи.",
        "Виправлено перенесення завдань і списків, скасування зв’язків та відкриття місяця з річного вигляду.",
        "Перевірка оновлень без входу. Статус відсутності мережі перенесено до бічної панелі."),
    "zh" to listOf(
        "将建议分享为包含插图、全文和应用链接的图片。",
        "聊天、日历和思维导图改进了操作、浅色背景和导图菜单。",
        "修复了任务和列表移动、取消连线以及从年视图打开月份的问题。",
        "无需登录即可检查更新。离线状态现显示在侧边栏中。"),
    "tr" to listOf(
        "Önerileri çizim, tam metin ve uygulama bağlantısı içeren görseller olarak paylaşın.",
        "Sohbetler, takvimler ve zihin haritalarında daha anlaşılır işlemler, açık yüzeyler ve harita menüleri.",
        "Görev ve liste taşıma, bağlantı iptali ve yıl görünümünden ay açma düzeltildi.",
        "Oturum açmadan güncellemeleri kontrol edin. Çevrimdışı durumu yan panelde.")
)
