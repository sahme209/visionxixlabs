"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

const baseClass = "text-[15px] leading-relaxed text-stone-900 [&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-stone-900 [&_code]:bg-stone-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-sm [&_pre]:my-2 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:bg-stone-100 [&_pre]:overflow-x-auto";

export function ChatMessageContent({ content }: { content: string }) {
  return (
    <div className={baseClass}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-1">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-stone-900">{children}</strong>,
          a: ({ href, children }) => {
            if (!href) return <>{children}</>;
            const isExternal = href.startsWith("http");
            const linkClass = "text-teal-600 hover:underline font-medium";
            if (isExternal) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {children}
                </a>
              );
            }
            return (
              <Link href={href} className={linkClass}>
                {children}
              </Link>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
