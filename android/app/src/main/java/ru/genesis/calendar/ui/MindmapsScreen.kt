package ru.genesis.calendar.ui

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.zIndex
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.util.UUID
import ru.genesis.calendar.data.*
import kotlin.math.roundToInt

/** Native views read the same encrypted documents and reference ordinary task/project rows. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun MindmapsScreen(repo:MindmapRepository,tasks:List<LocalTask>,projects:List<GenesisProject>,projectId:String?,onBack:()->Unit,
    onTask:(LocalTask,String?)->Unit,onCreate:(LocalTask)->Unit,onComplete:(LocalTask,String?)->Unit,onProject:(String)->Unit) {
    val records by repo.records.collectAsState();val scope=rememberCoroutineScope()
    val mapContext=LocalContext.current;val mapLanguage=LocalGenesisLanguage.current
    fun defaultLabel(source:String)=translateGenesisText(mapContext,source,mapLanguage)
    var mapId by rememberSaveable { mutableStateOf<String?>(null) };var selected by rememberSaveable { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) };var busy by remember { mutableStateOf(false) };var query by rememberSaveable { mutableStateOf("") }
    var archived by rememberSaveable { mutableStateOf(false) };var create by rememberSaveable { mutableStateOf(false) };var title by rememberSaveable { mutableStateOf("") };var description by rememberSaveable {mutableStateOf("")}
    var editing by remember { mutableStateOf<MindmapNode?>(null) };var text by rememberSaveable { mutableStateOf("") };var note by rememberSaveable { mutableStateOf("") }
    var occurrenceTask by remember {mutableStateOf<LocalTask?>(null)};var occurrenceDate by rememberSaveable {mutableStateOf("")}
    var remove by remember { mutableStateOf(false) };var picker by remember { mutableStateOf(false) };var files by remember { mutableStateOf(false) }
    var parent by rememberSaveable {mutableStateOf("")};var template by rememberSaveable {mutableStateOf("empty")}
    var serverPreview by remember {mutableStateOf(false)}
    var history by remember { mutableStateOf<List<NativeMapRecord>?>(null) };var import by remember { mutableStateOf(false) };var export by remember { mutableStateOf(false) }
    var view by remember { mutableStateOf(JSONObject().put("mode","structure").put("zoom",1.0)) };var undo by remember { mutableStateOf<List<MindmapDocument>>(emptyList()) }
    val record=records.firstOrNull { it.document.id==mapId };val map=record?.document;val node=map?.nodes?.firstOrNull { it.id==selected } ?: map?.nodes?.firstOrNull()
    fun run(action:suspend ()->Unit) { if(busy)return;busy=true;error=null;scope.launch {try { action() }catch(e:Exception){error=e.message ?: "Не удалось сохранить. Черновик остаётся на устройстве."}finally{busy=false} } }
    fun save(next:MindmapDocument,remember:Boolean=true) { if(busy)return;if(remember&&map!=null)undo=(undo+map).takeLast(20);run { repo.save(next) } }
    fun open(id:String) {mapId=id;selected=null;undo=emptyList();query="";scope.launch { view=repo.view(id) ?: JSONObject().put("mode","structure").put("zoom",1.0) } }
    fun changeView(next:JSONObject) {view=next;mapId?.let { id->scope.launch { repo.saveView(id,next) } } }
    fun add(sibling:Boolean=false,point:Offset?=null) {if(map==null||node==null)return;val next=MindmapNode(UUID.randomUUID().toString(),if(sibling)node.parentId ?: node.id else node.id,text=defaultLabel("Новая мысль"))
        selected=next.id;text=next.text;note="";editing=next;save(map.copy(nodes=map.nodes+next));if(point!=null) {val v=JSONObject(view.toString());val positions=v.optJSONObject("positions") ?: JSONObject();positions.put(next.id,JSONObject().put("x",point.x).put("y",point.y));changeView(v.put("positions",positions))} }
    fun linkedTask(n:MindmapNode):LocalTask? {
        if(n.kind!="task")return null
        val exception=n.occurrenceDate?.let {date->tasks.firstOrNull {val source=JSONObject(it.sourceFieldsJson);source.optString("recurrenceSeriesId")==n.refId&&source.optString("recurrenceOriginalDate",it.date)==date}}
        if(exception!=null)return exception
        val original=tasks.firstOrNull {it.id==n.refId} ?: return null
        if(original.recurrence.enabled&&(n.occurrenceDate==null||!TaskOccurrences.occursOn(original,java.time.LocalDate.parse(n.occurrenceDate))))return null
        return original
    }
    fun label(n:MindmapNode)=when(n.kind) {"task"->linkedTask(n)?.title ?: "Задача недоступна";"project"->projects.firstOrNull { it.id==n.refId }?.title ?: "Проект недоступен";else->n.text }
    val context=LocalContext.current
    val outlineTitle=genesisTranslate("Структура карты")
    var pdfSnapshot by remember {mutableStateOf<Triple<MindmapDocument,Map<String,String>,JSONObject>?>(null)}
    val pdfLauncher=rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/pdf")) {uri->
        val snapshot=pdfSnapshot;pdfSnapshot=null
        if(uri!=null&&snapshot!=null)run {withContext(Dispatchers.IO){context.contentResolver.openOutputStream(uri)?.use {writeMindmapPdf(it,snapshot.first,snapshot.second,snapshot.third,outlineTitle)} ?: error("Не удалось открыть файл PDF.")}}
    }
    LaunchedEffect(repo) { runCatching { repo.loadCached() };runCatching { repo.refresh() }.onFailure { error=it.message ?: "Открыта защищённая копия устройства." } }
    BackHandler {if(editing!=null)editing=null else if(mapId!=null)mapId=null else onBack()}
    Column(Modifier.fillMaxSize().padding(16.dp).testTag("mindmaps-screen"),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {Text(map?.title ?: "Майндмепы",Modifier.weight(1f),style=MaterialTheme.typography.headlineSmall)
            MapIconButton(if(mapId==null)"К личным делам" else "Все майндмепы",10,{if(mapId==null)onBack() else mapId=null}) }
        error?.let { Text(it,color=MaterialTheme.colorScheme.error);if(map!=null)Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            TextButton(enabled=!busy,onClick={run { repo.retry(map.id) }}){Text("Повторить сохранение")}
            TextButton(enabled=!busy,onClick={run {open(repo.fork(map).id)}}){Text("Сохранить отдельную карту")}
            TextButton(enabled=!busy,onClick={run { serverPreview=true;history=listOf(repo.serverVersion(map.id)) }}){Text("Серверная версия")}
        } }
        if(map==null) {
            OutlinedTextField(query,{query=it},Modifier.fillMaxWidth(),label={Text("Поиск карт")},singleLine=true)
            FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) {Button(enabled=!busy,onClick={title="";template="empty";create=true}){Text("Создать карту")};TextButton(onClick={archived=!archived}){Text(if(archived)"Текущие" else "Архив")};TextButton(onClick={text="";import=true}){Text("Импорт JSON")};TextButton(onClick={run {repo.refresh()}}){Text("Обновить")} }
            LazyColumn(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                items(records.filter {it.document.archived==archived&&(projectId==null||it.document.projectId==projectId)&&it.document.title.contains(query,true)}.sortedByDescending { it.document.pinned },key={it.document.id}) { r->
                    Surface(shape=MaterialTheme.shapes.medium,color=MaterialTheme.colorScheme.surfaceContainerLow) {Column(Modifier.fillMaxWidth().padding(16.dp)) {
                        TextButton(onClick={open(r.document.id)},Modifier.fillMaxWidth().testTag("mindmap-open-${r.document.id}")){Text(r.document.title,style=MaterialTheme.typography.titleLarge)}
                        Text("${r.document.nodes.size} узлов · "+if(r.unsynced)"Черновик на устройстве" else "Версия ${r.revision}")
                        Text(projects.firstOrNull {it.id==r.document.projectId}?.title ?: "Без проекта")
                        Row {TextButton(onClick={save(r.document.copy(pinned=!r.document.pinned))}){Text(if(r.document.pinned)"Открепить" else "Закрепить")};TextButton(onClick={save(r.document.copy(archived=!r.document.archived))}){Text(if(archived)"Восстановить" else "Архивировать")} }
                    }}
                }
            }
        } else {
            if(map.description.isNotBlank()) Text(map.description)
            val refs=map.nodes.mapNotNull { n->linkedTask(n)?.let { t->(t.id+(n.occurrenceDate ?: "")) to t } }.toMap().values;Text("Связанные задачи: ${refs.count {it.done}} из ${refs.size} · "+if(record.unsynced)"Сохранено на устройстве" else "Синхронизировано")
            Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                MapIconButton("Карта",0,{changeView(JSONObject(view.toString()).put("mode","map"))})
                MapIconButton("Структура",1,{changeView(JSONObject(view.toString()).put("mode","structure"))})
                Button(enabled=!busy,onClick={add()}){Text("Добавить мысль")};OutlinedButton(onClick={picker=true}){Text("Добавить из дел")};OutlinedButton(onClick={files=!files}){Text("Карта и файлы")}
            }
            if(files) Row(Modifier.horizontalScroll(rememberScrollState())) {TextButton(enabled=undo.isNotEmpty()&&!busy,onClick={val old=undo.last();undo=undo.dropLast(1);save(old,false)}){Text("Отменить")};TextButton(onClick={run {serverPreview=false;history=repo.history(map.id)}}){Text("История")};TextButton(onClick={text=JSONObject().put("format","genesis-mindmap").put("version",1).put("document",map.json()).toString(2);export=true}){Text("Экспорт JSON")};TextButton(enabled=!busy,onClick={pdfSnapshot=Triple(map,map.nodes.associate {it.id to label(it)},JSONObject(view.toString()));pdfLauncher.launch("GENESIS-map.pdf")}){Text("Экспорт PDF")};TextButton(onClick={title=map.title;description=map.description;create=true}){Text("Название карты")} }
            if(view.optString("focus").isNotBlank()&&view.optString("focus")!="null")TextButton(onClick={changeView(JSONObject(view.toString()).removeFocus())}){Text("Вся карта")}
            OutlinedTextField(query,{query=it},Modifier.fillMaxWidth(),label={Text("Найти узел")},singleLine=true)
            val collapsed=view.optJSONArray("collapsed")?.let { a->(0 until a.length()).map {a.optString(it)}.toSet() } ?: emptySet()
            val rows=map.rows(collapsed,view.optString("focus").takeIf {it.isNotBlank()&&it!="null"})
            if(view.optString("mode")=="map") NativeMindmapCanvas(map,rows,view,::label,{id->selected=id;text=map.nodes.first {it.id==id}.text;note=map.nodes.first {it.id==id}.note;editing=map.nodes.first {it.id==id}},::changeView,{add(point=it)},{from,to->if(!map.links.any {it.from==from&&it.to==to||it.from==to&&it.to==from})save(map.copy(links=map.links+MindmapLink(UUID.randomUUID().toString(),from,to,"Связано с")))},Modifier.weight(1f))
            else LazyColumn(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {items(rows.filter {label(it.first).contains(query,true)||it.first.note.contains(query,true)},key={it.first.id}) { (n,depth)->
                Row(Modifier.fillMaxWidth().padding(start=(depth.coerceAtMost(3)*12).dp).background(mapColor(n.style?.optString("fill"),MaterialTheme.colorScheme.surface),MaterialTheme.shapes.small).border(1.dp,mapColor(n.style?.optString("border"),MaterialTheme.colorScheme.outlineVariant),MaterialTheme.shapes.small),verticalAlignment=Alignment.CenterVertically) {
                    if(map.nodes.any {it.parentId==n.id}) TextButton(onClick={val next=collapsed.toMutableSet();if(!next.add(n.id))next.remove(n.id);changeView(JSONObject(view.toString()).put("collapsed",org.json.JSONArray(next.toList())))}){Text(if(n.id in collapsed)"＋" else "−")}
                    TextButton(onClick={selected=n.id;text=n.text;note=n.note;editing=n},modifier=Modifier.weight(1f).testTag("mindmap-node-${n.id}")){Column {Text(label(n),color=n.style?.optString("fill")?.takeIf {it.isNotBlank()}?.let {if(mapColor(it,Color.White).luminance()>.179f)Color.Black else Color.White} ?: Color.Unspecified);Text(when(n.kind){"task"->if(linkedTask(n)?.done==true)"Выполнено" else "Задача GENESIS";"project"->"Проект GENESIS";else->"Мысль"},style=MaterialTheme.typography.bodySmall)} }
                }
            } }
        }
    }
    if(create) AlertDialog(onDismissRequest={create=false},title={Text(if(map==null)"Новая карта" else "Настройка карты")},text={Column {OutlinedTextField(title,{title=it},label={Text("Название карты")});OutlinedTextField(description,{description=it.take(12000)},label={Text("Описание")});if(map==null)FlowRow {listOf("empty" to "Пустая карта","idea" to "Идея","project" to "Проект","decision" to "Решение").forEach {(id,label)->FilterChip(selected=template==id,onClick={template=id},label={Text(label)})}}}},confirmButton={TextButton(enabled=title.isNotBlank()&&!busy,onClick={if(map==null){val next=MindmapDocument.new(title,projectId,template,::defaultLabel).copy(description=description);save(next);open(next.id)}else save(map.copy(title=title.trim(),description=description));create=false}){Text("Сохранить")}},dismissButton={TextButton(onClick={create=false}){Text("Отмена")}})
    if(editing!=null&&map!=null&&node!=null) AlertDialog(onDismissRequest={editing=null},title={Text(label(node))},text={Column(Modifier.verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)) {
        if(node.kind=="idea")OutlinedTextField(text,{text=it},label={Text("Название мысли")},modifier=Modifier.testTag("mindmap-node-text"))
        OutlinedTextField(note,{note=it},label={Text("Пояснение · только в карте")})
        if(node.kind=="idea")Button(enabled=!busy,onClick={val taskId=map.taskId(node.id);val task=tasks.firstOrNull {it.id==taskId};editing=null;if(task!=null){save(map.copy(nodes=map.nodes.map {if(it.id==node.id)it.copy(kind="task",refId=task.id,text="") else it}));onTask(task,null)}else {val draft=LocalTask(id=taskId,title=text.trim().ifBlank {node.text}.take(500),date="",projectId=map.projectId,sourceFieldsJson=JSONObject().put("mindmapCreateOnly",true).toString());run {repo.save(map.copy(nodes=map.nodes.map {if(it.id==node.id)it.copy(text=text,note=note) else it}));onCreate(draft)}} }){Text("Создать задачу из мысли")}
        linkedTask(node)?.let { task->TextButton(onClick={editing=null;onTask(task,node.occurrenceDate)}){Text("Открыть карточку задачи")};TextButton(onClick={onComplete(task,node.occurrenceDate)}){Text(if(task.done)"Вернуть задачу" else "Выполнить задачу")} }
        if(node.kind=="project"&&projects.any {it.id==node.refId})TextButton(onClick={editing=null;onProject(node.refId!!)}){Text("Открыть проект")}
        FlowRow {
            MapIconButton("Добавить дочернюю мысль",2,{editing=null;add()},!busy)
            MapIconButton("Добавить соседнюю мысль",3,{editing=null;add(true)},!busy)
            MapIconButton("Добавить из дел",4,{editing=null;picker=true})
            MapIconButton("Фокус на ветке",5,{changeView(JSONObject(view.toString()).put("focus",node.id));editing=null})
            MapIconButton("Свернуть ветку",6,{val a=view.optJSONArray("collapsed");val set=(0 until (a?.length() ?: 0)).map {a!!.getString(it)}.toMutableSet();if(!set.add(node.id))set.remove(node.id);changeView(JSONObject(view.toString()).put("collapsed",org.json.JSONArray(set.toList())));editing=null})
        }
        Text("Цвета карточки и линий",style=MaterialTheme.typography.titleSmall)
        fun setColor(key:String,value:String?) {val style=JSONObject(node.style?.toString() ?: "{}");if(value==null)style.remove(key) else style.put(key,value);save(map.copy(nodes=map.nodes.map {if(it.id==node.id)it.copy(style=style.takeIf {it.length()>0}) else it}))}
        MapColorField("Заливка карточки",node.style?.optString("fill"),{setColor("fill",it)})
        MapColorField("Обводка карточки",node.style?.optString("border"),{setColor("border",it)})
        MapColorField("Цвет линий карты",map.appearance?.optString("lineColor"),{value->save(map.copy(appearance=value?.let {JSONObject().put("lineColor",it)}))})
        TextButton(onClick={save(map.copy(appearance=null,nodes=map.nodes.map {if(it.id==node.id)it.copy(style=null) else it}))}){Text("Вернуть цвета темы")}
        map.links.filter {it.from==node.id||it.to==node.id}.forEach {link->Column {
            Text(map.nodes.firstOrNull {it.id==(if(link.from==node.id)link.to else link.from)}?.let(::label).orEmpty())
            MapColorField("Цвет связи",link.color,{value->save(map.copy(links=map.links.map {if(it.id==link.id)it.copy(color=value) else it}))})
            TextButton(onClick={save(map.copy(links=map.links.filterNot {it.id==link.id}))}){Text("Убрать связь")}
        } }
        if(node.parentId!=null) {
            OutlinedTextField(parent,{parent=it},label={Text("Переместить в ветку")})
            map.nodes.filter {it.id !in map.descendants(node.id)}.forEach {candidate->TextButton(onClick={parent=candidate.id}){Text(label(candidate))}}
            TextButton(enabled=parent.isNotBlank()&&!busy,onClick={save(map.move(node.id,parent));parent="";editing=null}){Text("Переместить узел")}
            Row {listOf(-1,1).forEach {direction->MapIconButton(if(direction<0)"Выше" else "Ниже",if(direction<0)7 else 8,{val siblings=map.nodes.filter {it.parentId==node.parentId};val index=siblings.indexOfFirst {it.id==node.id};if(index+direction in siblings.indices){save(map.move(node.id,node.parentId,siblings.getOrNull(if(direction<0)index-1 else index+2)?.id))}},!busy)} }
        }
        if(node.parentId!=null)MapIconButton("Убрать ветку с карты",9,{remove=true})
    }},confirmButton={TextButton(enabled=!busy,onClick={save(map.copy(nodes=map.nodes.map {if(it.id==node.id)it.copy(text=if(it.kind=="idea")text else "",note=note) else it}));editing=null}){Text("Сохранить мысль")}},dismissButton={TextButton(onClick={editing=null}){Text("Закрыть")}})
    if(remove&&map!=null&&node!=null)AlertDialog(onDismissRequest={remove=false},title={Text("Убрать ветку?")},text={Text("Связанные задачи и проекты останутся в GENESIS.")},confirmButton={TextButton(onClick={save(map.remove(node.id));remove=false;editing=null;selected=null}){Text("Убрать только с карты")}},dismissButton={TextButton(onClick={remove=false}){Text("Отмена")}})
    if(picker&&map!=null&&node!=null)AlertDialog(onDismissRequest={picker=false},title={Text("Добавить из личных дел")},text={LazyColumn {items(tasks,key={it.id}) {t->TextButton(onClick={if(t.recurrence.enabled){occurrenceTask=t;occurrenceDate=t.date}else {save(map.copy(nodes=map.nodes+MindmapNode(UUID.randomUUID().toString(),node.id,"task",refId=t.id)));picker=false}}){Text(t.title)} };items(projects,key={it.id}) {p->TextButton(onClick={save(map.copy(nodes=map.nodes+MindmapNode(UUID.randomUUID().toString(),node.id,"project",refId=p.id)));picker=false}){Text("Проект · ${p.title}")} } }},confirmButton={TextButton(onClick={picker=false}){Text("Закрыть")}})
    if(occurrenceTask!=null&&map!=null&&node!=null)AlertDialog(onDismissRequest={occurrenceTask=null},title={Text("День повторения")},text={Column {AuthorDatePicker(occurrenceDate,ru.genesis.calendar.domain.CalendarMode.PROFANE){occurrenceDate=it};Text("На карте будет только выбранный экземпляр.")}},confirmButton={TextButton(enabled=runCatching {TaskOccurrences.occursOn(occurrenceTask!!,java.time.LocalDate.parse(occurrenceDate))}.getOrDefault(false),onClick={save(map.copy(nodes=map.nodes+MindmapNode(UUID.randomUUID().toString(),node.id,"task",refId=occurrenceTask!!.id,occurrenceDate=occurrenceDate)));occurrenceTask=null;picker=false}){Text("Привязать этот день")}},dismissButton={TextButton(onClick={occurrenceTask=null}){Text("Отмена")}})
    if(import||export)AlertDialog(onDismissRequest={import=false;export=false},title={Text(if(import)"Импорт JSON" else "Экспорт JSON")},text={OutlinedTextField(text,{if(import)text=it},readOnly=export,label={Text("Документ GENESIS")},modifier=Modifier.heightIn(max=360.dp))},confirmButton={TextButton(onClick={if(import)run {val file=JSONObject(text);require(file.getString("format")=="genesis-mindmap"&&file.getInt("version")==1);val source=MindmapDocument.parse(file.getJSONObject("document"));val copy=source.copy(id=UUID.randomUUID().toString());repo.save(copy);open(copy.id)};import=false;export=false}){Text(if(import)"Импортировать копию" else "Закрыть")}})
    history?.let { versions->AlertDialog(onDismissRequest={history=null},title={Text("История карты")},text={LazyColumn {items(versions,key={it.revision}) {r->TextButton(onClick={if(map!=null){if(serverPreview)run {repo.adoptServer(map.id);open(map.id)}else save(r.document.copy(id=map.id))};history=null}){Text("Версия ${r.revision} · ${r.document.title}")} } }},confirmButton={TextButton(onClick={history=null}){Text("Закрыть")}}) }
    // Recovery also binds a previously committed conversion after process death.
    LaunchedEffect(map?.id,tasks,records,busy) {if(map!=null&&!busy&&!record.unsynced) {val recovered=map.nodes.map { n->if(n.kind=="idea")tasks.firstOrNull {it.id==map.taskId(n.id)}?.let {n.copy(kind="task",text="",refId=it.id)} ?: n else n };if(recovered!=map.nodes)run {repo.save(map.copy(nodes=recovered))} } }
}

@Composable
private fun NativeMindmapCanvas(map:MindmapDocument,rows:List<Pair<MindmapNode,Int>>,view:JSONObject,label:(MindmapNode)->String,onSelect:(String)->Unit,onView:(JSONObject)->Unit,onAdd:(Offset)->Unit,onLink:(String,String)->Unit,modifier:Modifier) {
    var connecting by remember {mutableStateOf<String?>(null)}
    val horizontal=rememberScrollState();val vertical=rememberScrollState();val canvasScope=rememberCoroutineScope()
    val density=LocalDensity.current.density
    val positions=view.optJSONObject("positions") ?: JSONObject();var drag by remember {mutableStateOf<Pair<String,Offset>?>(null)};var menu by remember {mutableStateOf<Offset?>(null)}
    val located=rows.mapIndexed {i,pair->val saved=positions.optJSONObject(pair.first.id);val point=if(drag?.first==pair.first.id)drag!!.second else Offset(saved?.optDouble("x",24.0+pair.second*260)?.toFloat() ?: (24+pair.second*260).toFloat(),saved?.optDouble("y",24.0+i*112)?.toFloat() ?: (24+i*112).toFloat());pair.first to point};val byId=located.toMap()
    val zoom=view.optDouble("zoom",1.0).coerceIn(.4,2.0).toFloat()
    val contentWidth=(located.maxOfOrNull {it.second.x} ?: 0f)+300;val contentHeight=(located.maxOfOrNull {it.second.y} ?: 0f)+180
    val line=mapColor(map.appearance?.optString("lineColor"),MaterialTheme.colorScheme.outline);val background=MaterialTheme.colorScheme.secondaryContainer
    Box(modifier.fillMaxWidth().background(background,MaterialTheme.shapes.medium).testTag("mindmap-canvas")) {
        Box(Modifier.fillMaxSize().horizontalScroll(horizontal).verticalScroll(vertical)) {
            Box(Modifier.width((contentWidth*zoom).dp).height((contentHeight*zoom).dp)) {
            Box(Modifier.width(contentWidth.dp).height(contentHeight.dp).graphicsLayer(scaleX=zoom,scaleY=zoom,transformOrigin=TransformOrigin(0f,0f))
                .pointerInput(map.id){detectTapGestures(onTap={menu=it})}) {
                Canvas(Modifier.matchParentSize()) {located.forEach { (n,p)->n.parentId?.let {parentId->byId[map.nodes.first {it.id==parentId}] }?.let {parent->val a=Offset((parent.x+220)*density,(parent.y+42)*density);val b=Offset(p.x*density,(p.y+42)*density);val path=Path().apply{moveTo(a.x,a.y);cubicTo(a.x+40*density,a.y,b.x-40*density,b.y,b.x,b.y)};drawPath(path,line,style=androidx.compose.ui.graphics.drawscope.Stroke(2*density))} }
                    map.links.forEach {link->val a=located.firstOrNull {it.first.id==link.from}?.second;val b=located.firstOrNull {it.first.id==link.to}?.second;if(a!=null&&b!=null){val path=Path().apply {moveTo((a.x+110)*density,(a.y+84)*density);quadraticTo((maxOf(a.x,b.x)+260)*density,(a.y+b.y)/2*density,(b.x+110)*density,b.y*density)};drawPath(path,mapColor(link.color,line),style=Stroke(2*density,pathEffect=androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(5*density,5*density))))}}
                }
                located.forEach { (n,point)->
                    val currentPoint by rememberUpdatedState(point);val currentView by rememberUpdatedState(view)
                    val fill=mapColor(n.style?.optString("fill"),MaterialTheme.colorScheme.surface)
                    val ink=if(n.style?.has("fill")==true)if(fill.luminance()>.179f)Color.Black else Color.White else MaterialTheme.colorScheme.onSurface
                    Surface(onClick={val from=connecting;if(from!=null&&from!=n.id){onLink(from,n.id);connecting=null}else onSelect(n.id)},shape=MaterialTheme.shapes.medium,color=fill,contentColor=ink,border=BorderStroke(1.dp,mapColor(n.style?.optString("border"),MaterialTheme.colorScheme.outline)),
                    modifier=Modifier.zIndex(if(drag?.first==n.id)10f else 0f).offset {IntOffset(point.x.dp.roundToPx(),point.y.dp.roundToPx())}.width(220.dp).height(84.dp).pointerInput(n.id){detectDragGesturesAfterLongPress(onDragEnd={val moved=drag;drag=null;if(moved!=null){val next=JSONObject(currentView.toString());val ps=next.optJSONObject("positions") ?: JSONObject();ps.put(n.id,JSONObject().put("x",moved.second.x).put("y",moved.second.y));onView(next.put("positions",ps))}},onDragCancel={drag=null}){change,delta->change.consume();val start=drag?.takeIf {it.first==n.id}?.second ?: currentPoint;drag=n.id to Offset((start.x+delta.x/density).coerceAtLeast(0f),(start.y+delta.y/density).coerceAtLeast(0f))}}) {
                    Column(Modifier.padding(start=12.dp,top=12.dp,end=40.dp)){Text(if(n.kind=="idea")"Мысль" else "GENESIS",style=MaterialTheme.typography.labelSmall);Text(label(n),maxLines=2,style=MaterialTheme.typography.titleSmall)}
                    Box(Modifier.fillMaxSize(),contentAlignment=Alignment.CenterEnd){MapIconButton("Создать связь",11,{val from=connecting;if(from!=null&&from!=n.id){onLink(from,n.id);connecting=null}else connecting=if(from==n.id)null else n.id})}
                    }
                }
                DropdownMenu(expanded=menu!=null,onDismissRequest={menu=null}) {DropdownMenuItem(text={Text("Добавить мысль")},onClick={val point=menu;menu=null;if(point!=null)onAdd(Offset(point.x/density,point.y/density))})}
            }
        }
        }
        Surface(color=MaterialTheme.colorScheme.surface,modifier=Modifier.align(Alignment.BottomCenter)) {Row(verticalAlignment=Alignment.CenterVertically) {
            MapIconButton("Уменьшить масштаб",8,{onView(JSONObject(view.toString()).put("zoom",(zoom-.2f).coerceAtLeast(.4f)))})
            Text("${(zoom*100).roundToInt()}%")
            MapIconButton("Увеличить масштаб",7,{onView(JSONObject(view.toString()).put("zoom",(zoom+.2f).coerceAtMost(2f)))})
            TextButton(onClick={onView(JSONObject(view.toString()).put("zoom",1.0));canvasScope.launch {horizontal.scrollTo(0);vertical.scrollTo(0)}}){Text("К началу")}
        } }
        if(connecting!=null)Surface(color=MaterialTheme.colorScheme.surface,modifier=Modifier.align(Alignment.TopCenter)){TextButton(onClick={connecting=null}){Text("Отменить соединение")}}
    }
}

private fun mapColor(hex:String?,fallback:Color):Color=if(hex!=null&&Regex("#[a-fA-F0-9]{6}").matches(hex))Color(android.graphics.Color.parseColor(hex)) else fallback

private fun JSONObject.removeFocus():JSONObject=apply {remove("focus")}
