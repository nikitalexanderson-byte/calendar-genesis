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
import ru.genesis.calendar.auth.AuthFailure
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

    @Test fun retriesCasConflictAndPreservesUnrelatedRemoteChange() = runBlocking {
        val scope = CloudAccountSnapshot.scopeFor("synthetic-cas-retry")
        val key = ByteArray(32) { (it + 3).toByte() }
        val cipher = LocalCipher()
        val db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), GenesisDatabase::class.java).build()
        try {
            val base = WorkspacePatch.emptyDocument().put("webOnly", "before")
            val structure = WorkspaceStructureCodec.encode(WorkspaceStructure(projects = listOf(
                GenesisProject("p1", null, "work", "Android edit", "", emptyList(), "active", 0))))
            db.dao().putDocument(DocumentRecord(scope, "cloud-base", cipher.encrypt(base.toString(), "$scope/cloud-base"), 1))
            db.dao().putDocument(DocumentRecord(scope, "structure", cipher.encrypt(structure, "$scope/structure"), 2))
            db.dao().putOutbox(OutboxRecord(scope, "workspace-structure", 2, "op-retry"))
            var version = 1L
            var remote = base
            var writes = 0
            val transport = object : CloudWorkspaceTransport {
                override fun get(): JSONObject {
                    val envelope = WorkspaceCipher.encrypt(remote.toString().toByteArray(), key)
                    return JSONObject().put("workspace", JSONObject().put("keyMode", "account")
                        .put("key", Base64.getEncoder().encodeToString(key))
                        .put("envelope", JSONObject().put("ciphertext", envelope.ciphertext)
                            .put("iv", envelope.iv).put("version", version)))
                }
                override fun put(body: JSONObject): JSONObject {
                    writes++
                    if (writes == 1) {
                        remote = JSONObject(base.toString()).put("webOnly", "web concurrent edit")
                        version++
                        throw AuthFailure(AuthFailure.Kind.CONFLICT)
                    }
                    assertEquals(version, body.getLong("expectedVersion"))
                    val plain = WorkspaceCipher.decrypt(WorkspaceCipher.Envelope(body.getString("ciphertext"),
                        body.getString("iv")), key)
                    remote = JSONObject(plain.toString(Charsets.UTF_8))
                    plain.fill(0)
                    version++
                    return JSONObject().put("workspace", JSONObject().put("version", version))
                }
            }
            assertEquals(1, CloudWorkspaceSync(db, transport).flush(scope))
            assertEquals(2, writes)
            assertEquals("web concurrent edit", remote.getString("webOnly"))
            assertEquals("Android edit", remote.getJSONArray("projects").getJSONObject(0).getString("title"))
            assertTrue(db.dao().outbox(scope).isEmpty())
            assertEquals(version, db.dao().document(scope, "cloud-base")?.revision)
        } finally { db.close() }
    }

    @Test fun sameFieldConflictRetainsEncryptedLocalDraftAndOutbox() = runBlocking {
        val scope = CloudAccountSnapshot.scopeFor("synthetic-same-field-conflict")
        val key = ByteArray(32) { (it + 4).toByte() }
        val cipher = LocalCipher()
        val db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), GenesisDatabase::class.java).build()
        try {
            val base = WorkspacePatch.emptyDocument().put("projects", org.json.JSONArray().put(
                JSONObject().put("id", "p1").put("title", "Original")))
            val remote = JSONObject(base.toString()).put("projects", org.json.JSONArray().put(
                JSONObject().put("id", "p1").put("title", "Web edit")))
            val structure = WorkspaceStructureCodec.encode(WorkspaceStructure(projects = listOf(
                GenesisProject("p1", null, "work", "Android edit", "", emptyList(), "active", 0))))
            db.dao().putDocument(DocumentRecord(scope, "cloud-base", cipher.encrypt(base.toString(), "$scope/cloud-base"), 1))
            db.dao().putDocument(DocumentRecord(scope, "structure", cipher.encrypt(structure, "$scope/structure"), 2))
            db.dao().putOutbox(OutboxRecord(scope, "workspace-structure", 2, "op-conflict"))
            var confirmed: JSONObject? = null
            val transport = object : CloudWorkspaceTransport {
                override fun get(): JSONObject {
                    val envelope = WorkspaceCipher.encrypt(remote.toString().toByteArray(), key)
                    return JSONObject().put("workspace", JSONObject().put("keyMode", "account")
                        .put("key", Base64.getEncoder().encodeToString(key))
                        .put("envelope", JSONObject().put("ciphertext", envelope.ciphertext)
                            .put("iv", envelope.iv).put("version", 2)))
                }
                override fun put(body: JSONObject): JSONObject {
                    assertEquals(2, body.getInt("expectedVersion"))
                    val plain = WorkspaceCipher.decrypt(WorkspaceCipher.Envelope(body.getString("ciphertext"),
                        body.getString("iv")), key)
                    confirmed = JSONObject(plain.toString(Charsets.UTF_8))
                    plain.fill(0)
                    return JSONObject().put("workspace", JSONObject().put("version", 3))
                }
            }
            assertThrows(WorkspacePatch.Conflict::class.java) {
                runBlocking { CloudWorkspaceSync(db, transport).flush(scope) }
            }
            assertEquals(1, db.dao().outbox(scope).size)
            val encrypted = requireNotNull(db.dao().document(scope, "structure"))
            assertFalse(encrypted.encrypted.contains("Android edit"))
            assertEquals("Android edit", WorkspaceStructureCodec.decode(cipher.decrypt(encrypted.encrypted,
                "$scope/structure")).projects.single().title)
            assertEquals(1, CloudWorkspaceSync(db, transport).flush(scope,
                WorkspacePatch.ConflictPolicy.KEEP_LOCAL))
            assertEquals("Android edit", confirmed!!.getJSONArray("projects").getJSONObject(0).getString("title"))
            assertTrue(db.dao().outbox(scope).isEmpty())
        } finally { db.close() }
    }

    @Test fun keepRemoteConflictRefreshesLocalCopyWithoutOverwritingChosenField() = runBlocking {
        val scope = CloudAccountSnapshot.scopeFor("synthetic-keep-remote")
        val key = ByteArray(32) { (it + 7).toByte() }
        val cipher = LocalCipher()
        val db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), GenesisDatabase::class.java).build()
        try {
            val base = WorkspacePatch.emptyDocument().put("projects", org.json.JSONArray().put(
                JSONObject().put("id", "p1").put("title", "Original")))
            val remote = JSONObject(base.toString()).put("projects", org.json.JSONArray().put(
                JSONObject().put("id", "p1").put("title", "Website choice")))
            val structure = WorkspaceStructureCodec.encode(WorkspaceStructure(projects = listOf(
                GenesisProject("p1", null, "work", "Phone choice", "", emptyList(), "active", 0))))
            db.dao().putDocument(DocumentRecord(scope, "cloud-base", cipher.encrypt(base.toString(), "$scope/cloud-base"), 1))
            db.dao().putDocument(DocumentRecord(scope, "structure", cipher.encrypt(structure, "$scope/structure"), 2))
            db.dao().putOutbox(OutboxRecord(scope, "workspace-structure", 2, "op-keep-remote"))
            val transport = object : CloudWorkspaceTransport {
                override fun get(): JSONObject {
                    val envelope = WorkspaceCipher.encrypt(remote.toString().toByteArray(), key)
                    return JSONObject().put("workspace", JSONObject().put("keyMode", "account")
                        .put("key", Base64.getEncoder().encodeToString(key))
                        .put("envelope", JSONObject().put("ciphertext", envelope.ciphertext)
                            .put("iv", envelope.iv).put("version", 2)))
                }
                override fun put(body: JSONObject): JSONObject {
                    val plain = WorkspaceCipher.decrypt(WorkspaceCipher.Envelope(body.getString("ciphertext"),
                        body.getString("iv")), key)
                    val merged = JSONObject(plain.toString(Charsets.UTF_8))
                    plain.fill(0)
                    assertEquals("Website choice", merged.getJSONArray("projects").getJSONObject(0).getString("title"))
                    return JSONObject().put("workspace", JSONObject().put("version", 3))
                }
            }
            assertEquals(1, CloudWorkspaceSync(db, transport).flush(scope,
                WorkspacePatch.ConflictPolicy.KEEP_REMOTE))
            assertTrue(db.dao().outbox(scope).isEmpty())
            val saved = requireNotNull(db.dao().document(scope, "structure"))
            assertEquals("Website choice", WorkspaceStructureCodec.decode(cipher.decrypt(saved.encrypted,
                "$scope/structure")).projects.single().title)
            assertEquals(3L, db.dao().document(scope, "cloud-base")?.revision)
        } finally { db.close() }
    }
}
