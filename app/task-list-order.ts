export type TaskListOrder = "position" | "createdAt" | "createdAtAsc" | "dueDate" | "updatedAt" | "title";
export const taskListOrders: {value: TaskListOrder; ru: string; en: string}[] = [
  {value:"position",ru:"Обычный порядок",en:"Default order"},
  {value:"createdAt",ru:"Новые вверху",en:"Newest first"},
  {value:"createdAtAsc",ru:"Старые вверху",en:"Oldest first"},
  {value:"dueDate",ru:"Ближайший срок",en:"Due date"},
  {value:"updatedAt",ru:"Последние изменения",en:"Recently updated"},
  {value:"title",ru:"По названию",en:"Title"},
];
export function isTaskListOrder(value: unknown): value is TaskListOrder {
  return taskListOrders.some(item=>item.value===value);
}
type SortableTask = {id:string;title:string;createdAt?:string;updatedAt?:string|number;dueDate?:string|null};
const time=(value:string|number|undefined)=>{const stamp=value===undefined?0:new Date(value).getTime();return Number.isFinite(stamp)?stamp:0;};
/** Copies the list; sorting never changes the stored task or board position. */
export function orderPersonalTasks<T extends SortableTask>(tasks: readonly T[], order: TaskListOrder): T[] {
  if(order==="position")return [...tasks];
  return tasks.map((task,index)=>({task,index})).sort((a,b)=>{
    const left=a.task,right=b.task;
    const delta=order==="createdAt"?time(right.createdAt)-time(left.createdAt)
      :order==="createdAtAsc"?time(left.createdAt)-time(right.createdAt)
      :order==="updatedAt"?time(right.updatedAt)-time(left.updatedAt)
      :order==="dueDate"?(left.dueDate||"9999-12-31").localeCompare(right.dueDate||"9999-12-31")
      :left.title.localeCompare(right.title);
    return delta||a.index-b.index;
  }).map(item=>item.task);
}
export function unreadPersonalCommentIds(comments: readonly {id:string;authorId:string}[], userId:string, read:readonly string[]):string[] {
  const seen=new Set(read);
  return comments.filter(comment=>comment.authorId!==userId&&!seen.has(comment.id)).map(comment=>comment.id);
}
