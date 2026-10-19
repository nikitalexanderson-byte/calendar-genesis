package ru.genesis.calendar.auth

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

internal fun sprintMetric(tasks: Int = 10, value: Any = 30): JSONObject = JSONObject().put("tasks", tasks).put("unestimated", 0).put("knownValue", value).put("value", value)
internal fun sprintReportFixture(unit: String = "points"): JSONObject {
    val context = JSONObject().put("version", 2).put("timeZone", "Europe/Moscow").put("gregorianYearStart", "march")
    fun period() = JSONObject().put("startDate", "2026-10-19").put("endDate", "2026-10-25").put("calendarMode", "sacred").put("calendarContext", JSONObject(context.toString()))
    val summary = JSONObject()
    for (key in listOf("plan", "alreadyDone", "committed", "scope", "remaining", "done", "delivered", "carried")) summary.put(key, sprintMetric())
    for (key in listOf("added", "removed")) summary.put(key, sprintMetric(0, 0).apply { remove("value") })
    summary.put("scopeChangeCoverage", "observed").put("estimateDelta", -2).put("unestimatedDelta", -1)
        .put("completionTransitions", 4).put("completedTasksCount", 4).put("reopenedTasksCount", 0)
    val series = JSONArray()
    for (day in 19..20) series.put(JSONObject().put("at", "2026-10-${day}T06:00:00Z").put("date", "2026-10-$day")
        .put("sequence", day - 18).put("firstSequence", day - 18).put("sourceCount", 1).put("sourceKind", "event")
        .put("sourceId", "PRIVATE_AUDIT_ID").put("connectPrevious", day > 19).put("coverage", "observed").put("unknownTasks", 0)
        .put("scope", sprintMetric()).put("remaining", sprintMetric()).put("done", sprintMetric()).put("wip", sprintMetric())
        .put("statuses", JSONObject().put("open", sprintMetric())).put("wipStatuses", JSONObject().put("open", sprintMetric())))
    return JSONObject().put("asOf", "2026-10-20T08:00:00Z").put("projectId", "project")
        .put("sprint", period().put("id", "sprint").put("projectId", "project").put("title", "План команды").put("state", "active").put("privateMember", "PRIVATE_MEMBER"))
        .put("launch", period().put("estimateUnit", "hours"))
        .put("token", "PRIVATE_REPORT_TOKEN")
        .put("statuses", JSONArray().put(JSONObject().put("id", "open").put("title", "В работе").put("color", "#255b59").put("position", 0).put("revision", 1).put("isDone", 0)))
        .put("flow", JSONObject().put("available", true).put("unit", unit).put("resolution", "day").put("timeZone", "Europe/Moscow")
            .put("from", "2026-10-19T06:00:00Z").put("to", "2026-10-20T08:00:00Z").put("terminal", false).put("historyComplete", true)
            .put("scopeChangeCount", 0).put("summary", summary).put("series", series)
            .put("gaps", JSONArray().put(JSONObject().put("reason", "unknown").put("taskId", "PRIVATE_TASK").put("sourceId", "PRIVATE_EVENT"))))
}

