"use client";
import {useEffect,useId,useLayoutEffect,useRef,useState,type ButtonHTMLAttributes,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ExperimentalIcon} from './ExperimentalIcon';
import './icon-action-button.css';

/** Uses the site's icon controls and popup tokens, including viewport-safe labels. */
export function IconActionButton({icon,label,className='',showLabel=false,choiceHint=false,onClick,onFocus,onBlur,onPointerEnter,onPointerLeave,...props}:Omit<ButtonHTMLAttributes<HTMLButtonElement>,'children'|'aria-label'|'title'>&{icon:ReactNode;label:string;showLabel?:boolean;choiceHint?:boolean}){
  const id=useId(),[anchor,setAnchor]=useState<DOMRect|null>(null);
  const buttonRef=useRef<HTMLButtonElement>(null);
  const [portalTarget,setPortalTarget]=useState<HTMLElement|null>(null);
  const open=(button:HTMLButtonElement)=>{
    document.dispatchEvent(new CustomEvent('genesis:icon-hint',{detail:id}));
    // Native dialogs occupy the browser top layer; body portals cannot cover them.
    setPortalTarget(button.closest('dialog')??document.body);
    setAnchor(button.getBoundingClientRect());
  };
  // A choice can resize a centered dialog during the same click. Measure the
  // committed layout so its hint follows the button before the next paint.
  useLayoutEffect(()=>{
    if(!anchor||!buttonRef.current)return;
    const next=buttonRef.current.getBoundingClientRect();
    if(next.left!==anchor.left||next.top!==anchor.top||next.width!==anchor.width||next.height!==anchor.height)setAnchor(next);
  },[anchor]);
  useEffect(()=>{
    const dismiss=(event:Event)=>{if((event as CustomEvent<string>).detail!==id)setAnchor(null);};
    document.addEventListener('genesis:icon-hint',dismiss);
    return()=>document.removeEventListener('genesis:icon-hint',dismiss);
  },[id]);
  useEffect(()=>{
    if(!anchor)return;
    const close=()=>setAnchor(null);
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}};
    document.addEventListener('keydown',key,true);
    document.addEventListener('scroll',close,true);
    window.addEventListener('resize',close);
    return()=>{document.removeEventListener('keydown',key,true);document.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);};
  },[anchor]);
  return <>
    <button {...props} ref={buttonRef} type={props.type??'button'} className={`secondary-button icon-action-button${showLabel?' icon-label-choice':''} ${className}`} data-no-translate aria-label={label} aria-describedby={anchor?id:undefined}
      onPointerEnter={event=>{if(event.pointerType!=='touch'&&!props.disabled)open(event.currentTarget);onPointerEnter?.(event);}}
      onPointerLeave={event=>{if(event.currentTarget!==document.activeElement)setAnchor(null);onPointerLeave?.(event);}}
      onFocus={event=>{open(event.currentTarget);onFocus?.(event);}}
      onBlur={event=>{setAnchor(null);onBlur?.(event);}}
      onClick={event=>{if(choiceHint)open(event.currentTarget);else setAnchor(null);onClick?.(event);}}>{typeof icon==='string'?<ExperimentalIcon name={icon}/>:icon}{showLabel?<span className="icon-choice-label">{label}</span>:null}</button>
    {anchor?createPortal(<span id={id} role="tooltip" className="icon-action-tooltip" data-no-translate ref={node=>{
      if(!node)return;
      const {width,height}=node.getBoundingClientRect();
      node.style.left=`${Math.max(16,Math.min(anchor.left+(anchor.width-width)/2,window.innerWidth-width-16))}px`;
      node.style.top=`${choiceHint&&anchor.top-height-8>=16?anchor.top-height-8:anchor.bottom+8+height<=window.innerHeight-16?anchor.bottom+8:Math.max(16,anchor.top-height-8)}px`;
    }}>{label}</span>,portalTarget??document.body):null}
  </>;
}
