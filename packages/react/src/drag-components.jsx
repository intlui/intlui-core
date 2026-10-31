import React, { useRef, useState } from 'react';

export function DragBoard({ props: p, common, call }) {
  const root = useRef(null), active = useRef(null);
  const [dragging, setDragging] = useState(null), [target, setTarget] = useState(null);
  const columns = Array.isArray(p.columns) ? p.columns.slice(0,20) : [];
  const items = Array.isArray(p.items) ? p.items.slice(0,500) : [];
  const destination = event => {
    const el = document.elementFromPoint(event.clientX,event.clientY);
    const column = el?.closest('[data-drop-column]'), card = el?.closest('[data-drag-item]');
    if (!column || !root.current.contains(column)) return null;
    return { columnId: column.dataset.dropColumn, beforeId: card?.dataset.dragItem || null };
  };
  const finish = event => {
    const id = active.current, to = destination(event);
    active.current = null; setDragging(null); setTarget(null);
    if (id && to && id !== to.beforeId) call('onMove', { id, ...to });
  };
  const move = (item, columnId, beforeId = null) => call('onMove',{id:String(item.id),columnId:String(columnId),beforeId:beforeId==null?null:String(beforeId)});
  return <div {...common} ref={root} onPointerMove={event=>{if(active.current)setTarget(destination(event));}} onPointerUp={finish} onPointerCancel={()=>{active.current=null;setDragging(null);setTarget(null);}}>
    <div className="intl-drag-columns">{columns.map((column,ci)=>{
      const rows = items.filter(item=>String(item.columnId)===String(column.id));
      return <section key={column.id} data-drop-column={column.id} className={target?.columnId===String(column.id)?'intl-drop-active':''}>
        <h4>{column.title} · {rows.length}</h4>
        {rows.map((item,index)=><article key={item.id} data-drag-item={item.id} data-dragging={dragging===String(item.id)}>
          <button type="button" className="intl-drag-handle" aria-label={`Drag ${item.title}`} onPointerDown={event=>{
            if(event.button!==0)return;event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);active.current=String(item.id);setDragging(String(item.id));
          }}>⠿ {item.title}</button>
          {item.description && <p>{item.description}</p>}
          <div className="intl-drag-actions">
            <button type="button" aria-label={`Move up ${item.title}`} disabled={index===0} onClick={()=>move(item,column.id,rows[index-1].id)}>↑</button>
            <button type="button" aria-label={`Move down ${item.title}`} disabled={index===rows.length-1} onClick={()=>move(item,column.id,rows[index+2]?.id)}>↓</button>
            <button type="button" aria-label={`Previous column ${item.title}`} disabled={ci===0} onClick={()=>move(item,columns[ci-1].id)}>←</button>
            <button type="button" aria-label={`Next column ${item.title}`} disabled={ci===columns.length-1} onClick={()=>move(item,columns[ci+1].id)}>→</button>
          </div>
        </article>)}
        <div className="intl-drop-end">Drop here to append</div>
      </section>;
    })}</div>
    <p role="status" aria-live="polite">{dragging ? 'Drag over a card to insert before it, or to the bottom of the column.' : 'Drag the handle or use the directional buttons.'}</p>
  </div>;
}
