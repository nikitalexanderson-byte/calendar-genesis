package ru.genesis.calendar.data

import androidx.room.withTransaction
import java.security.SecureRandom
import java.time.Instant
import java.time.LocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.flowOn
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.auth.AuthController

data class StoicheionDraw(val kind: String, val dayKey: String, val seed: Long,
    val attempts: Int, val firstAt: Long, val rerollDeadline: Long) {
    fun remainingSeconds(now: Long): Int = if (attempts == 1)
        ((rerollDeadline - now + 999L) / 1000L).coerceAtLeast(0L).toInt() else 0
    fun canReroll(now: Long): Boolean = attempts == 1 && now < rerollDeadline
}

data class StoicheionDraws(val daily: StoicheionDraw? = null, val spread: StoicheionDraw? = null,
    val timeline: StoicheionDraw? = null)

object StoicheionDrawRules {
    fun next(existing: StoicheionDraw?, kind: String, dayKey: String, seed: Long, now: Long): StoicheionDraw {
        require(kind in setOf("daily", "spread", "timeline")) { "Неизвестный вид расклада." }
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

internal object StoicheionDrawWire {
    fun drawsObject(payload: JSONObject): JSONObject = when (val value = payload.get("draws")) {
        is JSONObject -> value
        is JSONArray -> JSONObject().also { require(value.length() == 0) }
        else -> error("Некорректный набор раскладов.")
    }

    fun fromServerJson(value: JSONObject): StoicheionDraw {
        val draw = StoicheionDraw(value.getString("kind"), value.getString("dayKey"),
            value.getLong("seed"), value.getInt("attempts"),
            Instant.parse(value.getString("firstDrawAt")).toEpochMilli(),
            Instant.parse(value.getString("rerollDeadline")).toEpochMilli())
        require(draw.kind in setOf("daily", "spread", "timeline") && draw.seed in 0..0xffff_ffffL && draw.attempts in 1..2)
        LocalDate.parse(draw.dayKey)
        return draw
    }
}

/** Account scopes mirror the server draw API; local scopes retain the encrypted offline fallback. */
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

    suspend fun refreshFromServer(): StoicheionDraws {
        require(scope.startsWith("account-")) { "Серверная синхронизация доступна после входа." }
        return replaceFromServer(AuthController.get(app).loadStoicheionDraws())
    }

    suspend fun save(drawKind: String, seed: Long = random.nextInt().toUInt().toLong()): StoicheionDraw {
        if (scope.startsWith("account-")) {
            val payload = AuthController.get(app).saveStoicheionDraw(drawKind, seed)
            return mergeServerDraw(payload.getJSONObject("draw"))
        }
        return app.database.withTransaction {
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
    }

    internal suspend fun replaceFromServer(payload: JSONObject): StoicheionDraws = app.database.withTransaction {
        val dayKey = payload.getString("dayKey")
        LocalDate.parse(dayKey)
        val draws = StoicheionDrawWire.drawsObject(payload)
        val root = currentRoot()
        val days = root.optJSONObject("days") ?: JSONObject().also { root.put("days", it) }
        val values = JSONObject()
        listOf("daily", "spread", "timeline").forEach { drawKind ->
            draws.optJSONObject(drawKind)?.let { value ->
                val parsed = StoicheionDrawWire.fromServerJson(value)
                require(parsed.kind == drawKind && parsed.dayKey == dayKey)
                values.put(drawKind, localJson(parsed))
            }
        }
        days.put(dayKey, values)
        persist(root)
        read(root, dayKey)
    }

    private suspend fun mergeServerDraw(value: JSONObject): StoicheionDraw = app.database.withTransaction {
        val draw = StoicheionDrawWire.fromServerJson(value)
        val root = currentRoot()
        val days = root.optJSONObject("days") ?: JSONObject().also { root.put("days", it) }
        val values = days.optJSONObject(draw.dayKey) ?: JSONObject().also { days.put(draw.dayKey, it) }
        values.put(draw.kind, localJson(draw))
        persist(root)
        draw
    }

    private suspend fun currentRoot(): JSONObject {
        val row = dao.document(scope, kind)
        return if (row == null) JSONObject().put("days", JSONObject())
            else JSONObject(cipher.decrypt(row.encrypted, associatedData))
    }

    private suspend fun persist(root: JSONObject) {
        val row = dao.document(scope, kind)
        dao.putDocument(DocumentRecord(scope, kind, cipher.encrypt(root.toString(), associatedData),
            (row?.revision ?: 0L) + 1L))
    }

    private fun localJson(draw: StoicheionDraw) = JSONObject().put("seed", draw.seed)
        .put("attempts", draw.attempts).put("firstAt", draw.firstAt)
        .put("rerollDeadline", draw.rerollDeadline)

    private fun read(root: JSONObject, dayKey: String): StoicheionDraws {
        val values = root.optJSONObject("days")?.optJSONObject(dayKey) ?: return StoicheionDraws()
        return StoicheionDraws(values.optJSONObject("daily")?.let { fromJson("daily", dayKey, it) },
            values.optJSONObject("spread")?.let { fromJson("spread", dayKey, it) },
            values.optJSONObject("timeline")?.let { fromJson("timeline", dayKey, it) })
    }

    private fun fromJson(drawKind: String, dayKey: String, value: JSONObject): StoicheionDraw? = runCatching {
        StoicheionDraw(drawKind, dayKey, value.getLong("seed"), value.getInt("attempts"),
            value.getLong("firstAt"), value.getLong("rerollDeadline")).takeIf {
            it.seed in 0..0xffff_ffffL && it.attempts in 1..2
        }
    }.getOrNull()
}
