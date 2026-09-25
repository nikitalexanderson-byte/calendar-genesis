package ru.genesis.calendar

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.Base64
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import ru.genesis.calendar.auth.CloudAccountSnapshot
import ru.genesis.calendar.auth.CloudWorkspaceSync
import ru.genesis.calendar.auth.CloudWorkspaceTransport
import ru.genesis.calendar.auth.WorkspacePatch
import ru.genesis.calendar.data.*
import ru.genesis.calendar.security.WorkspaceCipher

@RunWith(AndroidJUnit4::class)
class CloudWorkspaceSyncTest {
    @Test fun encryptsCasPatchWithoutLosingWebOnlySections() = runBlocking {
        val scope = CloudAccountSnapshot.scopeFor("synthetic-workspace-account")
        val key = ByteArray(32) { (it + 1).toByte() }
        val cipher = LocalCipher()
        val db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), GenesisDatabase::class.java).build()
        try {
            val base = WorkspacePatch.emptyDocument().put("webOnly", JSONObject().put("preserve", true))
            val original = WorkspaceCipher.encrypt(base.toString().toByteArray(), key)
            val project = GenesisProject("p1", null, "work", "Native project", "", emptyList(), "active", 0)
            val structure = WorkspaceStructureCodec.encode(WorkspaceStructure(projects = listOf(project)))
            db.dao().putDocument(DocumentRecord(scope, "cloud-base", cipher.encrypt(base.toString(), "$scope/cloud-base"), 5))
            db.dao().putDocument(DocumentRecord(scope, "structure", cipher.encrypt(structure, "$scope/structure"), 6))
            db.dao().putOutbox(OutboxRecord(scope, "workspace-structure", 6, "op-structure"))
            var received: JSONObject? = null
            val transport = object : CloudWorkspaceTransport {
                override fun get(): JSONObject = JSONObject().put("workspace", JSONObject()
                    .put("keyMode", "account").put("key", Base64.getEncoder().encodeToString(key))
                    .put("envelope", JSONObject().put("ciphertext", original.ciphertext)
                        .put("iv", original.iv).put("version", 5)))
                override fun put(body: JSONObject): JSONObject {
                    assertEquals(5, body.getLong("expectedVersion"))
                    assertFalse(body.has("metrics"))
                    val bytes = WorkspaceCipher.decrypt(WorkspaceCipher.Envelope(body.getString("ciphertext"),
                        body.getString("iv")), key)
                    received = JSONObject(bytes.toString(Charsets.UTF_8))
                    bytes.fill(0)
                    return JSONObject().put("workspace", JSONObject().put("version", 6))
                }
            }
            assertEquals(1, CloudWorkspaceSync(db, transport).flush(scope))
            assertTrue(db.dao().outbox(scope).isEmpty())
            assertTrue(received!!.getJSONObject("webOnly").getBoolean("preserve"))
            assertEquals("Native project", received!!.getJSONArray("projects").getJSONObject(0).getString("title"))
            assertEquals(6L, db.dao().document(scope, "cloud-base")?.revision)
        } finally { db.close() }
    }
}
