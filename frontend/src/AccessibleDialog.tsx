import React, { useEffect, useRef } from "react";
export function AccessibleDialog({ children, label, onClose }: { children: React.ReactNode; label: string; onClose: () => void }) {
  const ref=useRef<HTMLDivElement>(null);
  const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const prior=document.activeElement as HTMLElement|null, dialog=ref.current!;
    const controls=()=>[...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length>0);
    (controls()[0]??dialog).focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();close.current();return;}
      if(event.key!=="Tab")return;
      const items=controls(),first=items[0],last=items[items.length-1];
      if(!first){event.preventDefault();dialog.focus();}
      else if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){event.preventDefault();last!.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    dialog.addEventListener("keydown",key);
    return()=>{dialog.removeEventListener("keydown",key);if(prior?.isConnected)prior.focus();};
  },[]);
  return <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>{children}</div>;
}
