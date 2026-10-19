"use client";
import {useEffect,useId,useState,type ButtonHTMLAttributes} from 'react';
import {createPortal} from 'react-dom';
import {ExperimentalIcon} from './ExperimentalIcon';
import './icon-action-button.css';

/** Uses the site's icon controls and popup tokens, including viewport-safe labels. */
export function IconActionButton({icon,label,className='',onClick,onFocus,onBlur,onPointerEnter,onPointerLeave,...props}:Omit<ButtonHTMLAttributes<HTMLButtonElement>,'children'|'aria-label'|'title'>&{icon:string;label:string}){
  const id=useId(),[anchor,setAnchor]=useState<DOMRect|null>(null);
  useEffect(()=>{
    if(!anchor)return;
    const close=()=>setAnchor(null);
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();close();}};
    document.addEventListener('keydown',key,true);
    document.addEventListener('scroll',close,true);
    window.addEventListener('resize',close);
    return()=>{document.removeEventListener('keydown',key,true);document.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);};
  },[anchor]);
  return <>
    <button {...props} type={props.type??'button'} className={`secondary-button icon-action-button ${className}`} data-no-translate aria-label={label} aria-describedby={anchor?id:undefined}
      onPointerEnter={event=>{if(event.pointerType!=='touch'&&!props.disabled)setAnchor(event.currentTarget.getBoundingClientRect());onPointerEnter?.(event);}}
      onPointerLeave={event=>{if(event.currentTarget!==document.activeElement)setAnchor(null);onPointerLeave?.(event);}}
      onFocus={event=>{setAnchor(event.currentTarget.getBoundingClientRect());onFocus?.(event);}}
      onBlur={event=>{setAnchor(null);onBlur?.(event);}}
      onClick={event=>{setAnchor(null);onClick?.(event);}}><ExperimentalIcon name={icon}/></button>
    {anchor?createPortal(<span id={id} role="tooltip" className="icon-action-tooltip" data-no-translate ref={node=>{
      if(!node)return;
      const {width,height}=node.getBoundingClientRect();
      node.style.left=`${Math.max(16,Math.min(anchor.left+(anchor.width-width)/2,window.innerWidth-width-16))}px`;
      node.style.top=`${anchor.bottom+8+height<=window.innerHeight-16?anchor.bottom+8:Math.max(16,anchor.top-height-8)}px`;
    }}>{label}</span>,document.body):null}
  </>;
}
