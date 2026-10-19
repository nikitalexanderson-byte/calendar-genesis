package ru.genesis.calendar.auth

import org.json.JSONObject
import java.util.UUID

/** Shared workspace operations implemented by the authenticated controller. */
interface SharedWorkspaceGateway {
    suspend fun acceptSharedInvitation(id: String): JSONObject = throw UnsupportedOperationException("acceptSharedInvitation")
    suspend fun addSharedComment(projectId: String, taskId: String, body: String): JSONObject = throw UnsupportedOperationException("addSharedComment")
    suspend fun archivedSharedProjects(spaceId: String): JSONObject = throw UnsupportedOperationException("archivedSharedProjects")
    suspend fun changeSharedMemberRole(projectId: String, userId: String, role: String): JSONObject = throw UnsupportedOperationException("changeSharedMemberRole")
    suspend fun changeSharedSpaceRole(spaceId: String, userId: String, role: String,
        canOrganizeTasks: Boolean? = null): JSONObject = throw UnsupportedOperationException("changeSharedSpaceRole")
    suspend fun createSharedCategory(projectId: String, title: String, color: String): JSONObject = throw UnsupportedOperationException("createSharedCategory")
    suspend fun createSharedProject(spaceId: String, title: String, description: String, layout: String,
        parentId: String? = null, kind: String = "project", boardStatusId: String? = null): JSONObject = throw UnsupportedOperationException("createSharedProject")
    suspend fun createSharedSpace(title: String): JSONObject = throw UnsupportedOperationException("createSharedSpace")
    suspend fun createSharedStatus(projectId: String, title: String, isDone: Boolean,
        requestId: String = UUID.randomUUID().toString()): JSONObject = throw UnsupportedOperationException("createSharedStatus")
    suspend fun createSharedTask(projectId: String, title: String, statusId: String,
        categoryId: String? = null): JSONObject = throw UnsupportedOperationException("createSharedTask")
    suspend fun createSharedTask(projectId: String, fields: JSONObject): JSONObject = throw UnsupportedOperationException("createSharedTask")
    suspend fun deleteSharedCategory(projectId: String, categoryId: String, revision: Int): JSONObject = throw UnsupportedOperationException("deleteSharedCategory")
    suspend fun deleteSharedStatus(projectId: String, statusId: String, destinationId: String, revision: Int): JSONObject = throw UnsupportedOperationException("deleteSharedStatus")
    suspend fun discardFailedSharedMutation(requestId: String): Unit = throw UnsupportedOperationException("discardFailedSharedMutation")
    suspend fun retryFailedSharedMutation(requestId: String): JSONObject = throw UnsupportedOperationException("retryFailedSharedMutation")
    suspend fun flushSharedOfflineTasks(): Int = throw UnsupportedOperationException("flushSharedOfflineTasks")
    suspend fun inviteSharedSpaceMember(spaceId: String, email: String, role: String): JSONObject = throw UnsupportedOperationException("inviteSharedSpaceMember")
    suspend fun moveSharedTask(projectId: String, taskId: String, changes: JSONObject): JSONObject = throw UnsupportedOperationException("moveSharedTask")
    suspend fun queuedSharedTasks(projectId: String): List<JSONObject> = throw UnsupportedOperationException("queuedSharedTasks")
    suspend fun rejectSharedInvitation(id: String): JSONObject = throw UnsupportedOperationException("rejectSharedInvitation")
    suspend fun removeSharedMember(projectId: String, userId: String): JSONObject = throw UnsupportedOperationException("removeSharedMember")
    suspend fun saveSharedSpaceUi(spaceId: String, ids: List<String>): JSONObject = throw UnsupportedOperationException("saveSharedSpaceUi")
    suspend fun setSharedProjectArchived(projectId: String, archived: Boolean): JSONObject = throw UnsupportedOperationException("setSharedProjectArchived")
    suspend fun sharedComments(projectId: String, taskId: String): JSONObject = throw UnsupportedOperationException("sharedComments")
    suspend fun sharedGoogleSettings(projectId: String): JSONObject = throw UnsupportedOperationException("sharedGoogleSettings")
    suspend fun sharedInvitations(): JSONObject = throw UnsupportedOperationException("sharedInvitations")
    suspend fun querySharedTasks(filter: JSONObject, cursor: String? = null): JSONObject = throw UnsupportedOperationException("querySharedTasks")
    suspend fun sortedSharedTasks(filter:JSONObject,cursor:String?=null,sort:String="position"):JSONObject=querySharedTasks(filter,cursor)
    suspend fun readSharedTaskUpdates(projectId:String,taskId:String,commentIds:List<String>):JSONObject=throw UnsupportedOperationException("readSharedTaskUpdates")
    suspend fun notificationSettings():JSONObject=throw UnsupportedOperationException("notificationSettings")
    suspend fun saveNotificationSettings(settings:JSONObject,revision:Int):JSONObject=throw UnsupportedOperationException("saveNotificationSettings")
    suspend fun sharedTask(projectId: String, taskId: String): JSONObject = throw UnsupportedOperationException("sharedTask")
    suspend fun sharedProject(projectId: String): JSONObject = throw UnsupportedOperationException("sharedProject")
    suspend fun sharedProjects(spaceId: String): JSONObject = throw UnsupportedOperationException("sharedProjects")
    suspend fun sharedSpaceUi(spaceId: String): JSONObject = throw UnsupportedOperationException("sharedSpaceUi")
    suspend fun sharedSpaces(): JSONObject = throw UnsupportedOperationException("sharedSpaces")
    suspend fun syncSharedGoogle(projectId: String): JSONObject = throw UnsupportedOperationException("syncSharedGoogle")
    suspend fun updateSharedBoard(projectId: String, statusId: String, changes: JSONObject): JSONObject = throw UnsupportedOperationException("updateSharedBoard")
    suspend fun updateSharedCategory(projectId: String, categoryId: String,
        title: String, color: String, revision: Int): JSONObject = throw UnsupportedOperationException("updateSharedCategory")
    suspend fun updateSharedGoogleSettings(projectId: String, tasksEnabled: Boolean, calendarEnabled: Boolean): JSONObject = throw UnsupportedOperationException("updateSharedGoogleSettings")
    suspend fun updateSharedProject(projectId: String, changes: JSONObject): JSONObject = throw UnsupportedOperationException("updateSharedProject")
    suspend fun updateSharedTask(projectId: String, taskId: String, changes: JSONObject): JSONObject = throw UnsupportedOperationException("updateSharedTask")
}
