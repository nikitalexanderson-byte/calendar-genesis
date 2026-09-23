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
    val checkedAt: Long? = null,
    val message: String = "Серверная сессия ещё не проверена.",
)

/** Authentication only: it never changes draft workspaceScope or calls bootstrap/sync. */
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
            message = if (identity == null) "На сервере нет активного входа." else "Сервер подтвердил вход. Синхронизация данных ещё не подключена."))
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
            message = "Вход подтверждён сервером. Локальные записи остаются в отдельном пространстве."))
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
        mutableState.value = AuthPanelState(busy = true, message = message)
        operation = scope.launch {
            try {
                block(generation)
            } catch (error: CancellationException) {
                if (client.isCurrent(generation)) publish(generation, AuthPanelState(message = "Проверка входа отменена."))
                throw error
            } catch (_: GetCredentialCancellationException) {
                publish(generation, AuthPanelState(message = "Вход отменён. Локальные записи не изменены."))
            } catch (_: GetCredentialProviderConfigurationException) {
                publish(generation, AuthPanelState(message = "Поставщик входа Google недоступен. Проверьте наличие Google Play services; локальные функции доступны."))
            } catch (_: NoCredentialException) {
                publish(generation, AuthPanelState(message = "Google не предоставил данные для входа. Проверьте аккаунт и настройки OAuth. Локальные функции доступны."))
            } catch (_: GetCredentialException) {
                publish(generation, AuthPanelState(message = "Google-вход сейчас недоступен на устройстве. Локальные функции доступны."))
            } catch (error: AuthFailure) {
                if (error.kind == AuthFailure.Kind.UNAUTHORIZED) clearCurrent(generation)
                publish(generation, AuthPanelState(message = when (error.kind) {
                    AuthFailure.Kind.NOT_DEPLOYED -> "Нативный вход ещё не опубликован на сервере. Локальные функции доступны."
                    AuthFailure.Kind.UNAUTHORIZED -> "Сессия или запрос входа отклонены. Начните вход заново."
                    AuthFailure.Kind.RATE_LIMIT -> "Слишком много попыток. Повторите вход через минуту."
                    AuthFailure.Kind.NETWORK -> "Нет подтверждения от сервера. Проверьте сеть и повторите."
                    AuthFailure.Kind.STORAGE -> "Защищённая сессия на устройстве недоступна. Повторите вход; локальные записи не изменены."
                    AuthFailure.Kind.SERVER -> "Сервер временно не может подтвердить вход. Повторите позже."
                    AuthFailure.Kind.PROTOCOL -> "Ответ сервера не прошёл проверку. Вход не подтверждён."
                }))
            } catch (_: Exception) {
                clearCurrent(generation)
                publish(generation, AuthPanelState(message = "Не удалось безопасно подтвердить вход. Локальные записи не изменены."))
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
