package ru.genesis.calendar.data

import androidx.room.withTransaction
import java.security.SecureRandom
import java.time.LocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.flowOn
import org.json.JSONObject
import ru.genesis.calendar.GenesisApplication

data class StoicheionDraw(val kind: String, val dayKey: String, val seed: Long,
    val attempts: Int, val firstAt: Long, val rerollDeadline: Long) {
    fun remainingSeconds(now: Long): Int = if (attempts == 1)
        ((rerollDeadline - now + 999L) / 1000L).coerceAtLeast(0L).toInt() else 0
    fun canReroll(now: Long): Boolean = attempts == 1 && now < rerollDeadline
}

data class StoicheionDraws(val daily: StoicheionDraw? = null, val spread: StoicheionDraw? = null)

object StoicheionDrawRules {
    fun next(existing: StoicheionDraw?, kind: String, dayKey: String, seed: Long, now: Long): StoicheionDraw {
        require(kind == "daily" || kind == "spread") { "Неизвестный вид расклада." }
        require(seed in 0..0xffff_ffffL) { "Зерно расклада указано неверно." }
        require(existing == null || existing.dayKey == dayKey && existing.kind == kind)
        if (existing != null) require(existing.canReroll(now)) {
            if (existing.attempts >= 2) "Переброс на сегодня уже использован."
            else "Трёхминутное окно для переброса завершилось."
        }
        return StoicheionDraw(kind, dayKey, seed, if (existing == null) 1 else 2,
            existing?.firstAt ?: now, existing?.rerollDeadline ?: now + 180_000L)
    }
}

/** Local encrypted fallback only. It does not impersonate the website's account-bound draw API. */
class StoicheionDrawRepository(private val app: GenesisApplication) {
    private val dao = app.database.dao()
    private val scope = app.workspaceScope
    private val cipher = LocalCipher()
    private val kind = "stoicheion-draws"
    private val associatedData = "$scope/$kind"
    private val random = SecureRandom()

    val today = dao.observeDocument(scope, kind).map { record ->
        if (record == null) StoicheionDraws() else read(
            JSONObject(cipher.decrypt(record.encrypted, associatedData)), LocalDate.now().toString())
    }.flowOn(Dispatchers.IO)

    suspend fun save(drawKind: String, seed: Long = random.nextInt().toUInt().toLong()): StoicheionDraw =
        app.database.withTransaction {
            val dayKey = LocalDate.now().toString()
            val row = dao.document(scope, kind)
            val root = if (row == null) JSONObject().put("days", JSONObject())
                else JSONObject(cipher.decrypt(row.encrypted, associatedData))
            val days = root.optJSONObject("days") ?: JSONObject().also { root.put("days", it) }
            val values = days.optJSONObject(dayKey) ?: JSONObject().also { days.put(dayKey, it) }
            val previous = values.optJSONObject(drawKind)?.let { fromJson(drawKind, dayKey, it) }
            val next = StoicheionDrawRules.next(previous, drawKind, dayKey, seed, System.currentTimeMillis())
            values.put(drawKind, JSONObject().put("seed", next.seed).put("attempts", next.attempts)
                .put("firstAt", next.firstAt).put("rerollDeadline", next.rerollDeadline))
            dao.putDocument(DocumentRecord(scope, kind, cipher.encrypt(root.toString(), associatedData),
                (row?.revision ?: 0L) + 1L))
            next
        }

    private fun read(root: JSONObject, dayKey: String): StoicheionDraws {
        val values = root.optJSONObject("days")?.optJSONObject(dayKey) ?: return StoicheionDraws()
        return StoicheionDraws(values.optJSONObject("daily")?.let { fromJson("daily", dayKey, it) },
            values.optJSONObject("spread")?.let { fromJson("spread", dayKey, it) })
    }

    private fun fromJson(drawKind: String, dayKey: String, value: JSONObject): StoicheionDraw? = runCatching {
        StoicheionDraw(drawKind, dayKey, value.getLong("seed"), value.getInt("attempts"),
            value.getLong("firstAt"), value.getLong("rerollDeadline")).takeIf {
            it.seed in 0..0xffff_ffffL && it.attempts in 1..2
        }
    }.getOrNull()
}
