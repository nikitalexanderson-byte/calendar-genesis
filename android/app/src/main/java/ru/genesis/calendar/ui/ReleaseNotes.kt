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
        "«Сегодня» показывает личные и общие задачи отдельными списками.",
        "На «Сегодня» доступны настроение, сон и воздержание вместе с привычками.",
        "Улучшена устойчивость переноса задач между общими досками.",
        "Иллюстрации календарей крупнее, с плавным переходом и более яркой светлой темой.",
        "Период центрирован между стрелками. «Сегодня» находится справа сверху в месяце и убрано из года.",
        "Обновлены панель майндмепов, меню экспорта и расположение кнопок сообщений и обновления.")),
    "en" to Notes("What’s new", "Got it", listOf(
        "Today shows personal and shared tasks in separate lists.",
        "Today includes mood, sleep and abstinence alongside habits.",
        "Improved task dragging stability between shared boards.",
        "Calendar artwork is larger, with smooth fades and a brighter light theme.",
        "The period is centered between the arrows. Today is at the top right in month view and removed from year view.",
        "Updated mindmap toolbar, export menu, and the placement of chat and update buttons.")),
    "el" to Notes("Τι νέο υπάρχει", "Κατάλαβα", listOf(
        "Η σημερινή προβολή εμφανίζει προσωπικές και κοινές εργασίες σε χωριστές λίστες.",
        "Η σημερινή προβολή περιλαμβάνει διάθεση, ύπνο και αποχή μαζί με τις συνήθειες.",
        "Βελτιώθηκε η σταθερότητα της μεταφοράς εργασιών μεταξύ κοινών πινάκων.",
        "Οι εικόνες των ημερολογίων είναι μεγαλύτερες, με ομαλές μεταβάσεις και φωτεινότερο ανοιχτό θέμα.",
        "Η περίοδος κεντράρεται ανάμεσα στα βέλη. Η μετάβαση στο σήμερα βρίσκεται πάνω δεξιά στον μήνα και αφαιρέθηκε από το έτος.",
        "Ενημερώθηκαν η γραμμή εργαλείων νοητικών χαρτών, το μενού εξαγωγής και οι θέσεις των κουμπιών συνομιλίας και ενημέρωσης.")),
    "de" to Notes("Was ist neu", "Verstanden", listOf(
        "Heute zeigt persönliche und gemeinsame Aufgaben in getrennten Listen.",
        "Heute enthält Stimmung, Schlaf und Abstinenz neben den Gewohnheiten.",
        "Das Ziehen von Aufgaben zwischen gemeinsamen Boards ist stabiler.",
        "Kalenderbilder sind größer, mit sanften Übergängen und hellerem Tagmodus.",
        "Der Zeitraum steht mittig zwischen den Pfeilen. Heute steht im Monat oben rechts und entfällt in der Jahresansicht.",
        "Mindmap-Leiste, Exportmenü sowie die Position der Chat- und Aktualisierungsschaltflächen wurden überarbeitet.")),
    "fr" to Notes("Nouveautés", "Compris", listOf(
        "Aujourd’hui affiche les tâches personnelles et partagées dans des listes séparées.",
        "Aujourd’hui inclut l’humeur, le sommeil et l’abstinence aux côtés des habitudes.",
        "Le déplacement des tâches entre tableaux partagés est plus stable.",
        "Les illustrations des calendriers sont plus grandes, avec des transitions douces et un thème clair plus lumineux.",
        "La période est centrée entre les flèches. Aujourd’hui est en haut à droite du mois et retiré de la vue annuelle.",
        "La barre des cartes mentales, le menu d’export et la position des boutons de discussion et de mise à jour ont été revus.")),
    "es" to Notes("Novedades", "Entendido", listOf(
        "Hoy muestra las tareas personales y compartidas en listas separadas.",
        "Hoy incluye estado de ánimo, sueño y abstinencia junto con los hábitos.",
        "El arrastre de tareas entre tableros compartidos es más estable.",
        "Las ilustraciones de los calendarios son más grandes, con transiciones suaves y un tema claro más luminoso.",
        "El período está centrado entre las flechas. Hoy está arriba a la derecha en el mes y se ha quitado de la vista anual.",
        "Se han actualizado la barra de mapas mentales, el menú de exportación y la posición de los botones de chat y actualización.")),
    "it" to Notes("Novità", "Ho capito", listOf(
        "Oggi mostra le attività personali e condivise in elenchi separati.",
        "Oggi include umore, sonno e astinenza insieme alle abitudini.",
        "Il trascinamento delle attività tra bacheche condivise è più stabile.",
        "Le illustrazioni dei calendari sono più grandi, con transizioni morbide e un tema chiaro più luminoso.",
        "Il periodo è centrato tra le frecce. Oggi è in alto a destra nel mese ed è stato rimosso dalla vista annuale.",
        "Aggiornati la barra delle mappe mentali, il menu di esportazione e la posizione dei pulsanti di chat e aggiornamento.")),
    "pt" to Notes("Novidades", "Entendi", listOf(
        "Hoje apresenta tarefas pessoais e partilhadas em listas separadas.",
        "Hoje inclui humor, sono e abstinência juntamente com os hábitos.",
        "O arrastamento de tarefas entre quadros partilhados está mais estável.",
        "As ilustrações dos calendários são maiores, com transições suaves e um tema claro mais luminoso.",
        "O período está centrado entre as setas. Hoje fica no canto superior direito do mês e foi removido da vista anual.",
        "Atualizados a barra de mapas mentais, o menu de exportação e a posição dos botões de conversa e atualização.")),
    "pl" to Notes("Co nowego", "Rozumiem", listOf(
        "Dzisiaj pokazuje zadania osobiste i wspólne na oddzielnych listach.",
        "Dzisiaj obejmuje nastrój, sen i abstynencję obok nawyków.",
        "Poprawiono stabilność przeciągania zadań między wspólnymi tablicami.",
        "Ilustracje kalendarzy są większe, z płynnymi przejściami i jaśniejszym motywem dziennym.",
        "Okres jest wyśrodkowany między strzałkami. Dzisiaj jest w prawym górnym rogu miesiąca i znika z widoku roku.",
        "Zaktualizowano pasek map myśli, menu eksportu oraz położenie przycisków czatu i aktualizacji.")),
    "sr" to Notes("Шта је ново", "Разумем", listOf(
        "Данас приказује личне и заједничке задатке у одвојеним листама.",
        "Данас обухвата расположење, сан и уздржавање уз навике.",
        "Побољшана је стабилност превлачења задатака између заједничких табли.",
        "Илустрације календара су веће, са благим прелазима и светлијом дневном темом.",
        "Период је центриран између стрелица. Данас је горе десно у месецу и уклоњено из годишњег приказа.",
        "Ажурирани су трака мапа ума, мени извоза и положај дугмади за ћаскање и ажурирање.")),
    "uk" to Notes("Що нового", "Зрозуміло", listOf(
        "Сьогодні показує особисті та спільні завдання окремими списками.",
        "Сьогодні містить настрій, сон і утримання разом зі звичками.",
        "Покращено стабільність перетягування завдань між спільними дошками.",
        "Ілюстрації календарів більші, з плавними переходами та яскравішою світлою темою.",
        "Період центровано між стрілками. Сьогодні розташовано вгорі праворуч у місяці та прибрано з року.",
        "Оновлено панель мап думок, меню експорту та розташування кнопок чату й оновлення.")),
    "zh" to Notes("本次更新", "知道了", listOf(
        "“今天”将个人任务和共享任务分开显示。",
        "“今天”在习惯之外新增心情、睡眠和戒除记录。",
        "提高了共享看板之间拖动任务的稳定性。",
        "日历插图更大，过渡更平滑，浅色主题更明亮。",
        "时期标题在箭头之间居中。“今天”移至月视图右上角，并从年视图移除。",
        "更新了思维导图工具栏、导出菜单以及聊天和更新按钮的位置。")),
    "tr" to Notes("Yenilikler", "Anladım", listOf(
        "Bugün, kişisel ve paylaşılan görevleri ayrı listelerde gösterir.",
        "Bugün, alışkanlıklarla birlikte ruh hâli, uyku ve uzak durma takibini içerir.",
        "Paylaşılan panolar arasında görev sürükleme kararlılığı iyileştirildi.",
        "Takvim görselleri büyütüldü; geçişler yumuşatıldı ve açık tema daha aydınlık hâle getirildi.",
        "Dönem, okların arasında ortalandı. Bugün ay görünümünde sağ üste taşındı ve yıl görünümünden kaldırıldı.",
        "Zihin haritası araç çubuğu, dışa aktarma menüsü, sohbet ve güncelleme düğmelerinin yerleşimi yenilendi.")),
    "ja" to Notes("今回の更新", "了解", listOf(
        "「今日」では個人タスクと共有タスクを別々の一覧で表示します。",
        "「今日」に習慣に加えて気分、睡眠、禁欲の記録を追加しました。",
        "共有ボード間でタスクをドラッグする際の安定性を向上しました。",
        "カレンダーの画像を拡大し、境界を滑らかにしてライトテーマを明るくしました。",
        "期間の表示を矢印の間で中央揃えにしました。「今日」は月表示の右上に移動し、年表示から削除しました。",
        "マインドマップのツールバー、エクスポートメニュー、チャットと更新ボタンの配置を改善しました。"))
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
