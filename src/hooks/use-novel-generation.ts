import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { streamNovelGeneration } from "@/lib/stream-novel";
import { useToast } from "@/hooks/use-toast";
import type { Chapter } from "@/components/novel-view/ChapterList";

export interface NovelData {
  id: string;
  title: string;
  genre: string[];
  outline: string | null;
  word_count: number;
  settings_json: any;
}

interface UseNovelGenerationParams {
  novel: NovelData | null;
  chapters: Chapter[];
  selectedChapter: Chapter | null;
  session: { access_token: string } | null;
  effectiveProvider: string;
  currentApiKey: string;
  effectiveApiBaseUrl: string | undefined;
  effectiveActualModel: string | undefined;
  onChaptersChange: (updater: (prev: Chapter[]) => Chapter[]) => void;
  onSelectedChapterChange: (updater: (prev: Chapter | null) => Chapter | null) => void;
  onNovelWordCountChange: (nextWordCount: number) => void;
}

export function useNovelGeneration({
  novel,
  chapters,
  selectedChapter,
  session,
  effectiveProvider,
  currentApiKey,
  effectiveApiBaseUrl,
  effectiveActualModel,
  onChaptersChange,
  onSelectedChapterChange,
  onNovelWordCountChange,
}: UseNovelGenerationParams) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [generationMode, setGenerationMode] = useState<"continue" | "continue_chapter" | "rewrite" | null>(null);
  const requestAbortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    return () => {
      requestAbortControllerRef.current?.abort();
      requestAbortControllerRef.current = null;
      stopRequestedRef.current = true;
    };
  }, []);

  const handleContinue = useCallback(async () => {
    if (isGenerating) return;
    if (!novel || !session?.access_token) {
      toast({ title: "操作失败", description: "请先登录", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGenerationMode("continue");
    setStreamContent("");
    stopRequestedRef.current = false;
    requestAbortControllerRef.current?.abort();
    const controller = new AbortController();
    requestAbortControllerRef.current = controller;
    let fullContent = "";

    await streamNovelGeneration({
      params: {
        mode: "continue",
        settings: novel.settings_json || {},
        model: effectiveProvider,
        apiKey: currentApiKey,
        apiBaseUrl: effectiveApiBaseUrl,
        actualModel: effectiveActualModel,
        novelId: novel.id,
      },
      onDelta: (text) => {
        if (requestAbortControllerRef.current !== controller) return;
        fullContent += text;
        setStreamContent(fullContent);
      },
      onDone: async () => {
        if (requestAbortControllerRef.current !== controller) return;
        requestAbortControllerRef.current = null;
        if (stopRequestedRef.current) {
          setIsGenerating(false);
          setGenerationMode(null);
          return;
        }

        try {
          const nextNum = chapters.length + 1;
          const lines = fullContent.split("\n").filter((l) => l.trim());
          const chapterTitle =
            lines[0]?.replace(/^#+\s*/, "").replace(/^第.+章\s*/, "") || `第${nextNum}章`;
          const chapterContent = lines.slice(1).join("\n").trim();

          if (chapterContent.length < 10) {
            toast({ title: "生成内容过少", description: "生成内容字数不足（少于 10 个字），已拦截保存", variant: "destructive" });
            setStreamContent("");
            return;
          }

          const { data, error } = await supabase
            .from("chapters")
            .insert({ novel_id: novel.id, chapter_number: nextNum, title: chapterTitle, content: chapterContent, word_count: chapterContent.length })
            .select()
            .single();

          if (error) {
            toast({ title: "保存失败", description: error.message, variant: "destructive" });
            setStreamContent("");
          } else {
            const newChapter = data as Chapter;
            onChaptersChange((prev) => [...prev, newChapter]);
            onSelectedChapterChange(() => newChapter);
            setStreamContent("");

            const nextWordCount = (novel.word_count || 0) + chapterContent.length;
            const { error: novelUpdateError } = await supabase.from("novels").update({ word_count: nextWordCount }).eq("id", novel.id);
            if (novelUpdateError) {
              toast({ title: "字数更新失败", description: novelUpdateError.message, variant: "destructive" });
            } else {
              onNovelWordCountChange(nextWordCount);
            }
            toast({ title: "章节已保存" });
          }
        } catch (e: any) {
          console.error(e);
          toast({ title: "网络错误", description: "保存失败，请检查网络", variant: "destructive" });
        } finally {
          setIsGenerating(false);
          setGenerationMode(null);
        }
      },
      onError: (error) => {
        if (requestAbortControllerRef.current !== controller) return;
        requestAbortControllerRef.current = null;
        if (stopRequestedRef.current) return;
        setIsGenerating(false);
        setGenerationMode(null);
        toast({ title: "生成失败", description: error, variant: "destructive" });
        setStreamContent("");
      },
      signal: controller.signal,
    });
  }, [isGenerating, novel, chapters, session, effectiveProvider, currentApiKey, effectiveApiBaseUrl, effectiveActualModel]);

  const handleRewrite = useCallback(async () => {
    if (isGenerating) return;
    if (!selectedChapter || !novel || !session?.access_token) return;

    const targetChapterId = selectedChapter.id;
    setIsGenerating(true);
    setGenerationMode("rewrite");
    setStreamContent("");
    stopRequestedRef.current = false;
    requestAbortControllerRef.current?.abort();
    const controller = new AbortController();
    requestAbortControllerRef.current = controller;
    let fullContent = "";

    await streamNovelGeneration({
      params: {
        mode: "rewrite",
        settings: novel.settings_json || {},
        model: effectiveProvider,
        apiKey: currentApiKey,
        apiBaseUrl: effectiveApiBaseUrl,
        actualModel: effectiveActualModel,
        rewriteContent: selectedChapter.content,
      },
      onDelta: (text) => {
        if (requestAbortControllerRef.current !== controller) return;
        fullContent += text;
        setStreamContent(fullContent);
      },
      onDone: async () => {
        if (requestAbortControllerRef.current !== controller) return;
        requestAbortControllerRef.current = null;
        if (stopRequestedRef.current) {
          setIsGenerating(false);
          setGenerationMode(null);
          return;
        }

        try {
          const lines = fullContent.split("\n").filter((l) => l.trim());
          const chapterTitle = lines[0]?.replace(/^#+\s*/, "").replace(/^第.+章\s*/, "") || selectedChapter.title;
          const chapterContent = lines.slice(1).join("\n").trim();

          if (chapterContent.length < 10) {
            toast({ title: "重写失败", description: "生成的内容过少（少于 10 个字），已拦截保存", variant: "destructive" });
            setStreamContent("");
            return;
          }

          const { error } = await supabase
            .from("chapters")
            .update({ title: chapterTitle, content: chapterContent, word_count: chapterContent.length })
            .eq("id", targetChapterId);

          if (error) {
            toast({ title: "保存失败", description: error.message, variant: "destructive" });
            setStreamContent("");
          } else {
            const previousWords = selectedChapter.word_count || selectedChapter.content.length;
            const wordDelta = chapterContent.length - previousWords;

            onChaptersChange((prev) => prev.map((ch) => ch.id === targetChapterId ? { ...ch, title: chapterTitle, content: chapterContent, word_count: chapterContent.length } : ch));
            onSelectedChapterChange((prev) => prev && prev.id === targetChapterId ? { ...prev, title: chapterTitle, content: chapterContent, word_count: chapterContent.length } : prev);
            setStreamContent("");

            if (wordDelta !== 0) {
              const nextWordCount = Math.max(0, (novel.word_count || 0) + wordDelta);
              const { error: novelUpdateError } = await supabase.from("novels").update({ word_count: nextWordCount }).eq("id", novel.id);
              if (novelUpdateError) {
                toast({ title: "字数更新失败", description: novelUpdateError.message, variant: "destructive" });
              } else {
                onNovelWordCountChange(nextWordCount);
              }
            }
            toast({ title: "重写完成并已保存" });
          }
        } catch (e: any) {
          console.error(e);
          toast({ title: "重写失败", description: "网络异常或服务错误", variant: "destructive" });
        } finally {
          setIsGenerating(false);
          setGenerationMode(null);
        }
      },
      onError: (error) => {
        if (requestAbortControllerRef.current !== controller) return;
        requestAbortControllerRef.current = null;
        if (stopRequestedRef.current) return;
        setIsGenerating(false);
        setGenerationMode(null);
        toast({ title: "重写失败", description: error, variant: "destructive" });
        setStreamContent("");
      },
      signal: controller.signal,
    });
  }, [isGenerating, selectedChapter, novel, session, effectiveProvider, currentApiKey, effectiveApiBaseUrl, effectiveActualModel]);

  const handleContinueChapter = useCallback(async () => {
    if (isGenerating) return;
    if (!selectedChapter || !novel || !session?.access_token) {
      toast({ title: "操作失败", description: "请先登录或选择章节", variant: "destructive" });
      return;
    }

    const targetChapterId = selectedChapter.id;
    const originalContent = selectedChapter.content || "";
    setIsGenerating(true);
    setGenerationMode("continue_chapter");
    setStreamContent("");
    stopRequestedRef.current = false;
    requestAbortControllerRef.current?.abort();
    const controller = new AbortController();
    requestAbortControllerRef.current = controller;
    let fullContent = "";

    await streamNovelGeneration({
      params: {
        mode: "continue_chapter",
        settings: novel.settings_json || {},
        model: effectiveProvider,
        apiKey: currentApiKey,
        apiBaseUrl: effectiveApiBaseUrl,
        actualModel: effectiveActualModel,
        novelId: novel.id,
        currentText: originalContent,
        currentChapterTitle: selectedChapter.title,
        currentChapterNumber: selectedChapter.chapter_number,
      },
      onDelta: (text) => {
        if (requestAbortControllerRef.current !== controller) return;
        fullContent += text;
        setStreamContent(fullContent);
      },
      onDone: async () => {
        if (requestAbortControllerRef.current !== controller) return;
        requestAbortControllerRef.current = null;
        if (stopRequestedRef.current) {
          setIsGenerating(false);
          setGenerationMode(null);
          return;
        }

        try {
          const nextContent = originalContent + "\n\n" + fullContent;
          const newWords = nextContent.length;

          const { error } = await supabase
            .from("chapters")
            .update({ content: nextContent, word_count: newWords })
            .eq("id", targetChapterId);

          if (error) {
            toast({ title: "保存失败", description: error.message, variant: "destructive" });
            setStreamContent("");
          } else {
            onChaptersChange((prev) => prev.map((ch) => ch.id === targetChapterId ? { ...ch, content: nextContent, word_count: newWords } : ch));
            onSelectedChapterChange((prev) => prev && prev.id === targetChapterId ? { ...prev, content: nextContent, word_count: newWords } : prev);
            setStreamContent("");

            const wordDelta = nextContent.length - originalContent.length;
            if (wordDelta > 0) {
              const nextWordCount = (novel.word_count || 0) + wordDelta;
              const { error: novelUpdateError } = await supabase.from("novels").update({ word_count: nextWordCount }).eq("id", novel.id);
              if (novelUpdateError) {
                toast({ title: "字数更新失败", description: novelUpdateError.message, variant: "destructive" });
              } else {
                onNovelWordCountChange(nextWordCount);
              }
            }
            toast({ title: "章节已保存" });
          }
        } catch (e: any) {
          console.error(e);
          toast({ title: "保存失败", description: "网络异常或服务错误", variant: "destructive" });
        } finally {
          setIsGenerating(false);
          setGenerationMode(null);
        }
      },
      onError: (error) => {
        if (requestAbortControllerRef.current !== controller) return;
        requestAbortControllerRef.current = null;
        if (stopRequestedRef.current) return;
        setIsGenerating(false);
        setGenerationMode(null);
        toast({ title: "续写失败", description: error, variant: "destructive" });
        setStreamContent("");
      },
      signal: controller.signal,
    });
  }, [isGenerating, selectedChapter, novel, session, effectiveProvider, currentApiKey, effectiveApiBaseUrl, effectiveActualModel]);

  const handleStop = useCallback(async () => {
    stopRequestedRef.current = true;
    requestAbortControllerRef.current?.abort();
    requestAbortControllerRef.current = null;

    let saveSuccess = false;
    const isContinueChapter = generationMode === "continue_chapter";

    try {
      if (isContinueChapter && streamContent.trim()) {
        const currentStream = streamContent;
        if (selectedChapter && novel) {
          const targetChapterId = selectedChapter.id;
          const originalContent = selectedChapter.content || "";
          const nextContent = originalContent ? originalContent + "\n\n" + currentStream : currentStream;
          const newWords = nextContent.length;
          const wordDelta = newWords - originalContent.length;

          const { error } = await supabase
            .from("chapters")
            .update({ content: nextContent, word_count: newWords })
            .eq("id", targetChapterId);

          if (error) {
            toast({ title: "优雅保存失败", description: error.message, variant: "destructive" });
          } else {
            saveSuccess = true;
            onChaptersChange((prev) => prev.map((ch) => ch.id === targetChapterId ? { ...ch, content: nextContent, word_count: newWords } : ch));
            onSelectedChapterChange((prev) => prev && prev.id === targetChapterId ? { ...prev, content: nextContent, word_count: newWords } : prev);

            if (wordDelta > 0) {
              const nextWordCount = (novel.word_count || 0) + wordDelta;
              const { error: novelUpdateError } = await supabase.from("novels").update({ word_count: nextWordCount }).eq("id", novel.id);
              if (novelUpdateError) {
                toast({ title: "字数更新失败", description: novelUpdateError.message, variant: "destructive" });
              } else {
                onNovelWordCountChange(nextWordCount);
              }
            }
            toast({ title: "已保存已生成的内容" });
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "保存失败：网络错误，无法保存最新续写内容", variant: "destructive" });
    } finally {
      if (!isContinueChapter || !streamContent.trim() || saveSuccess) {
        setStreamContent("");
      }
      setGenerationMode(null);
      setIsGenerating(false);
    }
  }, [generationMode, streamContent, selectedChapter, novel]);

  return {
    isGenerating,
    streamContent,
    generationMode,
    handleContinue,
    handleRewrite,
    handleContinueChapter,
    handleStop,
  };
}
