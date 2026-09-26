package ru.genesis.calendar.auth

import android.app.Activity
import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.CloudAccountImporter
import ru.genesis.calendar.data.StoicheionDrawRepository

data class AuthPanelState(
    val busy: Boolean = false,
    val ready: Boolean = false,
    val user: ServerIdentity? = null,
    val accountSettings: AccountSettings? = null,
    val preview: CloudWorkspacePreview.Summary? = null,
    val workspaceConflictPath: String? = null,
    val checkedAt: Long? = null,
    val message: String = "Серверная сессия ещё не проверена.",
)

/** Account entry and explicit read-only cloud inspection; local draft scope never changes here. */
class AuthController private constructor(context: Context) {
    private val app = context.applicationContext as GenesisApplication
    private val client = AuthSessionClient(context.applicationContext)
    private val credentials = CredentialManager.create(context.applicationContext)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var operation: Job? = null
    private var syncJob: Job? = null
    private val mutableState = MutableStateFlow(AuthPanelState())
    val state = mutableState.asStateFlow()

    /** Process-start check only. Recomposition and configuration changes must not restart auth. */
    fun ensureSession() {
        if (mutableState.value.checkedAt != null || operation?.isActive == true) return
        checkSession()
    }

    fun checkSession() = start("Проверяем серверную сессию…") { generation ->
        val payload = withContext(Dispatchers.IO) { client.session(generation) }
        val identity = AuthProtocol.identity(payload)
        if (identity == null) {
            app.activateAccount(null)
            publish(generation, AuthPanelState(checkedAt = System.currentTimeMillis(),
                message = "На сервере нет активного входа."))
        }
        else completeSignedIn(generation, payload, "Сессия подтверждена; зашифрованное пространство прочитано.")
    }

