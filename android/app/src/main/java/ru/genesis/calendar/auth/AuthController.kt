package ru.genesis.calendar.auth

import android.app.Activity
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
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
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import com.google.android.gms.tasks.Task
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.CloudAccountImporter
import ru.genesis.calendar.data.StoicheionDrawRepository
import ru.genesis.calendar.data.LocalPreferences
import kotlinx.coroutines.flow.first
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class AuthPanelState(
    val busy: Boolean = false,
    val ready: Boolean = false,
    val requiresSignIn: Boolean = false,
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
    private var pullJob: Job? = null
    private val dataSyncMutex = Mutex()
    private var pendingServicesUserId: String? = null
    private val mutableState = MutableStateFlow(AuthPanelState())
    val state = mutableState.asStateFlow()
    private val mutableTaskSync = MutableStateFlow(AccountTaskSyncState())
    val taskSync = mutableTaskSync.asStateFlow()

    /** Process-start check only. Recomposition and configuration changes must not restart auth. */
    fun ensureSession() {
        if (mutableState.value.checkedAt != null || operation?.isActive == true) return
        checkSession()
    }

    fun checkSession() = start("Проверяем серверную сессию…") { generation ->
        if (mutableState.value.user == null) {
            val cached = withContext(Dispatchers.IO) { CachedAccountEntry(app).read(app.workspaceScope) }
            if (cached != null) publish(generation, AuthPanelState(busy = true, ready = true,
                user = cached.identity, accountSettings = cached.settings,
                message = "Открыта защищённая локальная копия. Проверяем связь с облаком…"))
        }
        val payload = withContext(Dispatchers.IO) { client.session(generation) }
        val identity = AuthProtocol.identity(payload)
        if (identity == null) {
            requireSignIn(generation)
        }
        else completeSignedIn(generation, payload, "Сессия подтверждена; зашифрованное пространство прочитано.")
    }

    fun signIn(activity: Activity, preferredLanguage: String? = null) = start("Готовим защищённый вход…") { generation ->
        AuthDiagnostics.event("GOOGLE_AUTH_STARTED")
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
        AuthDiagnostics.event("GOOGLE_AUTH_SUCCESS")
        if (!client.isCurrent(generation)) throw CancellationException()
        val credential = result.credential
        if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL)
            throw AuthFailure(AuthFailure.Kind.PROTOCOL)
        val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
        AuthDiagnostics.event("GOOGLE_ID_TOKEN_RECEIVED")
        val payload = withContext(Dispatchers.IO) { client.authenticate(generation, token) }
        AuthDiagnostics.event("BACKEND_AUTH_SUCCESS")
        when (AuthProtocol.googleLinkAction(payload)) {
            "found" -> AuthDiagnostics.event("GOOGLE_LINK_FOUND")
            "created" -> AuthDiagnostics.event("GOOGLE_LINK_CREATED")
        }
        completeSignedIn(generation, payload, "Вход подтверждён. Облачные данные расшифрованы автоматически.",
            preferredLanguage)
    }

    fun connectGoogleServices(activity: Activity, launchResolution: (PendingIntent) -> Unit,
        onCompletedWithoutResolution: () -> Unit = {}) =
        start("Готовим разрешения Google Calendar и Tasks…") { generation ->
            val identity = mutableState.value.user ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
            val access = GoogleServiceAccess.primary(mutableState.value.accountSettings)
            val serverClientId = withContext(Dispatchers.IO) {
                AuthProtocol.serverClientId(client.googleServicesConfig(generation))
            }
            if (!client.isCurrent(generation)) throw CancellationException()
            val request = AuthorizationRequest.builder()
                .setRequestedScopes(access.scopesForConsent().map(::Scope))
                .requestOfflineAccess(serverClientId)
                // Always make the hand-off visible. SELECT_ACCOUNT also avoids an
                // immediate silent failure when the GENESIS session email is not
                // currently registered as an Android account on this device.
                .setPrompt(AuthorizationRequest.Prompt.CONSENT or AuthorizationRequest.Prompt.SELECT_ACCOUNT)
                .build()
            val authorization = try {
                Identity.getAuthorizationClient(activity).authorize(request).awaitResult()
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                throw GoogleServicesAuthorizationException()
            }
            if (!client.isCurrent(generation)) throw CancellationException()
            if (authorization.hasResolution()) {
                val pendingIntent = authorization.pendingIntent ?: throw GoogleServicesAuthorizationException()
                pendingServicesUserId = identity.uid
                publish(generation, mutableState.value.copy(busy = false,
                    message = "Подтвердите доступ к Google Calendar и Tasks в окне Google."))
                launchResolution(pendingIntent)
            } else {
                finishGoogleServicesAuthorization(generation, identity.uid, authorization)
                onCompletedWithoutResolution()
            }
        }

    fun completeGoogleServicesAuthorization(activity: Activity, data: Intent?) {
        val expectedUserId = pendingServicesUserId ?: return
        pendingServicesUserId = null
        start("Сохраняем разрешения Google…") { generation ->
            if (mutableState.value.user?.uid != expectedUserId || data == null) {
                throw GoogleServicesAuthorizationException()
            }
            val result = try {
                Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data)
            } catch (_: Exception) {
                throw GoogleServicesAuthorizationException()
            }
            finishGoogleServicesAuthorization(generation, expectedUserId, result)
        }
    }

    fun cancelGoogleServicesAuthorization() {
        pendingServicesUserId = null
        mutableState.value = mutableState.value.copy(busy = false,
            message = "Подключение Google Calendar и Tasks отменено. Данные и прежние разрешения не изменены.")
    }

    private suspend fun finishGoogleServicesAuthorization(generation: Long, expectedUserId: String,
        authorization: AuthorizationResult) {
        val code = authorization.serverAuthCode?.takeIf { it.isNotBlank() }
            ?: throw GoogleServicesAuthorizationException()
        val payload = withContext(Dispatchers.IO) { client.authorizeGoogleServices(generation, code) }
        val identity = AuthProtocol.identity(payload) ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        if (identity.uid != expectedUserId) throw AuthFailure(AuthFailure.Kind.PROTOCOL)
        val access = GoogleServiceAccess.primary(AccountSettings.fromResponse(payload))
        if (access.calendar) AuthDiagnostics.event("CALENDAR_SCOPE_GRANTED")
        if (access.tasks) AuthDiagnostics.event("TASKS_SCOPE_GRANTED")
        completeSignedIn(generation, payload,
            if (access.complete) "Google Calendar и Tasks подключены."
            else "Google сохранил часть разрешений. Недостающий сервис можно подключить отдельно.")
    }

    private suspend fun completeSignedIn(generation: Long, session: JSONObject, successMessage: String,
        preferredLanguage: String? = null) {
        val identity = AuthProtocol.identity(session) ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        AuthDiagnostics.event("GENESIS_USER_RESOLVED")
        val settings = AccountSettings.fromResponse(session) ?: throw AuthFailure(AuthFailure.Kind.PROTOCOL)
        val cachedState = mutableState.value.takeIf {
            it.ready && it.user?.uid == identity.uid && app.workspaceScope == CloudAccountSnapshot.scopeFor(identity.uid)
        }
        var stage = "BOOTSTRAP"
        publish(generation, AuthPanelState(busy = true, ready = cachedState != null,
            user = identity, accountSettings = settings, preview = cachedState?.preview,
            checkedAt = System.currentTimeMillis(), message = "Открываем зашифрованное пространство…"))
        try {
            AuthDiagnostics.event("SYNC_STARTED")
            val payload = withContext(Dispatchers.IO) { client.accountBootstrap(generation, session) }
            val confirmed = AuthProtocol.identity(payload) ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
            if (confirmed.uid != identity.uid) throw AuthFailure(AuthFailure.Kind.PROTOCOL)
            stage = "WORKSPACE_DECRYPT"
            val preview = withContext(Dispatchers.Default) { CloudWorkspacePreview.inspect(payload) }
            val snapshot = withContext(Dispatchers.Default) { CloudAccountSnapshot.fromBootstrap(payload) }
            stage = "ACCOUNT_IMPORT"
            val imported = dataSyncMutex.withLock {
                withContext(Dispatchers.IO) { CloudAccountImporter(app.database, app.scheduler).import(snapshot) }
            }
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
            if (app.workspaceScope != CloudAccountSnapshot.scopeFor(confirmed.uid)) {
                withContext(Dispatchers.IO) { app.scheduler.deactivate(app.workspaceScope) }
            }
            app.activateAccount(confirmed.uid)
            val stoicheionWarning = if (stoicheionPayload != null) try {
                withContext(Dispatchers.IO) { StoicheionDrawRepository(app).replaceFromServer(stoicheionPayload) }
                false
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) { true } else true
            // Notification permission/OEM alarm errors must not undo a completed cloud import.
            try { withContext(Dispatchers.IO) { app.scheduler.restore(); app.scheduler.restoreHabitNotifications() } }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) { logCloudFailure("REMINDER_RESTORE", error) }
            AuthDiagnostics.event("SYNC_SUCCESS")
            withContext(Dispatchers.IO) { CachedAccountEntry(app).save(confirmed, resolvedSettings) }
            publish(generation, AuthPanelState(ready = true, user = confirmed,
                accountSettings = resolvedSettings, preview = preview,
                checkedAt = System.currentTimeMillis(), message = (when (imported) {
                    CloudAccountImporter.Result.IMPORTED -> if (snapshot.tasksDeferred)
                        "$successMessage Загружаем задачи аккаунта…" else "$successMessage Данные доступны в приложении."
                    CloudAccountImporter.Result.IMPORTED_WITH_GOOGLE_WARNING ->
                        "Пространство открыто, но Google не подтвердил обновление задач. Ранее загруженные задачи сохранены."
                    CloudAccountImporter.Result.IMPORTED_WITH_TASK_WARNING ->
                        "Часть записей не удалось прочитать. Остальные задачи загружены; сохранённые записи не удалены."
                    CloudAccountImporter.Result.PENDING_LOCAL_CHANGES ->
                        "Есть локальные изменения аккаунта, ещё не отправленные на сервер. Облачная копия не перезаписала их."
                }) + (if (languageWarning) " Выбранный язык пока не сохранён в аккаунте; повторите выбор в личном кабинете." else "") +
                    (if (stoicheionWarning) " Выбор карты пока не обновлён; нажмите «Обновить» при восстановлении сети." else "")))
        } catch (error: CancellationException) {
            AuthDiagnostics.event("SYNC_FAILED")
            throw error
        } catch (error: AuthFailure) {
            AuthDiagnostics.event("SYNC_FAILED")
            if (error.kind in setOf(AuthFailure.Kind.UNAUTHORIZED, AuthFailure.Kind.PROTOCOL)) throw error
            publish(generation, AuthPanelState(ready = cachedState != null, preview = cachedState?.preview,
                user = identity, accountSettings = settings,
                checkedAt = System.currentTimeMillis(), message = "Вход выполнен, но загрузка облачных данных пока не завершилась. Локальные записи сохранены."))
        } catch (_: CloudWorkspacePreview.RecoveryRequired) {
            AuthDiagnostics.event("SYNC_FAILED")
            publish(generation, AuthPanelState(ready = cachedState != null, preview = cachedState?.preview,
                user = identity, accountSettings = settings,
                checkedAt = System.currentTimeMillis(), message = "Вход выполнен, но для этого пространства требуется код восстановления. Данные не перезаписаны."))
        } catch (error: CloudWorkspacePreview.Unreadable) {
            AuthDiagnostics.event("SYNC_FAILED")
            logCloudFailure(stage, error)
            publish(generation, AuthPanelState(ready = cachedState != null, preview = cachedState?.preview,
                user = identity, accountSettings = settings,
                checkedAt = System.currentTimeMillis(), message = "Вход выполнен, но формат облачных данных не удалось проверить (CLOUD_FORMAT). Локальные записи сохранены."))
        } catch (error: Exception) {
            AuthDiagnostics.event("SYNC_FAILED")
            logCloudFailure(stage, error)
            publish(generation, AuthPanelState(ready = cachedState != null, preview = cachedState?.preview,
                user = identity, accountSettings = settings,
                checkedAt = System.currentTimeMillis(), message = "Вход выполнен, но импорт облачных данных не завершён (CLOUD_IMPORT). Локальные записи сохранены."))
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
        val preferences = LocalPreferences(app, app.workspaceScope)
        preferences.setPending(name, value)
        val payload = flushPendingPreferences(generation, previous.user?.uid ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED))
            ?: throw AuthFailure(AuthFailure.Kind.PROTOCOL)
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
        val previousScope = app.workspaceScope
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
        withContext(Dispatchers.IO) { CachedAccountEntry(app).clear(previousScope); app.scheduler.deactivate(previousScope) }
        app.activateAccount(null)
        publish(generation, AuthPanelState(message = message + if (providerCleared) "" else " Поставщик Google недоступен для очистки состояния."))
    }

    fun syncPending() = syncPending(WorkspacePatch.ConflictPolicy.STOP)

    /** A manual sync includes downloading tasks, and never cancels a pull already in progress. */
    fun refresh() {
        if (mutableState.value.ready && !mutableState.value.requiresSignIn) refreshIfReady() else checkSession()
    }

    /** Pull on resume and periodically while visible, so another device's changes arrive automatically. */
    fun refreshIfReady() {
        if (operation?.isActive == true || !mutableState.value.ready || mutableState.value.requiresSignIn) return
        syncPending()
        refreshAccountData()
    }

    private fun refreshAccountData() {
        val identity = mutableState.value.user ?: return
        if (!mutableState.value.ready || mutableState.value.requiresSignIn || pullJob?.isActive == true) return
        val generation = client.currentGeneration()
        val accountScope = CloudAccountSnapshot.scopeFor(identity.uid)
        val previous = mutableTaskSync.value.takeIf { it.scope == accountScope } ?: AccountTaskSyncState(accountScope)
        mutableTaskSync.value = previous.copy(loading = true)
        pullJob = scope.launch {
            try {
                syncJob?.join()
                dataSyncMutex.withLock {
                    val payload = withContext(Dispatchers.IO) { client.bootstrap(generation) }
                    if (AuthProtocol.identity(payload)?.uid != identity.uid) throw AuthFailure(AuthFailure.Kind.PROTOCOL)
                    val snapshot = withContext(Dispatchers.Default) { CloudAccountSnapshot.fromBootstrap(payload) }
                    val preview = withContext(Dispatchers.Default) { CloudWorkspacePreview.inspect(payload) }
                    val imported = withContext(Dispatchers.IO) {
                        CloudAccountImporter(app.database, app.scheduler).import(snapshot)
                    }
                    withContext(Dispatchers.IO) { ru.genesis.calendar.data.TaskListsRepository.cacheBootstrap(app.database, accountScope, payload) }
                    val available = withContext(Dispatchers.IO) { app.database.dao().accountTasks(accountScope).size }
                    if (!client.isCurrent(generation)) return@withLock
                    val issue = when {
                        imported == CloudAccountImporter.Result.IMPORTED_WITH_TASK_WARNING ->
                            "Часть записей не удалось прочитать. Остальные задачи загружены; сохранённые записи не удалены."
                        snapshot.googleSyncWarning ->
                            "Google не подтвердил полную загрузку задач. Проверьте подключение Calendar и Tasks в настройках."
                        else -> null
                    }
                    mutableTaskSync.value = AccountTaskSyncState(accountScope, confirmed = issue == null,
                        issue = issue, received = snapshot.tasks.size + snapshot.unreadableTaskCount, available = available)
                    publish(generation, mutableState.value.copy(
                        accountSettings = AccountSettings.fromResponse(payload) ?: mutableState.value.accountSettings,
                        preview = preview, checkedAt = System.currentTimeMillis(),
                        message = when (imported) {
                            CloudAccountImporter.Result.IMPORTED -> "Данные аккаунта и задачи Google обновлены."
                            CloudAccountImporter.Result.IMPORTED_WITH_GOOGLE_WARNING ->
                                "Пространство обновлено. Часть задач Google пока недоступна; сохранённые задачи остаются на устройстве."
                            CloudAccountImporter.Result.IMPORTED_WITH_TASK_WARNING ->
                                "Часть записей не удалось прочитать. Остальные задачи загружены; сохранённые записи не удалены."
                            CloudAccountImporter.Result.PENDING_LOCAL_CHANGES ->
                                "Данные других устройств получены. Неотправленные изменения этого устройства сохранены."
                        }))
                }
                try { withContext(Dispatchers.IO) { app.scheduler.restore(); app.scheduler.restoreHabitNotifications() } }
                catch (error: CancellationException) { throw error }
                catch (error: Exception) { logCloudFailure("REMINDER_RESTORE", error) }
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) {
                logCloudFailure("BACKGROUND_PULL", error)
                if (error is AuthFailure && error.kind == AuthFailure.Kind.UNAUTHORIZED) requireSignIn(generation)
                if (client.isCurrent(generation)) {
                    mutableTaskSync.value = previous.copy(loading = false,
                        issue = "Не удалось загрузить задачи аккаунта. Нажмите «Обновить» для повторной попытки.")
                    publish(generation, mutableState.value.copy(
                        message = "Аккаунт открыт. Обновление задач пока не завершилось; повторим автоматически. Сохранённые записи доступны."))
                }
            } finally {
                if (client.isCurrent(generation)) mutableTaskSync.value = mutableTaskSync.value.copy(loading = false)
            }
        }
    }

    internal suspend fun createTaskList(title: String, accountId: String): ru.genesis.calendar.data.GoogleTaskList {
        val value = mutableState.value
        val uid = value.user?.uid
        require(uid != null && value.ready && !value.requiresSignIn) { "Для создания списка повторите вход через Google." }
        require(value.accountSettings?.accounts?.any { it.id == accountId && it.tasksConnected } == true) {
            "Подключите Google Tasks для выбранного аккаунта в настройках."
        }
        val accountScope = CloudAccountSnapshot.scopeFor(uid)
        require(app.workspaceScope == accountScope)
        val generation = client.currentGeneration()
        try {
            return dataSyncMutex.withLock {
                val response = withContext(Dispatchers.IO) { client.createTaskList(generation, title, accountId) }
                if(!client.isCurrent(generation) || app.workspaceScope != accountScope) throw CancellationException()
                val list = ru.genesis.calendar.data.GoogleTaskList.from(response.getJSONObject("taskList"))
                require(list.accountId == accountId)
                withContext(Dispatchers.IO) { ru.genesis.calendar.data.TaskListsRepository(app, accountScope).rememberCreated(list) }
                list
            }
        } catch(error: AuthFailure) {
            if(error.kind == AuthFailure.Kind.UNAUTHORIZED) requireSignIn(generation)
            throw error
        }
    }

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
        if (app.workspaceScope != accountScope || mutableState.value.requiresSignIn || syncJob?.isActive == true) return
        val generation = client.currentGeneration()
        syncJob = scope.launch {
          dataSyncMutex.withLock {
            AuthDiagnostics.event("SYNC_STARTED")
            var sentTasks = 0
            var sentWorkspace = 0
            var failure: String? = null
            var conflictPath: String? = null
            try { flushPendingPreferences(generation, identity.uid) }
            catch (e: CancellationException) { throw e }
            catch (error: Exception) {
                if (error is AuthFailure && error.kind == AuthFailure.Kind.UNAUTHORIZED) requireSignIn(generation)
                failure = "Настройки сохранены на устройстве и ожидают синхронизации."
            }
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
            catch (error: Exception) {
                if (error is AuthFailure && error.kind == AuthFailure.Kind.UNAUTHORIZED) requireSignIn(generation)
                failure = "Изменения проектов или привычек пока не подтверждены сервером и сохранены на устройстве."
            }
            try {
                sentTasks = withContext(Dispatchers.IO) {
                    CloudTaskSync(app.database, object : CloudTaskTransport {
                        override fun put(id: String, task: JSONObject) = client.putTask(generation, id, task)
                        override fun delete(id: String, task: JSONObject) = client.deleteTask(generation, id, task)
                    }).flush(accountScope)
                }
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) {
                if (error is AuthFailure && error.kind == AuthFailure.Kind.UNAUTHORIZED) requireSignIn(generation)
                failure = listOfNotNull(failure,
                    "Изменения задач пока не подтверждены Google и сохранены на устройстве.").joinToString(" ")
            }
            if (client.isCurrent(generation)) mutableState.value = mutableState.value.copy(
                workspaceConflictPath = conflictPath, message = failure ?:
                if (sentTasks + sentWorkspace > 0) "Синхронизировано: $sentTasks задач, $sentWorkspace изменений пространства."
                else mutableState.value.message)
            AuthDiagnostics.event(if (failure == null) "SYNC_SUCCESS" else "SYNC_FAILED")
          }
        }
    }

    private suspend fun flushPendingPreferences(generation: Long, uid: String): JSONObject? {
        val accountScope = CloudAccountSnapshot.scopeFor(uid)
        if (app.workspaceScope != accountScope) return null
        val preferences = LocalPreferences(app, accountScope)
        val changes = preferences.pending.first()
        if (changes.isEmpty()) return null
        val body = JSONObject()
        changes.forEach { (name, value) -> when (name) {
            "display" -> body.put("calendarMode", value)
            "input" -> body.put("taskCalendarMode", value)
            "time" -> body.put("timeFormat", value)
            "language" -> body.put("language", value)
            "stoicheionDivinationDisabled" -> body.put(name, value.toBoolean())
        } }
        val payload = withContext(Dispatchers.IO) { client.updatePreferences(generation, body) }
        if (AuthProtocol.identity(payload)?.uid != uid || !client.isCurrent(generation)) throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        val settings = AccountSettings.fromResponse(payload) ?: throw AuthFailure(AuthFailure.Kind.PROTOCOL)
        preferences.acknowledge(changes)
        publish(generation, mutableState.value.copy(accountSettings = settings))
        return payload
    }

    /** Uses the same guarded session, CAS merge and outbox path as the foreground UI. */
    internal suspend fun synchronizeInBackground(): Boolean = withContext(Dispatchers.Main.immediate) {
        if (!app.workspaceScope.startsWith("account-")) return@withContext true
        if (operation?.isActive != true) checkSession()
        operation?.join()
        if (mutableState.value.requiresSignIn) return@withContext true
        if (!mutableState.value.ready) return@withContext false
        syncPending()
        syncJob?.join()
        app.database.dao().observeOutbox(app.workspaceScope).first().isEmpty() &&
            LocalPreferences(app, app.workspaceScope).pending.first().isEmpty()
    }

    private fun start(message: String, block: suspend (Long) -> Unit) {
        val generation = client.begin()
        operation?.cancel()
        syncJob?.cancel()
        pullJob?.cancel()
        val previous = mutableState.value
        // A transient refresh/provider failure must not throw an authenticated user back to Welcome.
        // Server credentials and the device's encrypted workspace have independent lifetimes.
        mutableState.value = AuthPanelState(busy = true, ready = previous.ready, user = previous.user,
            requiresSignIn = previous.requiresSignIn,
            accountSettings = previous.accountSettings, preview = previous.preview,
            workspaceConflictPath = previous.workspaceConflictPath,
            checkedAt = previous.checkedAt, message = message)
        operation = scope.launch {
            fun failed(message: String, retainIdentity: Boolean = true) {
                // Cold startup may have opened the validated local cache after this operation began.
                // A network failure must retain that account as well as an already visible account.
                val retained = mutableState.value.takeIf { it.ready && it.user != null } ?: previous
                publish(generation, AuthPanelState(ready = retained.ready && retainIdentity,
                    requiresSignIn = retained.requiresSignIn,
                    user = retained.user.takeIf { retainIdentity },
                    accountSettings = retained.accountSettings.takeIf { retainIdentity },
                    preview = retained.preview.takeIf { retainIdentity },
                    checkedAt = retained.checkedAt.takeIf { retainIdentity }, message = message))
            }
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
            } catch (_: GoogleServicesAuthorizationException) {
                failed("Google не завершил выдачу разрешений Calendar/Tasks. Повторите подключение и выберите тот же аккаунт.")
            } catch (error: AuthFailure) {
                if (error.kind == AuthFailure.Kind.UNAUTHORIZED) requireSignIn(generation)
                failed(when (error.kind) {
                    AuthFailure.Kind.NOT_DEPLOYED -> "Нативный вход ещё не опубликован на сервере. Локальные функции доступны."
                    AuthFailure.Kind.UNAUTHORIZED -> "Повторите вход через Google для синхронизации. Данные и напоминания сохранены на устройстве."
                    AuthFailure.Kind.RATE_LIMIT -> "Слишком много попыток. Повторите вход через минуту."
                    AuthFailure.Kind.NETWORK -> "Нет подтверждения от сервера. Проверьте сеть и повторите."
                    AuthFailure.Kind.STORAGE -> "Защищённая сессия на устройстве недоступна. Повторите вход; локальные записи не изменены."
                    AuthFailure.Kind.CONFLICT -> "Данные изменились на другом устройстве. Обновите синхронизацию."
                    AuthFailure.Kind.SERVER -> "Сервер временно не может подтвердить вход. Повторите позже."
                    AuthFailure.Kind.PROTOCOL -> "Ответ сервера не прошёл проверку. Вход не подтверждён."
                })
            } catch (error: Exception) {
                resetCredentialProvider()
                val code = error.javaClass.simpleName.filter { it.isLetterOrDigit() }.take(32).ifBlank { "Unknown" }
                failed("Не удалось безопасно завершить проверку. Состояние Google сброшено; повторите вход. Код: $code. Текущая сессия и локальные записи не изменены.")
            } finally {
                if (client.isCurrent(generation) && mutableState.value.ready) refreshAccountData()
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

    private fun logCloudFailure(stage: String, error: Exception) {
        // Exception messages can contain cloud record values. Keep only the stage,
        // type and application source location for device diagnostics.
        val location = error.stackTrace.firstOrNull { it.className.startsWith("ru.genesis.calendar.") }
        Log.e("GenesisAuth", "$stage: ${error.javaClass.simpleName} at ${location?.fileName}:${location?.lineNumber}")
    }

    private suspend fun requireSignIn(generation: Long) {
        if (!client.isCurrent(generation)) return
        val cached = withContext(Dispatchers.IO) { CachedAccountEntry(app).read(app.workspaceScope) }
        // A cached identity opens only this device's encrypted copy. Every cloud operation
        // still requires fresh server authentication; explicit logout revokes local access.
        publish(generation, AuthPanelState(ready = cached != null, requiresSignIn = cached != null,
            user = cached?.identity, accountSettings = cached?.settings,
            checkedAt = System.currentTimeMillis(),
            message = if (cached != null)
                "Локальная копия открыта. Повторите вход через Google для синхронизации; напоминания продолжают работать."
            else "На сервере нет активного входа."))
    }

    private fun publish(generation: Long, value: AuthPanelState) {
        if (client.isCurrent(generation)) {
            mutableState.value = value
            if (value.ready && value.user != null && value.accountSettings != null) scope.launch {
                dataSyncMutex.withLock {
                    if (client.isCurrent(generation) && app.workspaceScope == CloudAccountSnapshot.scopeFor(value.user.uid)) {
                        try { withContext(Dispatchers.IO) { CachedAccountEntry(app).save(value.user, value.accountSettings) } }
                        catch (error: CancellationException) { throw error }
                        catch (_: Exception) { /* Cached entry from the last successful import remains intact. */ }
                    }
                }
            }
        }
    }

    companion object {
        @Volatile private var instance: AuthController? = null
        fun get(context: Context): AuthController = instance ?: synchronized(this) {
            instance ?: AuthController(context.applicationContext).also { instance = it }
        }
    }
}

private suspend fun <T> Task<T>.awaitResult(): T = suspendCancellableCoroutine { continuation ->
    addOnSuccessListener { value -> if (continuation.isActive) continuation.resume(value) }
    addOnFailureListener { error -> if (continuation.isActive) continuation.resumeWithException(error) }
    addOnCanceledListener { if (continuation.isActive) continuation.cancel() }
}
