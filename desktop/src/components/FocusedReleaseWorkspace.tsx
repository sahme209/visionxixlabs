import {useId,useState,type ReactNode} from 'react';

export interface ReleaseWorkspaceItem {id:string;title:string;status:string;nextStep:string;attention:boolean;busy:boolean;}
/** Navigation only. Keep every keyed workspace mounted so changing the selected
 * release cannot discard an exact review, draft, pending request or recovery. */
export function FocusedReleaseWorkspace({items,children}:{items:ReleaseWorkspaceItem[];children:(item:ReleaseWorkspaceItem)=>ReactNode}){
 const prefix=useId(),[selected,setSelected]=useState<string>();
 const active=items.some(item=>item.id===selected)?selected:items[0]?.id;
 return <div className="release-focus-layout">
  <nav className="release-focus-list" aria-label="Select a release">
   <div className="release-focus-list-heading"><span>YOUR RELEASES</span><span>{items.length}</span></div>
   {items.map((item,index)=><button key={item.id} type="button" id={`${prefix}-item-${index}`} aria-controls={`${prefix}-panel-${index}`} aria-current={active===item.id?'true':undefined} onClick={()=>setSelected(item.id)} className={`release-focus-item ${active===item.id?'is-selected':''}`}>
    <span className="release-focus-item-title">{item.title}</span>
    <span className="release-focus-item-state">{item.status.replaceAll('_',' ')}{item.busy?' · Working':''}</span>
    <span className="release-focus-item-next">{item.nextStep}</span>
    {item.attention&&<span className="release-focus-attention">Needs attention</span>}
   </button>)}
  </nav>
  <div className="release-focus-detail">{items.map((item,index)=><section key={item.id} id={`${prefix}-panel-${index}`} aria-labelledby={`${prefix}-item-${index}`} hidden={active!==item.id}>{children(item)}</section>)}</div>
 </div>;
}
