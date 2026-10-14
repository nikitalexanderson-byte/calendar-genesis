"use client";
import { useId,type ReactNode } from 'react';
import { ExperimentalIcon } from './ExperimentalIcon';
import { translateText } from './i18n';
export function CategorySection({expanded,onExpanded,view,onView,onCreate,children}:{expanded:boolean;onExpanded:(value:boolean)=>void;view:'cards'|'list';onView:(value:'cards'|'list')=>void;onCreate?:()=>void;children:ReactNode}){
  const heading=useId();
  return <details className="shared-project-categories unified-categories" data-category-view={view} open={expanded} aria-labelledby={heading}>
    <summary className="shared-categories-header" onClick={event=>{if(event.defaultPrevented)return;event.preventDefault();onExpanded(!expanded);}}><ExperimentalIcon name="chevron"/><h3 id={heading}>{translateText('Категории')}</h3>
      <span className="category-view-switch" role="group" aria-label={translateText('Отображение')}>{(['list','cards'] as const).map(value=><button type="button" key={value} aria-pressed={view===value} onClick={event=>{event.preventDefault();onView(value);}}><ExperimentalIcon name={value==='list'?'list':'projects'}/>{translateText(value==='list'?'Список':'Карточки')}</button>)}</span>
      {onCreate?<button type="button" className="secondary-button shared-category-create" onClick={event=>{event.preventDefault();onCreate();}}><ExperimentalIcon name="plus"/>{translateText('Новая категория')}</button>:null}
    </summary>{children}
  </details>;
}