    fun signIn(activity: Activity, preferredLanguage: String? = null) = start("Готовим защищённый вход…") { generation ->
        // A fresh server challenge must exist before any provider UI/token request.
        withContext(Dispatchers.IO) { client.session(generation) }
        // Google Play services may retain a stale provider selection after the native
        // session has expired. Reset only the provider state (never local GENESIS data)
        // so every consumer or Workspace account can be selected on each new sign-in.
        resetCredentialProvider()
        val challenge = withContext(Dispatchers.IO) { AuthProtocol.challenge(client.challenge(generation)) }
        if (!client.isCurrent(generation)) throw CancellationException()
        val option = GetSignInWithGoogleOption.Builder(challenge.serverClientId).setNonce(challenge.nonce).build()
        val result = credentials.getCredential(activity, GetCredentialRequest.Builder().addCredentialOption(option).build())
        if (!client.isCurrent(generation)) throw CancellationException()
        val credential = result.credential
        if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL)
            throw AuthFailure(AuthFailure.Kind.PROTOCOL)
        val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
        val payload = withContext(Dispatchers.IO) { client.authenticate(generation, token) }
        completeSignedIn(generation, payload, "Вход подтверждён. Облачные данные расшифрованы автоматически.",
            preferredLanguage)
    }

    private suspend fun completeSignedIn(generation: Long, session: JSONObject, successMessage: String,
        preferredLanguage: String? = null) {
        val identity = AuthProtocol.identity(session) ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        val settings = AccountSettings.fromResponse(session) ?: throw AuthFailure(AuthFailure.Kind.PROTOCOL)
        publish(generation, AuthPanelState(busy = true, user = identity, accountSettings = settings,
            checkedAt = System.currentTimeMillis(), message = "Открываем зашифрованное пространство…"))
        try {
            val payload = withContext(Dispatchers.IO) { client.bootstrap(generation) }
            val confirmed = AuthProtocol.identity(payload) ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
            if (confirmed.uid != identity.uid) throw AuthFailure(AuthFailure.Kind.PROTOCOL)
            val preview = withContext(Dispatchers.Default) { CloudWorkspacePreview.inspect(payload) }
            val snapshot = withContext(Dispatchers.Default) { CloudAccountSnapshot.fromBootstrap(payload) }
            val imported = withContext(Dispatchers.IO) { CloudAccountImporter(app.database, app.scheduler).import(snapshot) }
            val stoicheionPayload = try {
                withContext(Dispatchers.IO) { client.stoicheionDraws(generation) }
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) { null }
            var resolvedSettings = AccountSettings.fromResponse(payload) ?: settings
            var languageWarning = false
            if (preferredLanguage in setOf("ru", "en") && resolvedSettings.language != preferredLanguage) {
                try {
                    val updated = withContext(Dispatchers.IO) {
                        client.updatePreferences(generation, JSONObject().put("language", preferredLanguage))
                    }
                    require(AuthProtocol.identity(updated)?.uid == confirmed.uid)
                    resolvedSettings = AccountSettings.fromResponse(updated) ?: resolvedSettings
                } catch (error: CancellationException) { throw error }
                catch (_: Exception) { languageWarning = true }
            }
            app.activateAccount(confirmed.uid)
            val stoicheionWarning = if (stoicheionPayload != null) try {
                withContext(Dispatchers.IO) { StoicheionDrawRepository(app).replaceFromServer(stoicheionPayload) }
                false
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) { true } else true
            withContext(Dispatchers.IO) { app.scheduler.restore() }
            publish(generation, AuthPanelState(ready = true, user = confirmed,
                accountSettings = resolvedSettings, preview = preview,
                checkedAt = System.currentTimeMillis(), message = (when (imported) {
                    CloudAccountImporter.Result.IMPORTED -> "$successMessage Данные доступны в приложении."
                    CloudAccountImporter.Result.IMPORTED_WITH_GOOGLE_WARNING ->
                        "Пространство открыто, но Google не подтвердил обновление задач. Ранее загруженные задачи сохранены."
                    CloudAccountImporter.Result.PENDING_LOCAL_CHANGES ->
                        "Есть локальные изменения аккаунта, ещё не отправленные на сервер. Облачная копия не перезаписала их."
                }) + (if (languageWarning) " Выбранный язык пока не сохранён в аккаунте; повторите выбор в личном кабинете." else "") +
                    (if (stoicheionWarning) " Выбор карты пока не обновлён; нажмите «Обновить» при восстановлении сети." else "")))
        } catch (error: CancellationException) {
            throw error
        } catch (error: AuthFailure) {
            if (error.kind in setOf(AuthFailure.Kind.UNAUTHORIZED, AuthFailure.Kind.PROTOCOL)) throw error
            publish(generation, AuthPanelState(user = identity, accountSettings = settings,
                checkedAt = System.currentTimeMillis(), message = "Вход выполнен, но загрузка облачных данных пока не завершилась. Локальные записи сохранены."))
        } catch (_: CloudWorkspacePreview.RecoveryRequired) {
            publish(generation, AuthPanelState(user = identity, accountSettings = settings,
                checkedAt = System.currentTimeMillis(), message = "Вход выполнен, но для этого пространства требуется код восстановления. Данные не перезаписаны."))
        } catch (_: Exception) {
            publish(generation, AuthPanelState(user = identity, accountSettings = settings,
                checkedAt = System.currentTimeMillis(), message = "Вход выполнен, но загрузка облачных данных пока не завершилась. Локальные записи сохранены."))
        }
    }

    fun saveRouting(routing: SyncRouting) = start("Сохраняем маршрутизацию аккаунтов…") { generation ->
        val previous = mutableState.value
        val accounts = previous.accountSettings?.accounts ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        if (!routing.validFor(accounts)) throw AuthFailure(AuthFailure.Kind.PROTOCOL)
        val payload = withContext(Dispatchers.IO) { client.updateRouting(generation, routing) }
        val settings = AccountSettings.fromResponse(payload) ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        val identity = AuthProtocol.identity(payload) ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        publish(generation, AuthPanelState(ready = previous.ready, user = identity, accountSettings = settings, preview = previous.preview,
            checkedAt = System.currentTimeMillis(), message = "Маршрутизация сохранена на сайте GENESIS."))
    }

    fun updateSharedPreference(name: String, value: String) = start("Сохраняем настройку на сервере…") { generation ->
        val previous = mutableState.value
        previous.accountSettings ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        val changes = JSONObject()
        when (name) {
            "display" -> { require(value in setOf("sacred", "lunar", "profane")); changes.put("calendarMode", value) }
            "input" -> { require(value in setOf("sacred", "lunar", "profane")); changes.put("taskCalendarMode", value) }
            "time" -> { require(value in setOf("12h", "24h")); changes.put("timeFormat", value) }
            "language" -> { require(value in setOf("ru", "en")); changes.put("language", value) }
            "stoicheionDivinationDisabled" -> {
                require(value in setOf("true", "false")); changes.put("stoicheionDivinationDisabled", value.toBoolean())
            }
            else -> throw AuthFailure(AuthFailure.Kind.PROTOCOL)
        }
        val payload = withContext(Dispatchers.IO) { client.updatePreferences(generation, changes) }
        val settings = AccountSettings.fromResponse(payload) ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        val identity = AuthProtocol.identity(payload) ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        publish(generation, AuthPanelState(ready = previous.ready, user = identity, accountSettings = settings, preview = previous.preview,
            checkedAt = System.currentTimeMillis(), message = "Настройка сохранена в аккаунте; локальная копия обновляется."))
    }

    fun removeLinkedAccount(accountId: String) = start("Отключаем дополнительный аккаунт…") { generation ->
        val previous = mutableState.value
        val account = previous.accountSettings?.accounts?.find { it.id == accountId }
        if (account == null || account.isPrimary) throw AuthFailure(AuthFailure.Kind.PROTOCOL)
        val payload = withContext(Dispatchers.IO) { client.removeLinkedAccount(generation, accountId) }
        val settings = AccountSettings.fromResponse(payload) ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        val identity = AuthProtocol.identity(payload) ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        publish(generation, AuthPanelState(ready = previous.ready, user = identity, accountSettings = settings, preview = previous.preview,
            checkedAt = System.currentTimeMillis(), message = "Дополнительный аккаунт отключён; существующие события Google не удалены."))
    }

    fun logout() = start("Закрываем серверную сессию…") { generation ->
        // begin() has already invalidated every in-flight response before touching stored credentials.
        var remoteClosed = false
        withContext(Dispatchers.IO) {
            val previous = client.takeForLogout(generation)
            try {
                client.revoke(generation, previous)
                remoteClosed = true
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                // Local credential is already deleted; no offline promise about server revocation.
            }
        }
        var providerCleared = true
        try {
            credentials.clearCredentialState(ClearCredentialStateRequest())
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            providerCleared = false
        }
        val message = if (remoteClosed) "Вход закрыт. Локальные черновики сохранены."
            else "Вход удалён с устройства. Отзыв серверной сессии не подтверждён; локальные черновики сохранены."
        app.activateAccount(null)
        publish(generation, AuthPanelState(message = message + if (providerCleared) "" else " Поставщик Google недоступен для очистки состояния."))
    }

    fun syncPending() = syncPending(WorkspacePatch.ConflictPolicy.STOP)

    internal suspend fun loadStoicheionDraws(): JSONObject {
        val generation = client.currentGeneration()
        return try { withContext(Dispatchers.IO) { client.stoicheionDraws(generation) } }
        catch (error: CancellationException) { throw error }
        catch (error: AuthFailure) { throw IllegalStateException(stoicheionFailureMessage(error.kind)) }
    }

    internal suspend fun saveStoicheionDraw(kind: String, seed: Long): JSONObject {
        val generation = client.currentGeneration()
        return try { withContext(Dispatchers.IO) { client.saveStoicheionDraw(generation, kind, seed) } }
        catch (error: CancellationException) { throw error }
        catch (error: AuthFailure) { throw IllegalStateException(stoicheionFailureMessage(error.kind)) }
    }

    private fun stoicheionFailureMessage(kind: AuthFailure.Kind) = when (kind) {
        AuthFailure.Kind.UNAUTHORIZED -> "Сессия аккаунта завершилась. Повторите вход и выбор карты."
        AuthFailure.Kind.RATE_LIMIT -> "Слишком много запросов. Повторите выбор карты через минуту."
        AuthFailure.Kind.NETWORK -> "Нет подтверждения от сервера. Проверьте сеть; прежний выбор карты сохранён."
        AuthFailure.Kind.CONFLICT -> "Карта уже изменилась на другом устройстве. Нажмите «Обновить»."
        AuthFailure.Kind.SERVER -> "Сервер временно не сохранил карту. Повторите позже."
        else -> "Не удалось безопасно синхронизировать карту с аккаунтом."
    }

    fun keepLocalWorkspaceChanges() = syncPending(WorkspacePatch.ConflictPolicy.KEEP_LOCAL)
    fun keepRemoteWorkspaceChanges() = syncPending(WorkspacePatch.ConflictPolicy.KEEP_REMOTE)

    private fun syncPending(conflictPolicy: WorkspacePatch.ConflictPolicy) {
        val identity = mutableState.value.user ?: return
        val accountScope = CloudAccountSnapshot.scopeFor(identity.uid)
        if (app.workspaceScope != accountScope || syncJob?.isActive == true) return
        val generation = client.currentGeneration()
        syncJob = scope.launch {
            var sentTasks = 0
            var sentWorkspace = 0
            var failure: String? = null
            var conflictPath: String? = null
            try {
                sentWorkspace = withContext(Dispatchers.IO) {
                    CloudWorkspaceSync(app.database, object : CloudWorkspaceTransport {
                        override fun get() = client.workspace(generation)
                        override fun put(body: JSONObject) = client.putWorkspace(generation, body)
                    }).flush(accountScope, conflictPolicy)
                }
            } catch (error: CancellationException) { throw error }
            catch (error: WorkspacePatch.Conflict) {
                conflictPath = error.field
                failure = "Конфликт зашифрованного пространства: данные устройства сохранены. Решите, какую версию оставить."
            }
            catch (_: CloudWorkspacePreview.RecoveryRequired) { failure = "Для синхронизации нужен код восстановления пространства." }
            catch (_: Exception) { failure = "Изменения проектов или привычек пока не подтверждены сервером и сохранены на устройстве." }
            try {
                sentTasks = withContext(Dispatchers.IO) {
                    CloudTaskSync(app.database, object : CloudTaskTransport {
                        override fun put(id: String, task: JSONObject) = client.putTask(generation, id, task)
                        override fun delete(id: String, task: JSONObject) = client.deleteTask(generation, id, task)
                    }).flush(accountScope)
                }
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) { failure = listOfNotNull(failure,
                "Изменения задач пока не подтверждены Google и сохранены на устройстве.").joinToString(" ") }
            if (client.isCurrent(generation)) mutableState.value = mutableState.value.copy(
                workspaceConflictPath = conflictPath, message = failure ?:
                if (sentTasks + sentWorkspace > 0) "Синхронизировано: $sentTasks задач, $sentWorkspace изменений пространства."
                else mutableState.value.message)
        }
    }

    private fun start(message: String, block: suspend (Long) -> Unit) {
        val generation = client.begin()
        operation?.cancel()
        syncJob?.cancel()
        val previous = mutableState.value
        // A transient refresh/provider failure must not throw an authenticated user back to Welcome.
        // Only a verified unauthorized/protocol response below is allowed to clear that state.
        mutableState.value = AuthPanelState(busy = true, ready = previous.ready, user = previous.user,
            accountSettings = previous.accountSettings, preview = previous.preview,
            workspaceConflictPath = previous.workspaceConflictPath,
            checkedAt = previous.checkedAt, message = message)
        operation = scope.launch {
            fun failed(message: String, retainIdentity: Boolean = true) = publish(generation,
                AuthPanelState(ready = previous.ready && retainIdentity,
                    user = previous.user.takeIf { retainIdentity },
                    accountSettings = previous.accountSettings.takeIf { retainIdentity },
                    preview = previous.preview.takeIf { retainIdentity },
                    checkedAt = previous.checkedAt.takeIf { retainIdentity }, message = message))
            try {
                block(generation)
            } catch (error: CancellationException) {
                if (client.isCurrent(generation)) failed("Проверка входа отменена.")
                throw error
            } catch (_: GetCredentialCancellationException) {
                failed("Вход отменён. Локальные записи не изменены.")
            } catch (_: GetCredentialProviderConfigurationException) {
                failed("Поставщик входа Google недоступен. Проверьте наличие Google Play services; локальные функции доступны.")
            } catch (_: NoCredentialException) {
                failed("Google не предоставил данные для входа. Проверьте аккаунт и настройки OAuth. Локальные функции доступны.")
            } catch (_: CloudWorkspacePreview.RecoveryRequired) {
                failed("Данные сайта защищены кодом восстановления. Ничего не перезаписано; понадобится код из личного кабинета.")
            } catch (_: CloudWorkspacePreview.Unreadable) {
                failed("Не удалось проверить зашифрованные данные сайта. Сессия и локальные записи сохранены; ничего не перезаписано.")
            } catch (_: GoogleIdTokenParsingException) {
                failed("Google вернул ответ, который не удалось проверить. Обновите Google Play services и повторите вход.")
            } catch (_: GetCredentialException) {
                resetCredentialProvider()
                failed("Google-вход не подтверждён. Проверьте сеть, Google Play services и OAuth-регистрацию этой Android-сборки.")
            } catch (error: AuthFailure) {
                if (error.kind in setOf(AuthFailure.Kind.UNAUTHORIZED, AuthFailure.Kind.PROTOCOL)) clearCurrent(generation)
                failed(when (error.kind) {
                    AuthFailure.Kind.NOT_DEPLOYED -> "Нативный вход ещё не опубликован на сервере. Локальные функции доступны."
                    AuthFailure.Kind.UNAUTHORIZED -> "Сессия или запрос входа отклонены. Начните вход заново."
                    AuthFailure.Kind.RATE_LIMIT -> "Слишком много попыток. Повторите вход через минуту."
                    AuthFailure.Kind.NETWORK -> "Нет подтверждения от сервера. Проверьте сеть и повторите."
                    AuthFailure.Kind.STORAGE -> "Защищённая сессия на устройстве недоступна. Повторите вход; локальные записи не изменены."
                    AuthFailure.Kind.CONFLICT -> "Данные изменились на другом устройстве. Обновите синхронизацию."
                    AuthFailure.Kind.SERVER -> "Сервер временно не может подтвердить вход. Повторите позже."
                    AuthFailure.Kind.PROTOCOL -> "Ответ сервера не прошёл проверку. Вход не подтверждён."
                }, retainIdentity = error.kind !in setOf(AuthFailure.Kind.UNAUTHORIZED, AuthFailure.Kind.PROTOCOL))
            } catch (error: Exception) {
                resetCredentialProvider()
                val code = error.javaClass.simpleName.filter { it.isLetterOrDigit() }.take(32).ifBlank { "Unknown" }
                failed("Не удалось безопасно завершить проверку. Состояние Google сброшено; повторите вход. Код: $code. Текущая сессия и локальные записи не изменены.")
            }
        }
    }

    private suspend fun resetCredentialProvider() {
        try {
            credentials.clearCredentialState(ClearCredentialStateRequest())
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            // The following getCredential call still has its own precise error path.
        }
    }

    private suspend fun clearCurrent(generation: Long) {
        withContext(Dispatchers.IO) {
            if (client.isCurrent(generation)) try { client.clear(generation) } catch (_: Exception) { /* fail closed in UI */ }
        }
        if (client.isCurrent(generation)) app.activateAccount(null)
    }

    private fun publish(generation: Long, value: AuthPanelState) {
        if (client.isCurrent(generation)) mutableState.value = value
    }

    companion object {
        @Volatile private var instance: AuthController? = null
        fun get(context: Context): AuthController = instance ?: synchronized(this) {
            instance ?: AuthController(context.applicationContext).also { instance = it }
        }
    }
}
