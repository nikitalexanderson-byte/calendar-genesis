"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { translateText } from "./i18n";
import { layoutMap, nodeColors, type Mindmap, type MapNode, type MapView } from "./mindmaps-model";

export default function MindmapCanvas({ map, view, selected, selectedLink, title, onSelect, onEditNode, onSelectLink, onDeleteSelection, onZoom, onViewport, onPosition, onCreateAt, onLink }: {
  map: Mindmap; view: MapView; selected: string; selectedLink: string | null; title: (node: MapNode) => string;
  onSelect: (id: string) => void; onZoom: (zoom: number) => void; onViewport: (viewport: {left:number;top:number}) => void;
  onPosition: (id:string,position:{x:number;y:number})=>void; onCreateAt:(position:{x:number;y:number})=>void;
  onLink:(from:string,to:string)=>void; onSelectLink:(id:string,from:string)=>void; onEditNode:(id:string)=>void; onDeleteSelection:()=>void;
}) {
  const [moving, setMoving] = useState<{id:string;x:number;y:number} | null>(null);
  const rows = useMemo(() => layoutMap(map, view).map(row => moving?.id===row.node.id ? {...row,x:moving.x,y:moving.y} : row), [map, view, moving]);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodeDrag = useRef<{id:string;clientX:number;clientY:number;x:number;y:number;active:boolean;moved:boolean;position?:{x:number;y:number}} | null>(null);
  const suppressClick = useRef(false);
  const [menu,setMenu] = useState<{left:number;top:number;x:number;y:number} | null>(null);
  const menuRef=useRef<HTMLDivElement>(null);
  const [connecting,setConnecting]=useState<{from:string;point?:{x:number;y:number}} | null>(null);
  const linkMoved=useRef(false);
  const linkStart=useRef({x:0,y:0});
  const touchPoints=useRef(new Map<number,{x:number;y:number}>());
  const pinch=useRef<{distance:number;zoom:number} | null>(null);
  const pinchGesture=useRef(false);
  const zoomRef=useRef(view.zoom);
  const pendingAnchor=useRef<{zoom:number;contentX:number;contentY:number;localX:number;localY:number} | null>(null);
  const [viewport, setViewport] = useState({ top: view.viewport?.top ?? 0, height: 800 });
  useEffect(() => { zoomRef.current=view.zoom; }, [view.zoom]);
  const zoomAt=useCallback((zoom:number,clientX:number,clientY:number)=>{
    const el=scroller.current;if(!el)return;
    const next=Math.max(.4,Math.min(2,zoom));if(Math.abs(next-zoomRef.current)<.001)return;
    const rect=el.getBoundingClientRect(),localX=clientX-rect.left,localY=clientY-rect.top;
    pendingAnchor.current={zoom:next,contentX:(el.scrollLeft+localX)/zoomRef.current,contentY:(el.scrollTop+localY)/zoomRef.current,localX,localY};
    zoomRef.current=next;onZoom(next);
  },[onZoom]);
  useLayoutEffect(()=>{
    const anchor=pendingAnchor.current,el=scroller.current;
    if(anchor&&el&&Math.abs(anchor.zoom-view.zoom)<.001){
      el.scrollTo({left:anchor.contentX*view.zoom-anchor.localX,top:anchor.contentY*view.zoom-anchor.localY,behavior:"instant"});
      pendingAnchor.current=null;
    }
  },[view.zoom]);
  useEffect(()=>{
    const el=scroller.current;if(!el)return;
    const wheel=(event:WheelEvent)=>{
      if(event.shiftKey&&!event.ctrlKey)return;
      event.preventDefault();
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?el.clientHeight:1);
      zoomAt(zoomRef.current*Math.exp(-delta*.0015),event.clientX,event.clientY);
    };
    el.addEventListener("wheel",wheel,{passive:false});
    return()=>el.removeEventListener("wheel",wheel);
  },[zoomAt]);
  const endTouch=(id:number)=>{touchPoints.current.delete(id);if(touchPoints.current.size<2)pinch.current=null;if(!touchPoints.current.size)drag.current=null;};
  useEffect(() => {
    // Decryption may finish after the canvas first mounts. Restore after layout
    // and again when the persisted coordinates arrive, not only on map ID changes.
    const frame = requestAnimationFrame(() => scroller.current?.scrollTo({
      left: view.viewport?.left ?? 0, top: view.viewport?.top ?? 0, behavior: "instant",
    }));
    return () => cancelAnimationFrame(frame);
  }, [map.id, view.viewport?.left, view.viewport?.top]);
  useEffect(() => () => { if (scrollTimer.current) clearTimeout(scrollTimer.current); if(holdTimer.current)clearTimeout(holdTimer.current); }, []);
  useEffect(()=>{ if(!menu)return;menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();const close=(e:PointerEvent)=>{if(!(e.target as Element).closest('.mindmap-context-menu'))setMenu(null);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close); },[menu]);
  const contextAt=(clientX:number,clientY:number)=>{const el=scroller.current!;const rect=el.getBoundingClientRect();setMenu({left:Math.min(clientX,window.innerWidth-210),top:Math.min(clientY,window.innerHeight-70),x:Math.max(0,(clientX-rect.left+el.scrollLeft)/view.zoom),y:Math.max(0,(clientY-rect.top+el.scrollTop)/view.zoom)});};
  const finishNode=(cancel=false)=>{if(holdTimer.current)clearTimeout(holdTimer.current);const current=nodeDrag.current;if(current?.moved)suppressClick.current=true;if(!cancel&&current?.position)onPosition(current.id,current.position);nodeDrag.current=null;setMoving(null);};
  const width = Math.max(...rows.map(r => r.x)) + 280; const height = Math.max(...rows.map(r=>r.y)) + 140;
  const byId = new Map(rows.map(r => [r.node.id, r]));
  // Large documents keep their geometry, but only visible buttons need DOM/layout.
  // Structure remains a complete native list for keyboard and assistive navigation.
  const paintedRows = rows.length <= 200 ? rows : rows.filter(r => r.node.id === selected
    || (r.y + 88 >= viewport.top / view.zoom - 200 && r.y <= (viewport.top + viewport.height) / view.zoom + 200));
  return <div className="mindmap-canvas-wrap">
    <div className="mindmap-toolbar" aria-label="Масштаб карты">
      <button type="button" onClick={() => onZoom(Math.max(.4, view.zoom - .2))} aria-label="Уменьшить масштаб">−</button>
      <span>{Math.round(view.zoom * 100)}%</span>
      <button type="button" onClick={() => onZoom(Math.min(2, view.zoom + .2))} aria-label="Увеличить масштаб">+</button>
      <button type="button" onClick={() => { onZoom(1); scroller.current?.scrollTo({ left: 0, top: 0 }); }}>К началу</button>
      <button type="button" onClick={() => { const r = byId.get(selected); if (r) scroller.current?.scrollTo({ left: Math.max(0, r.x * view.zoom - 32), top: Math.max(0, r.y * view.zoom - 32) }); }}>К выбранному узлу</button>
    </div>
    {/* Keyboard focus permits native arrow-key scrolling of this bounded canvas. */}
    {/* Interactive graphical editor; Structure supplies the alternative list semantics. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */}
    <div className="mindmap-canvas" ref={scroller} tabIndex={0} role="application" aria-label="Полотно карты: прокрутка и перемещение по пустому месту"
      onPointerDownCapture={e=>{if(e.pointerType!=="touch")return;if(!touchPoints.current.size)pinchGesture.current=false;touchPoints.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touchPoints.current.size===2){const [a,b]=[...touchPoints.current.values()];pinch.current={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom:zoomRef.current};pinchGesture.current=true;suppressClick.current=true;linkMoved.current=true;drag.current=null;nodeDrag.current=null;setMoving(null);}}}
      onPointerMoveCapture={e=>{if(e.pointerType!=="touch"||!touchPoints.current.has(e.pointerId))return;touchPoints.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch.current&&touchPoints.current.size>=2){e.preventDefault();const [a,b]=[...touchPoints.current.values()];zoomAt(pinch.current.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.current.distance,(a.x+b.x)/2,(a.y+b.y)/2);}}}
      onPointerUpCapture={e=>{if(e.pointerType==="touch")endTouch(e.pointerId);}}
      onPointerCancelCapture={e=>{if(e.pointerType==="touch")endTouch(e.pointerId);}}
      onScroll={e => { setViewport({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight }); if(scrollTimer.current) clearTimeout(scrollTimer.current); scrollTimer.current=setTimeout(()=>{if(scroller.current)onViewport({left:scroller.current.scrollLeft,top:scroller.current.scrollTop});},180); }}
      onContextMenu={e=>{if((e.target as Element).closest('button'))return;e.preventDefault();contextAt(e.clientX,e.clientY);}}
      onClick={e=>{if((e.target as Element).closest('button'))return;if(suppressClick.current){suppressClick.current=false;return;}contextAt(e.clientX,e.clientY);}}
      onKeyDown={e=>{if((e.key==='Delete'||e.key==='Backspace')&&!(e.target as Element).closest('input,textarea,select,[contenteditable="true"]')){e.preventDefault();e.stopPropagation();onDeleteSelection();return;}if(e.key==='Escape'){setMenu(null);setConnecting(null);}if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const r=e.currentTarget.getBoundingClientRect();contextAt(r.left+40,r.top+40);}}}
      onPointerDown={e => { if (e.button !== 0 || pinch.current || (e.target as Element).closest('button')) return; suppressClick.current=false;const el = scroller.current!; drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }; el.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { if (pinch.current || !drag.current) return;if(Math.hypot(drag.current.x-e.clientX,drag.current.y-e.clientY)>6)suppressClick.current=true; scroller.current!.scrollLeft = drag.current.left + drag.current.x - e.clientX; scroller.current!.scrollTop = drag.current.top + drag.current.y - e.clientY; }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; suppressClick.current=true; }}>
      <div style={{ width: width * view.zoom, height: height * view.zoom, position: "relative" }}>
        <div className="mindmap-plane" style={{ width, height, transform: `scale(${view.zoom})` }}>
          <svg width={width} height={height} role="group" aria-label="Связи узлов" style={{"--mindmap-branch":map.appearance?.lineColor} as React.CSSProperties}>
            {rows.map(r => { const p = byId.get(r.node.parentId ?? ""); return p ? <path key={r.node.id} aria-hidden="true" d={`M${p.x + 240} ${p.y + 44} C${p.x + 270} ${p.y + 44},${r.x - 30} ${r.y + 44},${r.x} ${r.y + 44}`} /> : null; })}
            {map.links.filter(l => l.from === selected || l.to === selected).map(l => { const a = byId.get(l.from), b = byId.get(l.to); if(!a||!b)return null;const path=`M${a.x + 120} ${a.y + 88} Q${Math.max(a.x,b.x) + 260} ${(a.y + b.y)/2},${b.x + 120} ${b.y}`;return <g key={l.id} className="mindmap-semantic-link" role="button" tabIndex={0} aria-label={`${translateText("Выбрать связь:")} ${title(a.node)} — ${title(b.node)}`} aria-pressed={selectedLink===l.id}
              onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();event.currentTarget.focus();onSelectLink(l.id,l.from);}}
              onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();event.stopPropagation();onSelectLink(l.id,l.from);}}} onContextMenu={event=>event.stopPropagation()}>
              <path className="mindmap-semantic" style={{stroke:l.color}} d={path}/><path className="mindmap-semantic-hit" d={path}/><text aria-hidden="true" x={a.x + 130} y={a.y + 107}>{l.label || "Связано с"}</text>
            </g>; })}
            {connecting?.point && byId.get(connecting.from) ? <path className="mindmap-semantic" aria-hidden="true" d={`M${byId.get(connecting.from)!.x+240} ${byId.get(connecting.from)!.y+44} L${connecting.point.x} ${connecting.point.y}`}/> : null}
          </svg>
          {paintedRows.map(r => <button key={r.node.id} type="button" className="mindmap-graph-node" aria-pressed={selected === r.node.id}
            data-map-node-id={r.node.id} style={{ left: r.x, top: r.y,zIndex:moving?.id===r.node.id ? 10 : selected===r.node.id ? 3 : 1,...nodeColors(r.node) }} onClick={() => {if(suppressClick.current){suppressClick.current=false;return;}if(connecting){if(connecting.from!==r.node.id)onLink(connecting.from,r.node.id);setConnecting(null);}else onSelect(r.node.id);}} title={title(r.node)}
            onDoubleClick={e=>{e.preventDefault();if(!connecting)onEditNode(r.node.id);}}
            onPointerDown={e=>{if(e.button!==0||pinch.current)return;e.stopPropagation();setMenu(null);suppressClick.current=false;e.currentTarget.setPointerCapture(e.pointerId);nodeDrag.current={id:r.node.id,clientX:e.clientX,clientY:e.clientY,x:r.x,y:r.y,active:e.pointerType==='mouse',moved:false};if(e.pointerType!=='mouse')holdTimer.current=setTimeout(()=>{if(nodeDrag.current)nodeDrag.current.active=true;},350);}}
            onPointerMove={e=>{if(pinch.current)return;const d=nodeDrag.current;if(!d||d.id!==r.node.id)return;const dx=e.clientX-d.clientX,dy=e.clientY-d.clientY;if(Math.hypot(dx,dy)<6&&!d.moved)return;d.moved=true;if(!d.active){if(holdTimer.current)clearTimeout(holdTimer.current);scroller.current!.scrollLeft-=dx;scroller.current!.scrollTop-=dy;d.clientX=e.clientX;d.clientY=e.clientY;return;}e.preventDefault();d.position={x:Math.max(0,Math.min(100000,d.x+dx/view.zoom)),y:Math.max(0,Math.min(100000,d.y+dy/view.zoom))};setMoving({id:d.id,...d.position});}}
            onPointerUp={()=>finishNode()} onPointerCancel={()=>finishNode(true)} onLostPointerCapture={()=>{if(nodeDrag.current)finishNode(true);}}
            onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onEditNode(r.node.id);return;}if(!e.altKey)return;const delta=({ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]} as Record<string,number[]>)[e.key];if(delta){e.preventDefault();onPosition(r.node.id,{x:Math.max(0,r.x+delta[0]),y:Math.max(0,r.y+delta[1])});}}}>
            <strong data-no-translate>{title(r.node)}</strong>
            {r.node.tags?.length ? <span className="mindmap-node-tags" aria-label="Теги">{r.node.tags.slice(0,3).map(tag=><span className="mindmap-node-tag" key={tag}>#{tag}</span>)}{r.node.tags.length>3 ? <span className="mindmap-node-tag">+{r.node.tags.length-3}</span> : null}</span> : null}
            {r.node.kind !== "idea" && !r.node.tags?.length ? <small>{r.node.kind === "task" ? "Задача GENESIS" : "Проект GENESIS"}</small> : null}
            {view.collapsed.includes(r.node.id) ? <small>Ветка свёрнута</small> : null}
          </button>)}
          {paintedRows.map(r=><button type="button" key={`link-${r.node.id}`} data-map-node-id={r.node.id} className="mindmap-connect-handle" aria-label={`${translateText("Создать связь:")} ${title(r.node)}`} title="Создать связь с другим узлом" aria-pressed={connecting?.from===r.node.id} style={{left:r.x+240,top:r.y+22,zIndex:moving?.id===r.node.id ? 11 : selected===r.node.id ? 4 : 2}} onClick={()=>{if(pinchGesture.current){pinchGesture.current=false;linkMoved.current=false;return;}if(linkMoved.current){linkMoved.current=false;return;}if(connecting?.from&&connecting.from!==r.node.id){onLink(connecting.from,r.node.id);setConnecting(null);}else setConnecting(connecting?.from===r.node.id ? null : {from:r.node.id});onSelect(r.node.id);}}
            onPointerDown={e=>{if(e.button!==0||pinch.current)return;e.stopPropagation();linkMoved.current=false;linkStart.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}}
            onPointerMove={e=>{if(pinch.current||!e.currentTarget.hasPointerCapture(e.pointerId)||Math.hypot(e.clientX-linkStart.current.x,e.clientY-linkStart.current.y)<6)return;linkMoved.current=true;const rect=scroller.current!.getBoundingClientRect();setConnecting({from:r.node.id,point:{x:(e.clientX-rect.left+scroller.current!.scrollLeft)/view.zoom,y:(e.clientY-rect.top+scroller.current!.scrollTop)/view.zoom}});}}
            onPointerUp={e=>{if(pinchGesture.current||!linkMoved.current)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-map-node-id]')?.dataset.mapNodeId;if(target&&target!==r.node.id){onLink(r.node.id,target);onSelect(r.node.id);}setConnecting(null);}} onPointerCancel={()=>setConnecting(null)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4"/><path d="M12 12h9m-3-3 3 3-3 3"/></svg></button>)}
        </div>
      </div>
    </div>
    {connecting ? <p role="status">Выберите вторую карточку для связи. Escape отменяет соединение.</p> : null}
    {menu ? <div ref={menuRef} className="mindmap-context-menu" role="menu" tabIndex={-1} aria-label="Действия на полотне" style={{left:menu.left,top:menu.top}} onKeyDown={e=>{if(e.key==='Escape'){setMenu(null);scroller.current?.focus();}}}><button type="button" role="menuitem" onClick={()=>{onCreateAt({x:menu.x,y:menu.y});setMenu(null);}}>Добавить мысль</button></div> : null}
  </div>;
}
