import { ChevronRight } from "lucide-react";

export interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  content: string;
  word_count: number;
}

interface ChapterListProps {
  chapters: Chapter[];
  selectedChapter: Chapter | null;
  onSelectChapter: (chapter: Chapter) => void;
}

export function ChapterList({ chapters, selectedChapter, onSelectChapter }: ChapterListProps) {
  return (
    <div className="p-2 space-y-1">
      {chapters.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">暂无章节</p>
      ) : (
        chapters.map((ch) => (
          <button
            key={ch.id}
            onClick={() => onSelectChapter(ch)}
            className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              selectedChapter?.id === ch.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <span className="truncate">第{ch.chapter_number}章 {ch.title}</span>
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
          </button>
        ))
      )}
    </div>
  );
}
