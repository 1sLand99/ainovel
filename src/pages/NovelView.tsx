import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useModelProviders } from "@/hooks/use-model-providers";
import { useNovelGeneration, NovelData } from "@/hooks/use-novel-generation";
import { ChapterList, Chapter } from "@/components/novel-view/ChapterList";
import { ReadingArea } from "@/components/novel-view/ReadingArea";
import { ActionBar } from "@/components/novel-view/ActionBar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Maximize2, Minimize2, Loader2, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

export default function NovelView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [novel, setNovel] = useState<NovelData | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const fullscreenScrollRef = useRef<HTMLDivElement>(null);

  const handleFullscreenScroll = useCallback(() => {
    const el = fullscreenScrollRef.current;
    if (!el) return;
    const progress = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
    setReadProgress(Math.min(1, Math.max(0, progress)));
  }, []);

  const { effectiveProvider, currentApiKey, effectiveApiBaseUrl, effectiveActualModel } = useModelProviders();

  const {
    isGenerating,
    streamContent,
    generationMode,
    handleContinue,
    handleRewrite,
    handleContinueChapter,
    handleStop,
  } = useNovelGeneration({
    novel,
    chapters,
    selectedChapter,
    effectiveProvider,
    currentApiKey,
    effectiveApiBaseUrl,
    effectiveActualModel,
    onChaptersChange: setChapters,
    onSelectedChapterChange: setSelectedChapter,
    onNovelWordCountChange: (nextWordCount) => setNovel((prev) => (prev ? { ...prev, word_count: nextWordCount } : prev)),
  });

  const handleChapterSelect = (chapter: Chapter) => {
    if (isGenerating) {
      toast({ title: "请先停止当前生成，再切换到其他章节", variant: "destructive" });
      return;
    }
    setSelectedChapter(chapter);
    setIsSheetOpen(false);
  };

  useEffect(() => {
    if (!id || !user) return;
    const fetchData = async () => {
      const [novelRes, chaptersRes] = await Promise.all([
        supabase.from("novels").select("*").eq("id", id).single(),
        supabase.from("chapters").select("*").eq("novel_id", id).order("chapter_number"),
      ]);
      if (novelRes.error) {
        toast({ title: "加载失败", description: novelRes.error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      setNovel(novelRes.data as NovelData);
      setChapters((chaptersRes.data || []) as Chapter[]);
      if (chaptersRes.data?.length) setSelectedChapter(chaptersRes.data[0] as Chapter);
      setLoading(false);
    };
    fetchData();
  }, [id, user]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3rem)] md:h-screen">
        <div className="w-64 border-r border-border/50 flex-shrink-0 hidden md:block p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
        <div className="flex-1 p-8 space-y-4">
          <Skeleton className="h-8 w-1/2 mx-auto" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
    );
  }
  if (!novel) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">小说不存在</div>;
  }

  if (fullscreen && selectedChapter) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <div className="flex h-12 items-center justify-between border-b border-border/50 px-6">
          <span className="font-serif text-sm">第{selectedChapter.chapter_number}章 {selectedChapter.title}</span>
          <Button variant="ghost" size="icon" onClick={() => setFullscreen(false)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
        {/* 阅读进度条 */}
        <div className="h-0.5 bg-border">
          <div className="h-full bg-primary transition-all duration-150" style={{ width: `${readProgress * 100}%` }} />
        </div>
        <div ref={fullscreenScrollRef} onScroll={handleFullscreenScroll} className="h-[calc(100vh-3.5rem)] overflow-auto">
          <div className="mx-auto max-w-3xl px-6 py-10 font-serif text-lg leading-loose text-foreground/90 whitespace-pre-wrap">
            {selectedChapter.content || "暂无内容"}
          </div>
        </div>
      </div>
    );
  }

  const displayContent =
    isGenerating && generationMode === "continue_chapter"
      ? (selectedChapter?.content || "") + "\n\n" + streamContent
      : streamContent || selectedChapter?.content || "";

  return (
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <div className="flex h-[calc(100vh-3rem)] md:h-screen">
        {/* Desktop Chapter List */}
        <div className="w-64 border-r border-border/50 flex-shrink-0 hidden md:block">
          <div className="flex h-12 items-center gap-2 border-b border-border/50 px-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/library")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-serif text-sm font-medium truncate">{novel.title}</span>
          </div>
          <ScrollArea className="h-[calc(100%-3rem)]">
            <ChapterList chapters={chapters} selectedChapter={selectedChapter} onSelectChapter={handleChapterSelect} />
          </ScrollArea>
        </div>

        {/* Reading Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex h-12 items-center justify-between border-b border-border/50 px-4 md:px-6">
            <div className="flex items-center gap-2 md:hidden">
              <Button variant="ghost" size="icon" onClick={() => navigate("/library")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="font-serif text-sm truncate">{novel.title}</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              {isGenerating && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在生成中...
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="目录">
                  <BookOpen className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <Button variant="ghost" size="icon" onClick={() => setFullscreen(true)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mobile chapter drawer */}
          <SheetContent side="left" className="w-80 p-0" aria-describedby={undefined}>
            <div className="flex h-12 items-center gap-2 border-b border-border/50 px-4">
              <SheetTitle className="font-serif text-sm font-medium truncate">{novel.title} (目录)</SheetTitle>
            </div>
            <div className="h-[calc(100%-3rem)]">
              <ScrollArea className="h-full">
                <ChapterList chapters={chapters} selectedChapter={selectedChapter} onSelectChapter={handleChapterSelect} />
              </ScrollArea>
            </div>
          </SheetContent>

          <ReadingArea
            selectedChapter={selectedChapter}
            displayContent={displayContent}
            isGenerating={isGenerating}
            generationMode={generationMode}
            streamContent={streamContent}
          />

          <ActionBar
            isGenerating={isGenerating}
            generationMode={generationMode}
            streamContent={streamContent}
            hasSelectedChapter={!!selectedChapter}
            onStop={handleStop}
            onContinueChapter={handleContinueChapter}
            onRewrite={handleRewrite}
            onContinue={handleContinue}
          />
        </div>
      </div>
    </Sheet>
  );
}
