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
        "Историю привычек можно исправлять за прошлые дни: значения, качество и заметки сохраняются вместе с журналом правок. Перед записью показывается результат изменения.",
        "Исторические исправления обновляют статистику и серии без новых XP и Лавров. Выданные награды и потраченная защита сохраняются.",
        "Напоминания открывают исходную привычку и дату, поддерживают быстрые действия и откладывание. Фоновый канал браузера включается отдельно.",
        "Исправления сохраняются офлайн. Одновременные изменения разных клиентов требуют явного выбора результата.",
        "Для работы с новой историей обновите GENESIS на остальных устройствах.")),
    "en" to Notes("What’s new", "Got it", listOf(
        "Habit history supports past-day corrections with values, quality, notes and an edit journal. Changes are previewed before saving.",
        "Historical corrections update statistics and streaks without new XP or Laurels. Existing rewards and spent protection are retained.",
        "Reminders open the original habit and day, with quick actions and snooze. Browser background reminders have a separate opt-in.",
        "Corrections can be saved offline. Simultaneous edits from different clients require an explicit choice of result.",
        "Update GENESIS on your other devices to work with the new history.")),
    "el" to Notes("Τι νέο υπάρχει", "Κατάλαβα", listOf(
        "Το ιστορικό συνηθειών επιτρέπει διορθώσεις προηγούμενων ημερών με τιμές, ποιότητα, σημειώσεις και αρχείο αλλαγών. Το αποτέλεσμα εμφανίζεται πριν από την αποθήκευση.",
        "Οι διορθώσεις ιστορικού ενημερώνουν στατιστικά και σερί χωρίς νέους πόντους εμπειρίας ή Δάφνες. Οι υπάρχουσες ανταμοιβές και η χρησιμοποιημένη προστασία διατηρούνται.",
        "Οι υπενθυμίσεις ανοίγουν την αρχική συνήθεια και ημέρα, με γρήγορες ενέργειες και αναβολή. Οι ειδοποιήσεις παρασκηνίου του προγράμματος περιήγησης ενεργοποιούνται ξεχωριστά.",
        "Οι διορθώσεις αποθηκεύονται χωρίς σύνδεση. Οι ταυτόχρονες αλλαγές από διαφορετικές εφαρμογές απαιτούν ρητή επιλογή αποτελέσματος.",
        "Ενημερώστε το GENESIS στις άλλες συσκευές σας για να χρησιμοποιήσετε το νέο ιστορικό.")),
    "de" to Notes("Was ist neu", "Verstanden", listOf(
        "Der Gewohnheitsverlauf unterstützt Korrekturen vergangener Tage mit Werten, Qualität, Notizen und Änderungsprotokoll. Vor dem Speichern erscheint eine Vorschau.",
        "Verlaufskorrekturen ändern Statistiken und Serien ohne neue XP oder Lorbeeren. Bestehende Belohnungen und verbrauchter Schutz bleiben erhalten.",
        "Erinnerungen öffnen die ursprüngliche Gewohnheit und den Tag, mit Schnellaktionen und Schlummerfunktion. Browser-Hintergrunderinnerungen werden separat aktiviert.",
        "Korrekturen können offline gespeichert werden. Gleichzeitige Änderungen verschiedener Clients erfordern eine ausdrückliche Auswahl des Ergebnisses.",
        "Aktualisiere GENESIS auf deinen anderen Geräten, um den neuen Verlauf zu nutzen.")),
    "fr" to Notes("Nouveautés", "Compris", listOf(
        "L’historique des habitudes permet de corriger les jours passés avec valeurs, qualité, notes et journal des modifications. Un aperçu précède l’enregistrement.",
        "Les corrections mettent à jour les statistiques et les séries sans nouveaux XP ni Lauriers. Les récompenses acquises et la protection utilisée sont conservées.",
        "Les rappels ouvrent l’habitude et le jour d’origine, avec actions rapides et report. Les rappels du navigateur en arrière-plan s’activent séparément.",
        "Les corrections peuvent être enregistrées hors ligne. Les modifications simultanées de plusieurs clients nécessitent un choix explicite du résultat.",
        "Mettez GENESIS à jour sur vos autres appareils pour utiliser le nouvel historique.")),
    "es" to Notes("Novedades", "Entendido", listOf(
        "El historial de hábitos permite corregir días pasados con valores, calidad, notas y un registro de cambios. Se muestra una vista previa antes de guardar.",
        "Las correcciones actualizan las estadísticas y las rachas sin nuevos XP ni Laureles. Se conservan las recompensas existentes y la protección utilizada.",
        "Los recordatorios abren el hábito y el día originales, con acciones rápidas y la opción de posponer. Los recordatorios del navegador en segundo plano se activan por separado.",
        "Las correcciones se pueden guardar sin conexión. Los cambios simultáneos de distintos clientes requieren elegir explícitamente el resultado.",
        "Actualiza GENESIS en tus otros dispositivos para utilizar el nuevo historial.")),
    "it" to Notes("Novità", "Ho capito", listOf(
        "La cronologia delle abitudini permette di correggere i giorni passati con valori, qualità, note e un registro delle modifiche. Le modifiche vengono mostrate prima del salvataggio.",
        "Le correzioni aggiornano statistiche e serie senza nuovi XP o Allori. I premi esistenti e la protezione utilizzata vengono mantenuti.",
        "I promemoria aprono l’abitudine e il giorno originali, con azioni rapide e rinvio. I promemoria in background del browser si attivano separatamente.",
        "Le correzioni possono essere salvate offline. Le modifiche simultanee di client diversi richiedono una scelta esplicita del risultato.",
        "Aggiorna GENESIS sugli altri dispositivi per utilizzare la nuova cronologia.")),
    "pt" to Notes("Novidades", "Entendi", listOf(
        "O histórico de hábitos permite corrigir dias anteriores com valores, qualidade, notas e um registo de alterações. As mudanças são apresentadas antes de guardar.",
        "As correções atualizam estatísticas e sequências sem novos XP ou Louros. As recompensas existentes e a proteção utilizada são mantidas.",
        "Os lembretes abrem o hábito e o dia originais, com ações rápidas e adiamento. Os lembretes em segundo plano do navegador são ativados separadamente.",
        "As correções podem ser guardadas sem ligação à Internet. Alterações simultâneas de clientes diferentes exigem uma escolha explícita do resultado.",
        "Atualize o GENESIS nos outros dispositivos para utilizar o novo histórico.")),
    "pl" to Notes("Co nowego", "Rozumiem", listOf(
        "Historia nawyków umożliwia poprawianie minionych dni z wartościami, jakością, notatkami i dziennikiem zmian. Przed zapisem wyświetlany jest podgląd.",
        "Korekty aktualizują statystyki i serie bez nowych XP ani Laurów. Zdobyte nagrody i zużyta ochrona pozostają bez zmian.",
        "Przypomnienia otwierają pierwotny nawyk i dzień, z szybkimi działaniami i odraczaniem. Przypomnienia przeglądarki w tle włącza się osobno.",
        "Korekty można zapisywać offline. Jednoczesne zmiany różnych klientów wymagają jawnego wyboru wyniku.",
        "Zaktualizuj GENESIS na pozostałych urządzeniach, aby korzystać z nowej historii.")),
    "sr" to Notes("Шта је ново", "Разумем", listOf(
        "Историја навика омогућава исправке претходних дана са вредностима, квалитетом, белешкама и дневником измена. Пре чувања приказује се преглед.",
        "Исправке ажурирају статистику и низове без нових XP или Ловорика. Постојеће награде и потрошена заштита се чувају.",
        "Подсетници отварају изворну навику и дан, уз брзе радње и одлагање. Позадински подсетници прегледача укључују се посебно.",
        "Исправке се могу сачувати без интернета. Истовремене измене различитих клијената захтевају изричит избор резултата.",
        "Ажурирајте GENESIS на осталим уређајима да бисте користили нову историју.")),
    "uk" to Notes("Що нового", "Зрозуміло", listOf(
        "Історія звичок підтримує виправлення минулих днів зі значеннями, якістю, нотатками та журналом змін. Перед збереженням показується попередній перегляд.",
        "Історичні виправлення оновлюють статистику та серії без нових XP і Лаврів. Видані нагороди та витрачений захист зберігаються.",
        "Нагадування відкривають початкову звичку й дату, підтримують швидкі дії та відкладення. Фонові нагадування браузера вмикаються окремо.",
        "Виправлення зберігаються офлайн. Одночасні зміни різних клієнтів потребують явного вибору результату.",
        "Оновіть GENESIS на інших пристроях для роботи з новою історією.")),
    "zh" to Notes("本次更新", "知道了", listOf(
        "习惯历史支持更正过去日期的数值、质量和备注，并保留修改记录。保存前会显示更改预览。",
        "历史更正会更新统计和连续记录，不会新增 XP 或月桂奖励。已有奖励和已使用的保护保持不变。",
        "提醒会打开原来的习惯和日期，支持快捷操作和稍后提醒。浏览器后台提醒需要单独启用。",
        "更正可离线保存。不同客户端同时修改时，需要明确选择最终结果。",
        "请在其他设备上更新 GENESIS，以使用新的历史记录。")),
    "tr" to Notes("Yenilikler", "Anladım", listOf(
        "Alışkanlık geçmişinde eski günlerin değerleri, kalitesi ve notları düzeltilebilir; değişiklik günlüğü korunur. Kaydetmeden önce önizleme gösterilir.",
        "Geçmiş düzeltmeleri yeni XP veya Defne vermeden istatistikleri ve serileri günceller. Mevcut ödüller ve kullanılmış koruma korunur.",
        "Hatırlatıcılar özgün alışkanlığı ve günü açar; hızlı işlemler ve erteleme sunar. Tarayıcı arka plan hatırlatıcıları ayrıca etkinleştirilir.",
        "Düzeltmeler çevrimdışı kaydedilebilir. Farklı istemcilerdeki eşzamanlı değişiklikler için sonuç açıkça seçilir.",
        "Yeni geçmişi kullanmak için diğer cihazlarınızdaki GENESIS’i güncelleyin.")),
    "ja" to Notes("今回の更新", "了解", listOf(
        "習慣の履歴では、過去の日付の値、品質、メモを修正し、変更履歴を残せます。保存前に変更内容を確認できます。",
        "履歴の修正は新しいXPや月桂を付与せず、統計と連続記録を更新します。獲得済みの報酬と使用済みの保護は保持されます。",
        "リマインダーは元の習慣と日付を開き、クイック操作とスヌーズに対応します。ブラウザーのバックグラウンド通知は別途有効にします。",
        "修正はオフラインで保存できます。複数クライアントの同時編集では、結果を明示的に選択します。",
        "新しい履歴を使用するには、ほかの端末のGENESISも更新してください。"))
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
