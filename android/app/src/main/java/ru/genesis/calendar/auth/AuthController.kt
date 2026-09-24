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
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class AuthPanelState(
    val busy: Boolean = false,
    val user: ServerIdentity? = null,
    val preview: CloudWorkspacePreview.Summary? = null,
    val checkedAt: Long? = null,
    val message: String = "Серверная сессия ещё не проверена.",
)

/** Account entry and explicit read-only cloud inspection; local draft scope never changes here. */
class AuthController private constructor(context: Context) {
    private val client = AuthSessionClient(context.applicationContext)
    private val credentials = CredentialManager.create(context.applicationContext)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var operation: Job? = null
    private val mutableState = MutableStateFlow(AuthPanelState())
    val state = mutableState.asStateFlow()

    fun checkSession() = start("Проверяем серверную сессию…") { generation ->
        val payload = withContext(Dispatchers.IO) { client.session(generation) }
        val identity = AuthProtocol.identity(payload)
        publish(generation, AuthPanelState(user = identity, checkedAt = System.currentTimeMillis(),
            message = if (identity == null) "На сервере нет активного входа." else "Сервер подтвердил вход. Можно проверить облачные данные без их изменения."))
    }

    fun inspectWorkspace() = start("Читаем зашифрованное пространство…") { generation ->
        val payload = withContext(Dispatchers.IO) { client.bootstrap(generation) }
        val identity = AuthProtocol.identity(payload) ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        val preview = withContext(Dispatchers.Default) { CloudWorkspacePreview.inspect(payload) }
        publish(generation, AuthPanelState(user = identity, preview = preview,
            checkedAt = System.currentTimeMillis(), message = if (preview.isEmpty && (preview.tasks ?: 0) == 0)
                "На сайте пока нет данных для загрузки. Локальные записи не менялись."
            else "Облачные данные прочитаны и проверены. Локальные записи не менялись."))
    }

    fun signIn(activity: Activity) = start("Готовим защищённый вход…") { generation ->
        // A fresh server challenge must exist before any provider UI/token request.
        withContext(Dispatchers.IO) { client.session(generation) }
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
        val identity = AuthProtocol.identity(payload) ?: throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        publish(generation, AuthPanelState(user = identity, checkedAt = System.currentTimeMillis(),
            message = "Вход подтверждён сервером. Проверьте облачные данные перед объединением."))
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
        publish(generation, AuthPanelState(message = message + if (providerCleared) "" else " Поставщик Google недоступен для очистки состояния."))
    }

    private fun start(message: String, block: suspend (Long) -> Unit) {
        val generation = client.begin()
        operation?.cancel()
        val previous = mutableState.value
        mutableState.value = AuthPanelState(busy = true, user = previous.user, preview = previous.preview,
            checkedAt = previous.checkedAt, message = message)
        operation = scope.launch {
            fun failed(message: String, retainIdentity: Boolean = true) = publish(generation,
                AuthPanelState(user = previous.user.takeIf { retainIdentity },
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
            } catch (_: GetCredentialException) {
                failed("Google-вход сейчас недоступен на устройстве. Локальные функции доступны.")
            } catch (error: AuthFailure) {
                if (error.kind == AuthFailure.Kind.UNAUTHORIZED) clearCurrent(generation)
                failed(when (error.kind) {
                    AuthFailure.Kind.NOT_DEPLOYED -> "Нативный вход ещё не опубликован на сервере. Локальные функции доступны."
                    AuthFailure.Kind.UNAUTHORIZED -> "Сессия или запрос входа отклонены. Начните вход заново."
                    AuthFailure.Kind.RATE_LIMIT -> "Слишком много попыток. Повторите вход через минуту."
                    AuthFailure.Kind.NETWORK -> "Нет подтверждения от сервера. Проверьте сеть и повторите."
                    AuthFailure.Kind.STORAGE -> "Защищённая сессия на устройстве недоступна. Повторите вход; локальные записи не изменены."
                    AuthFailure.Kind.SERVER -> "Сервер временно не может подтвердить вход. Повторите позже."
                    AuthFailure.Kind.PROTOCOL -> "Ответ сервера не прошёл проверку. Вход не подтверждён."
                }, retainIdentity = error.kind != AuthFailure.Kind.UNAUTHORIZED)
            } catch (_: Exception) {
                clearCurrent(generation)
                failed("Не удалось безопасно подтвердить вход. Локальные записи не изменены.", retainIdentity = false)
            }
        }
    }

    private suspend fun clearCurrent(generation: Long) {
        withContext(Dispatchers.IO) {
            if (client.isCurrent(generation)) try { client.clear(generation) } catch (_: Exception) { /* fail closed in UI */ }
        }
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
