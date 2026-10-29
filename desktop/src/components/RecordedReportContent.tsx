import type {ReactNode} from 'react';
/** A text-only view of the fixed recorded-report format. Never interprets HTML,
 * links, images or model instructions; the stored artifact remains unchanged. */
export function RecordedReportContent({content}:{content:string}){
 const lines=content.split(/\r?\n/),nodes:ReactNode[]=[];
 const special=(line:string)=>!line.trim()||line.startsWith('# ')||line.startsWith('## ')||line.startsWith('- ');
 for(let index=0;index<lines.length;){
  const line=lines[index],key=index;
  if(!line.trim()){index++;continue}
  if(line.startsWith('## ')){nodes.push(<h4 key={key} className="pt-2 text-xs font-medium text-zinc-200">{line.slice(3)}</h4>);index++;continue}
  if(line.startsWith('# ')){nodes.push(<h3 key={key} className="text-sm font-medium text-zinc-200">{line.slice(2)}</h3>);index++;continue}
  if(line.startsWith('- ')){
   const items:string[]=[];while(index<lines.length&&lines[index].startsWith('- '))items.push(lines[index++].slice(2));
   nodes.push(<ul key={key} className="list-disc space-y-2 pl-4">{items.map((item,itemIndex)=><li key={itemIndex}>{item}</li>)}</ul>);continue;
  }
  const paragraph:string[]=[line];index++;while(index<lines.length&&!special(lines[index]))paragraph.push(lines[index++]);
  nodes.push(<p key={key} className="whitespace-pre-wrap">{paragraph.join('\n')}</p>);
 }
 return <div className="min-w-0 space-y-4 break-words text-xs leading-6 text-zinc-300">{nodes}</div>;
}
