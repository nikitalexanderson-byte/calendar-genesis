package ru.genesis.calendar.data

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import ru.genesis.calendar.security.WorkspaceCipher

class MindmapDocumentTest {
    @Test fun webDocumentRoundtripAndTaskIdentity() {
        val map=MindmapDocument.new("Проверка",template="project")
        val thought=map.nodes[1];val ref=thought.copy(kind="task",text="",refId=map.taskId(thought.id))
        val linked=map.copy(nodes=map.nodes.map {if(it.id==thought.id)ref else it})
        assertEquals(linked.json().toString(),MindmapDocument.parse(linked.json()).json().toString())
        assertEquals(linked.taskId(thought.id),map.taskId(thought.id))
        assertTrue(map.taskId(thought.id).matches(Regex("maptask-[a-f0-9]{64}")))
        assertFalse(linked.json().toString().contains("dueDate"))
        assertFalse(linked.remove(ref.id).nodes.any {it.id==ref.id})
        assertEquals(ref.refId,linked.nodes[1].refId)
    }
    @Test fun graphsRejectCyclesOrphansFutureVersionsAndUnsafeColors() {
        val map=MindmapDocument.new("Замысел",template="idea")
        listOf(
            map.json().put("schemaVersion",2),
            map.json().apply {getJSONArray("nodes").getJSONObject(0).put("parentId",map.nodes[1].id)},
            map.json().apply {getJSONArray("nodes").getJSONObject(1).put("parentId","missing")},
            map.json().apply {getJSONArray("nodes").getJSONObject(1).put("style",JSONObject().put("fill","url(unsafe)"))}
        ).forEach {assertThrows(IllegalArgumentException::class.java) {MindmapDocument.parse(it)}}
        assertThrows(IllegalArgumentException::class.java) {map.move(map.nodes[1].id,map.nodes[1].id)}
    }
    @Test fun personalCipherBindsOwnerAndMapAndPreservesWorkspaceCompatibility() {
        val key=ByteArray(32){it.toByte()};val plain=MindmapDocument.new("Текст карты").json().toString().toByteArray()
        val aad="genesis-mindmap-v1:owner:map:map-one".toByteArray()
        val encrypted=WorkspaceCipher.encrypt(plain,key,aad)
        assertArrayEquals(plain,WorkspaceCipher.decrypt(encrypted,key,aad))
        assertThrows(java.security.GeneralSecurityException::class.java) {WorkspaceCipher.decrypt(encrypted,key,"genesis-mindmap-v1:other:map:map-one".toByteArray())}
        assertThrows(java.security.GeneralSecurityException::class.java) {WorkspaceCipher.decrypt(encrypted,key,"genesis-mindmap-v1:owner:map:other".toByteArray())}
        val old=WorkspaceCipher.encrypt(plain,key);assertArrayEquals(plain,WorkspaceCipher.decrypt(old,key))
    }
}
