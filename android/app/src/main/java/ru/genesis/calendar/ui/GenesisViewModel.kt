package ru.genesis.calendar.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.LocalTask

class GenesisViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as GenesisApplication
    val error = MutableStateFlow<String?>(null)
    val tasks = app.repository.tasks.catch { error.value = "Не удалось открыть защищённые данные: ключ недоступен." }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    fun save(task: LocalTask, onSaved: () -> Unit) = viewModelScope.launch {
        try { app.repository.save(task); error.value = null; onSaved() }
        catch (e: IllegalArgumentException) { error.value = e.message ?: "Проверьте данные задачи." }
        catch (_: Exception) { error.value = "Не удалось сохранить. Введённые данные остаются в форме." }
    }
    fun complete(task: LocalTask) = save(task.copy(done = !task.done)) {}
    fun delete(task: LocalTask) = viewModelScope.launch {
        try { app.repository.delete(task.id, task.revision); error.value = null }
        catch(e: CancellationException) { throw e }
        catch(e: IllegalArgumentException) { error.value = e.message ?: "Запись изменилась. Откройте её заново." }
        catch(_: Exception) { error.value = "Не удалось удалить задачу. Повторите попытку." }
    }
    fun excludeOccurrence(task: LocalTask, date: String, onSaved: () -> Unit) = viewModelScope.launch {
        try { app.repository.excludeOccurrence(task.id, task.revision, date); error.value = null; onSaved() }
        catch (e: IllegalArgumentException) { error.value = e.message ?: "Проверьте дату повторения." }
        catch (_: Exception) { error.value = "Не удалось удалить это повторение." }
    }
}
