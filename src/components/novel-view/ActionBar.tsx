import { Button } from "@/components/ui/button";
import { PenTool, RotateCcw, ChevronRight, Loader2, StopCircle } from "lucide-react";

interface ActionBarProps {
  isGenerating: boolean;
  generationMode: "continue" | "continue_chapter" | "rewrite" | null;
  streamContent: string;
  hasSelectedChapter: boolean;
  onStop: () => void;
  onContinueChapter: () => void;
  onRewrite: () => void;
  onContinue: () => void;
}

export function ActionBar({
  isGenerating,
  generationMode,
  streamContent,
  hasSelectedChapter,
  onStop,
  onContinueChapter,
  onRewrite,
  onContinue,
}: ActionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border/50 px-4 py-3">
      {isGenerating && (
        <Button variant="destructive" onClick={onStop}>
          <StopCircle className="mr-2 h-4 w-4" />
          停止生成
        </Button>
      )}
      <Button variant="secondary" disabled={isGenerating || !hasSelectedChapter} onClick={onContinueChapter}>
        {generationMode === "continue_chapter" && !streamContent ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <PenTool className="mr-2 h-4 w-4" />
        )}
        续写当前章
      </Button>
      <Button variant="outline" disabled={isGenerating || !hasSelectedChapter} onClick={onRewrite}>
        {generationMode === "rewrite" && !streamContent ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="mr-2 h-4 w-4" />
        )}
        重写本章
      </Button>
      <Button variant="outline" disabled={isGenerating} onClick={onContinue}>
        {generationMode === "continue" && !streamContent ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ChevronRight className="mr-2 h-4 w-4" />
        )}
        生成下一章
      </Button>
    </div>
  );
}