class SprintReportProtocolTest {
    @Test fun exportedServerResponsesParseForEveryUnitAndAllSourceKinds() {
        val corpus = javaClass.getResourceAsStream("/sprint-report-server-corpus.json")!!.bufferedReader(Charsets.UTF_8).use { JSONArray(it.readText()) }
        assertEquals(9, corpus.length())
        for (entry in SprintReportProtocol.rows(corpus)) {
            val raw = entry.getJSONObject("report"); val project = raw.getString("projectId"); val sprint = raw.getJSONObject("sprint").getString("id"); val unit = raw.getJSONObject("flow").getString("unit")
            val parsed = SprintReportProtocol.snapshot(project, sprint, unit, raw)
            assertEquals(raw.getJSONObject("flow").getBoolean("available"), parsed.getJSONObject("flow").getBoolean("available"))
            for (kind in listOf("tasks", "events", "changes")) {
                val source = entry.getJSONObject("sources").getJSONObject(kind)
                val page = SprintReportProtocol.sources(parsed, SprintReportProtocol.query(kind, "plan"), source)
                assertEquals(source.getLong("total"), page.getLong("total")); assertEquals(source.getJSONArray("items").length(), page.getJSONArray("items").length())
            }
            assertFalse(SprintReportProtocol.offline(parsed).has("token"))
        }
    }
    private fun report(value: JSONObject = sprintReportFixture(), unit: String = "points") = SprintReportProtocol.snapshot("project", "sprint", unit, value)
    private fun rejected(action: () -> Unit) = assertTrue(runCatching(action).isFailure)
    private fun task(index: Int) = JSONObject().put("id", "task-$index").put("projectId", "current-project").put("title", "Текущая задача $index").put("archived", index % 2 == 0).put("revision", 3)
    private fun page(start: Int, end: Int, total: Int = 131) = JSONObject().put("asOf", "2026-10-20T08:00:00Z")
        .put("items", JSONArray((start until end).map(::task))).put("total", total).put("unavailable", 0).put("nextCursor", if (end < total) "opaque-cursor-$end" else JSONObject.NULL)
    @Test fun zeroNullAndIndependentUnitsKeepTheirMeanings() {
        val raw = sprintReportFixture("hours")
        raw.getJSONObject("flow").getJSONObject("summary").put("delivered", sprintMetric(1, 0))
        raw.getJSONObject("flow").getJSONObject("summary").put("remaining", sprintMetric().put("tasks", JSONObject.NULL).put("value", JSONObject.NULL).put("unknownTasks", 2))
        val result = report(raw, "hours")
        assertEquals("hours", result.getJSONObject("flow").getString("unit"))
        assertEquals(0.0, result.getJSONObject("flow").getJSONObject("summary").getJSONObject("delivered").getDouble("value"), 0.0)
        assertTrue(result.getJSONObject("flow").getJSONObject("summary").getJSONObject("remaining").isNull("value"))
        assertEquals(-2.0, result.getJSONObject("flow").getJSONObject("summary").getDouble("estimateDelta"), 0.0)
    }
    @Test fun projectionDropsPrivateFieldsAndOfflineHasNoTokenOrSourceIdentities() {
        val fresh = report(); assertEquals("PRIVATE_REPORT_TOKEN", fresh.getString("token"))
        assertFalse(fresh.getJSONObject("sprint").has("privateMember"))
        val offline = SprintReportProtocol.offline(fresh)
        assertTrue(offline.getBoolean("offlineCache")); assertFalse(offline.has("token")); assertFalse(offline.toString().contains("PRIVATE_"))
        assertEquals("march", offline.getJSONObject("launch").getJSONObject("calendarContext").getString("gregorianYearStart"))
        assertEquals("sacred", offline.getJSONObject("launch").getString("calendarMode"))
    }
    @Test fun wrongScopeUnitMalformedNumbersAndReversedHistoryAreRejected() {
        rejected { report(sprintReportFixture().put("projectId", "other")) }
        rejected { report(sprintReportFixture("hours")) }
        rejected { report(sprintReportFixture().apply { getJSONObject("sprint").put("id", "other") }) }
        rejected { report(sprintReportFixture().apply { getJSONObject("flow").getJSONObject("summary").getJSONObject("plan").put("tasks", "10") }) }
        rejected { report(sprintReportFixture().apply { getJSONObject("flow").getJSONArray("series").getJSONObject(1).put("at", "2026-10-18T00:00:00Z") }) }
        rejected { SprintReportProtocol.metric(sprintMetric().put("value", -1)) }
        assertEquals(0, SprintReportProtocol.instant("2026-10-19 00:00:00").nano)
    }
    @Test fun partialHistoryAndEmptyPhpMapsNeverInventObservedZeroes() {
        val raw = sprintReportFixture()
        val point = raw.getJSONObject("flow").getJSONArray("series").getJSONObject(1)
        point.put("coverage", "partial").put("unknownTasks", 2).put("connectPrevious", false).put("historyGap", true)
            .put("statuses", JSONArray()).put("wipStatuses", JSONArray())
        val clean = report(raw).getJSONObject("flow").getJSONArray("series").getJSONObject(1)
        assertFalse(clean.getBoolean("connectPrevious")); assertTrue(clean.getBoolean("historyGap")); assertEquals(0, clean.getJSONObject("statuses").length())
        assertTrue(SprintReportProtocol.emptyMetric(false).isNull("value")); assertEquals(0, SprintReportProtocol.emptyMetric(true).getInt("value"))
        rejected { report(raw.apply { point.put("statuses", JSONArray().put(0)) }) }
    }
    @Test fun notStartedAndMissingEvidenceStayUnavailable() {
        val raw = sprintReportFixture().put("flow", JSONObject().put("available", false).put("unit", "points").put("reason", "start-observation-missing"))
        raw.getJSONObject("sprint").put("state", "planning")
        val flow = report(raw).getJSONObject("flow")
        assertFalse(flow.getBoolean("available")); assertTrue(flow.isNull("summary")); assertEquals(0, flow.getJSONArray("series").length())
    }
    @Test fun all131SourcesAppendExactlyAndKeepCurrentProjectAndArchiveFlag() {
        val query = SprintReportProtocol.query("tasks", "plan")
        val first = SprintReportProtocol.sources(report(), query, page(0, 100))
        val complete = SprintReportProtocol.sources(report(), query, page(100, 131), first)
        assertEquals(131, complete.getJSONArray("items").length()); assertTrue(complete.isNull("nextCursor"))
        assertEquals("current-project", complete.getJSONArray("items").getJSONObject(130).getString("projectId"))
        assertTrue(complete.getJSONArray("items").getJSONObject(130).getBoolean("archived"))
    }
    @Test fun repeatedPagesWrongSelectionChangedDateAndPrematureEndAreRejected() {
        val query = SprintReportProtocol.query("tasks", "plan"); val first = SprintReportProtocol.sources(report(), query, page(0, 100))
        rejected { SprintReportProtocol.sources(report(), query, page(0, 31), first) }
        rejected { SprintReportProtocol.sources(report(), SprintReportProtocol.query("tasks", "remaining"), page(100, 131), first) }
        rejected { SprintReportProtocol.sources(report(), query, page(100, 131).put("asOf", "2026-10-20T09:00:00Z"), first) }
        rejected { SprintReportProtocol.sources(report(), query, page(0, 100).put("nextCursor", JSONObject.NULL)) }
        rejected { SprintReportProtocol.sources(SprintReportProtocol.offline(report()), query, page(0, 100)) }
    }
    @Test fun oneEventMayHaveDifferentScopeAndEstimateChangesWithoutLosingEither() {
        val items = JSONArray(listOf("removed", "estimate").map { kind -> JSONObject().put("sourceId", "one-event").put("kind", kind).put("task", task(1)) })
        val page = JSONObject().put("items", items).put("total", 2).put("unavailable", 0).put("asOf", "2026-10-20T08:00:00Z").put("nextCursor", JSONObject.NULL)
        val rows = SprintReportProtocol.sources(report(), SprintReportProtocol.query("changes"), page).getJSONArray("items")
        assertEquals(2, rows.length()); assertNotEquals(rows.getJSONObject(0).getString("id"), rows.getJSONObject(1).getString("id"))
    }
    @Test fun unavailableSourcesCannotCarryPrivateTaskNames() {
        val item = JSONObject().put("id", "event").put("sequence", 1).put("at", "2026-10-19T06:00:00Z").put("action", "task.updated")
            .put("unavailable", true).put("task", task(1).put("title", "PRIVATE_TITLE"))
        val page = JSONObject().put("items", JSONArray().put(item)).put("total", 1).put("unavailable", 1).put("asOf", "2026-10-20T08:00:00Z").put("nextCursor", JSONObject.NULL)
        val clean = SprintReportProtocol.sources(report(), SprintReportProtocol.query("events"), page)
        assertFalse(clean.toString().contains("PRIVATE_TITLE")); assertFalse(clean.getJSONArray("items").getJSONObject(0).has("task"))
    }
    @Test fun sourceSelectionsUseOnlySupportedMetricsAndCivilDates() {
        rejected { SprintReportProtocol.query("tasks", "plan", "2026-10-19") }
        rejected { SprintReportProtocol.query("tasks", "arbitrary") }
        rejected { SprintReportProtocol.query("events", date = "2026-02-30") }
        assertEquals("2026-10-19", SprintReportProtocol.query("events", date = "2026-10-19").getString("date"))
    }
    @Test fun nativeRoutesAllowOnlyTheExactReadOperationsAndArchivedSourceFlag() {
        val project = "11111111-1111-4111-8111-111111111111"; val sprint = "22222222-2222-4222-8222-222222222222"
        val root = "/shared/projects/$project/planning/sprints/$sprint/report"
        for (suffix in listOf("", "/check", "/sources")) {
            assertTrue(allowedSharedRoute("POST", root + suffix))
            for (method in listOf("GET", "PUT", "PATCH", "DELETE")) assertFalse(allowedSharedRoute(method, root + suffix))
        }
        val task = "/shared/projects/$project/tasks/$sprint?archived=true"
        assertTrue(allowedSharedRoute("GET", task)); assertFalse(allowedSharedRoute("POST", task))
        assertFalse(allowedSharedRoute("GET", task + "&token=opaque")); assertFalse(allowedSharedRoute("POST", root + "/other"))
    }
}
