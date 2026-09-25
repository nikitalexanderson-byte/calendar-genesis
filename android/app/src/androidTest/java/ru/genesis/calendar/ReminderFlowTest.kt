package ru.genesis.calendar

import android.app.NotificationManager
import android.content.Context
import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import ru.genesis.calendar.data.*

/** These synthetic records exist only in androidTest and the .debug validation scope. */
@RunWith(AndroidJUnit4::class)
class ReminderFlowTest {
    private val app get() = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
    private val fixtureId = "internal-reminder-validation-v1"

    @Test fun prepareScreenOffReminder() = runBlocking {
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        check(app.scheduler.notificationsAllowed()) { "Notification permission must be granted first" }
        check(app.scheduler.exactAllowed()) { "Exact alarm access must be granted first" }
        val old = app.repository.get(fixtureId)
        val task = app.repository.save(LocalTask(id=fixtureId,title="Изолированный тест напоминания",
            description="Синтетическая запись androidTest, не данные аккаунта",reminderAt=System.currentTimeMillis()+90_000,
            revision=old?.revision ?: 0))
        val independent = Room.databaseBuilder(app,GenesisDatabase::class.java,"genesis.db").build()
        try {
            val record = independent.dao().task(app.workspaceScope,fixtureId)!!
            assertFalse(record.encrypted.contains(task.title))
            assertEquals(task.title, LocalTask.from(record,LocalCipher().decrypt(record.encrypted,
                app.workspaceScope + "/" + fixtureId)).title)
        } finally { independent.close() }
        val row=app.database.dao().taskReminders(app.workspaceScope,fixtureId).single { it.state=="pending" }
        assertEquals(task.reminderAt,row.at)
    }

    @Test fun verifyDeliveredAndCompleteAction() = runBlocking {
        val row=app.database.dao().taskReminders(app.workspaceScope,fixtureId).single()
        assertEquals("delivered",row.state)
        assertNotNull(row.deliveredAt)
        assertTrue("Alarm should arrive after due time",row.deliveredAt!! >= row.at - 1000)
        val manager=app.getSystemService(NotificationManager::class.java)
        val notification=manager.activeNotifications.single { it.tag == app.workspaceScope + "/" + row.id }
        assertEquals("Время запланированного действия",notification.notification.extras.getCharSequence("android.text").toString())
        val action=notification.notification.actions.first { it.title.toString()=="Выполнено" }.actionIntent
        action.send()
        repeat(40) {
            if(app.repository.get(fixtureId)?.done==true) return@repeat
            Thread.sleep(100)
        }
        assertTrue(app.repository.get(fixtureId)!!.done)
        val revision=app.repository.get(fixtureId)!!.revision
        action.send()
        Thread.sleep(300)
        assertEquals(revision,app.repository.get(fixtureId)!!.revision)
        assertEquals("cancelled",app.database.dao().taskReminders(app.workspaceScope,fixtureId).single().state)
        assertTrue(manager.activeNotifications.none { it.tag==notification.tag })
    }

    @Test fun notificationOpensTheStoredRecord() = runBlocking {
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        check(!app.getSystemService(android.app.KeyguardManager::class.java).isKeyguardLocked) {
            "Unlock device manually before the notification-opening test"
        }
        // This tests system-notification navigation, not delayed AlarmManager delivery.
        // Keep it independent of the screen-off test and its completed fixture.
        val openId="internal-open-validation-v1"
        val old=app.repository.get(openId)
        app.repository.save(LocalTask(id=openId,title="Изолированный тест открытия",
            reminderAt=System.currentTimeMillis()-1000,revision=old?.revision ?: 0))
        val opening=app.database.dao().taskReminders(app.workspaceScope,openId).single()
        app.scheduler.deliver(opening.scope,opening.id,opening.revision)
        val row=app.database.dao().taskReminders(app.workspaceScope,openId).single()
        assertEquals("delivered",row.state)
        val notification=app.getSystemService(NotificationManager::class.java).activeNotifications.single {
            it.tag==app.workspaceScope + "/" + row.id
        }
        val device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        check(!app.getSystemService(android.app.KeyguardManager::class.java).isKeyguardLocked) {
            "Unlock device manually before the notification-opening test"
        }
        device.openNotification()
        val visible=device.wait(Until.findObject(By.text("Время запланированного действия")),5000)
        assertNotNull("The actual system notification is visible",visible)
        visible.click()
        assertTrue("Notification opens the exact record",device.wait(Until.hasObject(By.text("Изолированный тест открытия")),10_000))
        assertTrue(device.hasObject(By.text("Изменить задачу")))
        app.repository.complete(openId)
    }

