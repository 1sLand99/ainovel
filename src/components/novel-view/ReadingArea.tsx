import { useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Chapter } from "./ChapterList";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

const FONT_SIZES = ["text-sm", "text-base", "text-lg", "text-xl"] as const;

interface ReadingAreaProps {
  selectedChapter: Chapter | null;
  displayContent: string;
  isGenerating: boolean;
  generationMode: "continue" | "continue_chapter" | "rewrite" | null;
  streamContent: string;
}

export function ReadingArea({
  selectedChapter,
  displayContent,
  isGenerating,
  generationMode,
  streamContent,
}: ReadingAreaProps) {
  const streamRef = useRef<HTMLDivElement>(null);
  const [sizeIdx, setSizeIdx] = useState(1);

  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [streamContent]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 字号控制栏 */}
      <div className="flex items-center justify-end gap-1 px-4 py-2 border-b border-border/30">
        <span className="text-xs text-muted-foreground mr-2">字号</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setSizeIdx(i => Math.max(0, i - 1))}
          disabled={sizeIdx === 0}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setSizeIdx(i => Math.min(FONT_SIZES.length - 1, i + 1))}
          disabled={sizeIdx === FONT_SIZES.length - 1}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div ref={streamRef} className="flex-1 overflow-auto">
      {displayContent ? (
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-10">
          {selectedChapter && (!streamContent || generationMode === "continue_chapter") && (
            <h2 className="mb-8 font-serif text-2xl font-bold text-center">
              第{selectedChapter.chapter_number}章 {selectedChapter.title}
            </h2>
          )}
          <div className={`font-serif leading-loose text-foreground/85 break-words ${FONT_SIZES[sizeIdx]}`}>
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-4 indent-8 leading-loose">{children}</p>,
                h1: ({ children }) => <h1 className="mb-6 text-2xl font-bold text-center">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-4 mt-8 text-xl font-bold">{children}</h2>,
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <p>选择一个章节开始阅读，或点击“继续写作”生成新章节</p>
        </div>
      )}
      </div>
    </div>
  );
}
