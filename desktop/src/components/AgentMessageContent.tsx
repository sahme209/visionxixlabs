import {Children,isValidElement,memo,useState,type ReactNode} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {openExternal} from "../lib/notifications";

function safeLink(href:string|undefined):string|null {
  if(!href || href.length>2048) return null;
  try {const url=new URL(href);return url.protocol==="https:" && !url.username && !url.password ? url.href : null;} catch {return null;}
}
function CodeBlock({children}:{children:ReactNode}) {
  const code=Children.toArray(children).find(child=>isValidElement<{children?:ReactNode;className?:string}>(child));
  const props=isValidElement<{children?:ReactNode;className?:string}>(code)?code.props:null;
  const text=typeof props?.children==="string"?props.children:null;
  const language=props?.className?.match(/(?:^|\s)language-([\w+-]{1,32})(?:\s|$)/)?.[1]??"Code";
  const [copied,setCopied]=useState(false),[failed,setFailed]=useState(false);
  async function copy() {
    if(text===null) return;
    setFailed(false);
    try {await navigator.clipboard.writeText(text);setCopied(true);} catch {setCopied(false);setFailed(true);}
  }
  return <div className="my-3 min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#0c0d0f]">
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-3 py-2 text-[10px] text-zinc-500"><span>{language}</span><button data-help-id="agent.workspace.copy-code" type="button" aria-label={copied?"Code copied":"Copy code"} disabled={text===null} onClick={()=>void copy()} className="text-zinc-400 hover:text-white disabled:opacity-40">{copied?"Copied":"Copy"}</button></div>
    <pre className="m-0 max-h-[32rem] overflow-auto p-3 font-mono text-xs leading-5 text-zinc-200">{children}</pre>
    {failed&&<p role="status" className="px-3 pb-3 text-[11px] text-amber-200">Could not copy. Select the code to copy it manually.</p>}
  </div>;
}
/** Display-only Markdown. HTML, remote media, embeds and executable schemes
 * have no renderer. Copying never executes a command or edits a repository. */
export const AgentMessageContent = memo(function AgentMessageContent({text}:{text:string}) {
  // Server replies are bounded to 131072 characters. Preserve larger legacy
  // content as plain text instead of feeding an unbounded document parser.
  if(text.length>131072) return <p className="whitespace-pre-wrap break-words">{text}</p>;
  return <div className="min-w-0 break-words [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_h1]:mb-3 [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:font-semibold [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-600 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-400 [&_hr]:my-4 [&_hr]:border-white/10 [&_th]:border [&_th]:border-white/10 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-2">
    <Markdown skipHtml remarkPlugins={[remarkGfm]} components={{
      pre:({children})=><CodeBlock>{children}</CodeBlock>,
      code:({children,className})=><code className={className??"rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[12px]"}>{children}</code>,
      a:({href,children})=>{const url=safeLink(href);return url?<a data-help-id="agent.workspace.message-link" href={url} onClick={event=>{event.preventDefault();void openExternal(url);}} className="text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:text-sky-200">{children}</a>:<span>{children}</span>;},
      img:({alt})=><span className="text-xs text-zinc-500">[Image{alt?`: ${alt}`:""}]</span>,
      table:({children})=><div className="my-3 max-w-full overflow-x-auto"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
    }}>{text}</Markdown>
  </div>;
});