    @Test fun notificationChannelDiagnostics() = runBlocking {
        val manager=app.getSystemService(NotificationManager::class.java)
        val channel=manager.getNotificationChannel(ru.genesis.calendar.reminders.ReminderScheduler.TASK_CHANNEL)
        val audio=app.getSystemService(android.media.AudioManager::class.java)
        fun report(text:String) { InstrumentationRegistry.getInstrumentation().sendStatus(0,
            android.os.Bundle().apply { putString("stream","\n$text\n") }) }
        report("GENESIS channel importance=${channel.importance}, soundConfigured=${channel.sound!=null}, vibration=${channel.shouldVibrate()}, DNDfilter=${manager.currentInterruptionFilter}")
        report("GENESIS notification volume=${audio.getStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION)}, ringerMode=${audio.ringerMode}, globalSoundConfigured=${!android.provider.Settings.System.getString(app.contentResolver,android.provider.Settings.System.NOTIFICATION_SOUND).isNullOrBlank()}")
        val row=app.database.dao().taskReminders(app.workspaceScope,fixtureId).singleOrNull()
        report("GENESIS synthetic alarm state=${row?.state}, delayMs=${row?.deliveredAt?.minus(row.at)}")
        assertTrue(app.scheduler.notificationsAllowed())
        assertTrue(app.scheduler.exactAllowed())
        assertTrue(channel.importance>=NotificationManager.IMPORTANCE_DEFAULT)
        assertNotNull(channel.sound)
    }

    @Test fun persistedCompletionSurvivesFreshProcess() = runBlocking {
        assertTrue(app.repository.get(fixtureId)!!.done)
        val row=app.database.dao().taskReminders(app.workspaceScope,fixtureId).single()
        assertEquals("cancelled",row.state)
        app.scheduler.restore()
        app.scheduler.deliver(row.scope,row.id,row.revision-1)
        assertTrue(app.getSystemService(NotificationManager::class.java).activeNotifications.none {
            it.tag==row.scope + "/" + row.id
        })
    }

    @Test fun snoozeAndStaleVersionAreIdempotent() = runBlocking {
        val id="internal-snooze-validation-v1"
        val old=app.repository.get(id)
        val task=app.repository.save(LocalTask(id=id,title="Изолированный тест отложения",
            reminderAt=System.currentTimeMillis()-1000,revision=old?.revision?:0))
        val row=app.database.dao().taskReminders(app.workspaceScope,id).single()
        app.scheduler.deliver(row.scope,row.id,row.revision)
        assertTrue(app.repository.snooze(row.id,row.revision))
        assertFalse(app.repository.snooze(row.id,row.revision))
        val next=app.database.dao().taskReminders(app.workspaceScope,id).single()
        assertTrue(next.revision>task.revision)
        assertTrue(next.at>System.currentTimeMillis())
        app.scheduler.deliver(row.scope,row.id,row.revision)
        assertEquals("pending",app.database.dao().reminder(row.scope,row.id)!!.state)
        app.repository.complete(id)
        assertEquals("cancelled",app.database.dao().reminder(row.scope,row.id)!!.state)
    }
}
