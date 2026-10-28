package ru.genesis.calendar.ui

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import ru.genesis.calendar.data.MindmapDocument

class MindmapPresentationTest {
    @Test fun iconRoundTripPreservesTheWebPresentationAndUnknownFields() {
        val map = MindmapDocument.new("Map")
        val original = map.nodes.single().copy(extensions = """{"presentation":{"width":320,"align":"center","image":{"data":"existing"}},"tags":["keep"]}""")
        val chosen = original.withMindmapIcon("lightbulb")
        val decoded = MindmapDocument.parse(map.copy(nodes = listOf(chosen)).json()).nodes.single()
        assertEquals("lightbulb", decoded.mindmapIcon())
        val cleared = decoded.withMindmapIcon(null)
        assertNull(cleared.mindmapIcon())
        assertEquals(320, JSONObject(cleared.extensions).getJSONObject("presentation").getInt("width"))
        assertEquals("existing", JSONObject(cleared.extensions).getJSONObject("presentation").getJSONObject("image").getString("data"))
        assertEquals("keep", JSONObject(cleared.extensions).getJSONArray("tags").getString(0))
    }
}
