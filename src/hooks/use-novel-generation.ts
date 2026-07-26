import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { streamNovelGeneration, type StreamNovelParams } from "@/lib/stream-novel";
import { parseGeneratedChapter } from "@/lib/parse-chapter";
import { useToast } from "@/hooks/use-toast";
import type { Chapter } from "@/components/novel-view/ChapterList";

export interface NovelData {
  id: string;
  title: string;
  genre: string[];
  outline: string | null;
  word_count: number;
  settings_json: unknown;
}

export type GenerationMode = "continue" | "continue_chapter" | "rewrite";

interface UseNovelGenerationParams {
  novel: NovelData | null;
  chapters: Chapter[];
  selectedChapter: Chapter | null;
  effectiveProvider: string;
  currentApiKey: string;
  effectiveApiBaseUrl: string | undefined;
  effectiveActualModel: string | undefined;
  onChaptersChange: (updater: (prev: Chapter[]) => Chapter[]) => void;
  onSelectedChapterChange: (updater: (prev: Chapter | null) => Chapter | null) => void;
  onNovelWordCountChange: (nextWordCount: number) => void;
}

/** 一次生成任务：如何构造请求，以及生成完成后如何落库 */
interface GenerationTask {
  mode: GenerationMode;
  /** 前置校验，返回错误文案表示中止 */
  validate: () => string | null;
  buildParams: () => Omit<StreamNovelParams, "model" | "apiKey" | "apiBaseUrl" | "actualModel">;
  /** 把生成结果写入数据库并同步本地状态；返回 false 表示未保存 */
  persist: (fullContent: string) => Promise<boolean>;
  /** 用户中途停止时是否保存已生成的部分内容 */
  persistPartial?: (partialContent: string) => Promise<boolean>;
  successTitle: string;
  errorTitle: string;
}

export function useNovelGeneration({
  novel,
  chapters,
  selectedChapter,
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
  const [generationMode, setGenerationMode] = useState<GenerationMode | null>(null);
  const requestAbortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);

  // 停止时需要拿到当前已生成的内容，用 ref 避免把 streamContent 塞进依赖数组
  const streamContentRef = useRef("");
  const activeTaskRef = useRef<GenerationTask | null>(null);

  useEffect(() => {
    return () => {
      requestAbortControllerRef.current?.abort();
      requestAbortControllerRef.current = null;
      stopRequestedRef.current = true;
    };
  }, []);

  /** 累加小说总字数，失败时提示但不阻断主流程 */
  const applyWordDelta = useCallback(
    async (wordDelta: number) => {
      if (!novel || wordDelta === 0) return;
      const nextWordCount = Math.max(0, (novel.word_count || 0) + wordDelta);
      const { error } = await supabase
        .from("novels")
        .update({ word_count: nextWordCount })
        .eq("id", novel.id);
      if (error) {
        toast({ title: "字数更新失败", description: error.message, variant: "destructive" });
        return;
      }
      onNovelWordCountChange(nextWordCount);
    },
    [novel, onNovelWordCountChange, toast],
  );

  /**
   * 所有生成模式共用的执行流程：中止旧请求 → 流式接收 → 落库 → 释放状态。
   * 各模式的差异全部收敛在 GenerationTask 里。
   */
  const runTask = useCallback(
    async (task: GenerationTask) => {
      if (isGenerating) return;

      const validationError = task.validate();
      if (validationError) {
        toast({ title: "操作失败", description: validationError, variant: "destructive" });
        return;
      }

      setIsGenerating(true);
      setGenerationMode(task.mode);
      setStreamContent("");
      streamContentRef.current = "";
      stopRequestedRef.current = false;
      activeTaskRef.current = task;

      requestAbortControllerRef.current?.abort();
      const controller = new AbortController();
      requestAbortControllerRef.current = controller;

      // 本次请求是否仍然有效（用户可能已停止或发起了新的生成）
      const isStale = () => requestAbortControllerRef.current !== controller;

      let fullContent = "";

      await streamNovelGeneration({
        params: {
          ...task.buildParams(),
          model: effectiveProvider,
          apiKey: currentApiKey,
          apiBaseUrl: effectiveApiBaseUrl,
          actualModel: effectiveActualModel,
        },
        onDelta: (text) => {
          if (isStale()) return;
          fullContent += text;
          streamContentRef.current = fullContent;
          setStreamContent(fullContent);
        },
        onDone: async () => {
          if (isStale()) return;
          requestAbortControllerRef.current = null;
          activeTaskRef.current = null;

          if (stopRequestedRef.current) {
            setIsGenerating(false);
            setGenerationMode(null);
            return;
          }

          try {
            const saved = await task.persist(fullContent);
            if (saved) toast({ title: task.successTitle });
          } catch (e) {
            console.error(e);
            toast({
              title: task.errorTitle,
              description: e instanceof Error ? e.message : "网络异常或服务错误",
              variant: "destructive",
            });
          } finally {
            setStreamContent("");
            streamContentRef.current = "";
            setIsGenerating(false);
            setGenerationMode(null);
          }
        },
        onError: (error) => {
          if (isStale()) return;
          requestAbortControllerRef.current = null;
          activeTaskRef.current = null;
          if (stopRequestedRef.current) return;
          setIsGenerating(false);
          setGenerationMode(null);
          setStreamContent("");
          streamContentRef.current = "";
          toast({ title: task.errorTitle, description: error, variant: "destructive" });
        },
        signal: controller.signal,
      });
    },
    [
      isGenerating,
      effectiveProvider,
      currentApiKey,
      effectiveApiBaseUrl,
      effectiveActualModel,
      toast,
    ],
  );

  /** 生成新的一章并追加到章节列表 */
  const handleContinue = useCallback(() => {
    const nextNum = chapters.length + 1;
    return runTask({
      mode: "continue",
      validate: () => (novel ? null : "请先选择小说"),
      buildParams: () => ({
        mode: "continue",
        settings: novel!.settings_json,
        outline: novel!.outline,
        novelId: novel!.id,
        chapterNumber: nextNum,
      }),
      persist: async (fullContent) => {
        const { title, content } = parseGeneratedChapter(fullContent, `第${nextNum}章`);
        if (content.length < 10) {
          toast({
            title: "生成内容过少",
            description: "生成内容字数不足（少于 10 个字），已拦截保存",
            variant: "destructive",
          });
          return false;
        }

        const { data, error } = await supabase
          .from("chapters")
          .insert({
            novel_id: novel!.id,
            chapter_number: nextNum,
            title,
            content,
            word_count: content.length,
          })
          .select()
          .single();

        if (error) {
          toast({ title: "保存失败", description: error.message, variant: "destructive" });
          return false;
        }

        const newChapter = data as Chapter;
        onChaptersChange((prev) => [...prev, newChapter]);
        onSelectedChapterChange(() => newChapter);
        await applyWordDelta(content.length);
        return true;
      },
      successTitle: "章节已保存",
      errorTitle: "生成失败",
    });
  }, [runTask, novel, chapters.length, onChaptersChange, onSelectedChapterChange, applyWordDelta, toast]);

  /** 重写当前章节 */
  const handleRewrite = useCallback(() => {
    const target = selectedChapter;
    return runTask({
      mode: "rewrite",
      validate: () => (novel && target ? null : "请先选择章节"),
      buildParams: () => ({
        mode: "rewrite",
        settings: novel!.settings_json,
        outline: novel!.outline,
        novelId: novel!.id,
        rewriteContent: target!.content,
      }),
      persist: async (fullContent) => {
        const { title, content } = parseGeneratedChapter(fullContent, target!.title);
        if (content.length < 10) {
          toast({
            title: "重写失败",
            description: "生成的内容过少（少于 10 个字），已拦截保存",
            variant: "destructive",
          });
          return false;
        }

        const { error } = await supabase
          .from("chapters")
          .update({ title, content, word_count: content.length })
          .eq("id", target!.id);

        if (error) {
          toast({ title: "保存失败", description: error.message, variant: "destructive" });
          return false;
        }

        const previousWords = target!.word_count || target!.content.length;
        onChaptersChange((prev) =>
          prev.map((ch) =>
            ch.id === target!.id ? { ...ch, title, content, word_count: content.length } : ch,
          ),
        );
        onSelectedChapterChange((prev) =>
          prev && prev.id === target!.id
            ? { ...prev, title, content, word_count: content.length }
            : prev,
        );
        await applyWordDelta(content.length - previousWords);
        return true;
      },
      successTitle: "重写完成并已保存",
      errorTitle: "重写失败",
    });
  }, [runTask, novel, selectedChapter, onChaptersChange, onSelectedChapterChange, applyWordDelta, toast]);

  /** 在当前章节末尾续写 */
  const handleContinueChapter = useCallback(() => {
    const target = selectedChapter;
    const originalContent = target?.content || "";

    /** 把新生成的内容追加到本章末尾，中途停止与正常结束共用 */
    const appendToChapter = async (appended: string): Promise<boolean> => {
      const trimmed = appended.trim();
      if (!trimmed) return false;

      const nextContent = originalContent ? `${originalContent}\n\n${trimmed}` : trimmed;
      const newWords = nextContent.length;

      const { error } = await supabase
        .from("chapters")
        .update({ content: nextContent, word_count: newWords })
        .eq("id", target!.id);

      if (error) {
        toast({ title: "保存失败", description: error.message, variant: "destructive" });
        return false;
      }

      onChaptersChange((prev) =>
        prev.map((ch) =>
          ch.id === target!.id ? { ...ch, content: nextContent, word_count: newWords } : ch,
        ),
      );
      onSelectedChapterChange((prev) =>
        prev && prev.id === target!.id
          ? { ...prev, content: nextContent, word_count: newWords }
          : prev,
      );
      await applyWordDelta(newWords - originalContent.length);
      return true;
    };

    return runTask({
      mode: "continue_chapter",
      validate: () => (novel && target ? null : "请先选择章节"),
      buildParams: () => ({
        mode: "continue_chapter",
        settings: novel!.settings_json,
        outline: novel!.outline,
        novelId: novel!.id,
        currentText: originalContent,
        currentChapterTitle: target!.title,
        currentChapterNumber: target!.chapter_number,
      }),
      persist: appendToChapter,
      persistPartial: appendToChapter,
      successTitle: "章节已保存",
      errorTitle: "续写失败",
    });
  }, [runTask, novel, selectedChapter, onChaptersChange, onSelectedChapterChange, applyWordDelta, toast]);

  /**
   * 中途停止。若当前任务支持保存部分内容（目前是章节续写），
   * 则先把已生成的内容落库，避免用户的字白写。
   */
  const handleStop = useCallback(async () => {
    stopRequestedRef.current = true;
    requestAbortControllerRef.current?.abort();
    requestAbortControllerRef.current = null;

    const task = activeTaskRef.current;
    const partial = streamContentRef.current;
    activeTaskRef.current = null;

    const hasPartialToSave = Boolean(task?.persistPartial && partial.trim());
    let saveSuccess = false;

    try {
      if (hasPartialToSave) {
        saveSuccess = await task!.persistPartial!(partial);
        if (saveSuccess) toast({ title: "已保存已生成的内容" });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "保存失败",
        description: "网络错误，无法保存最新续写内容",
        variant: "destructive",
      });
    } finally {
      // 容灾：待保存的内容保存失败时保留在屏幕上，否则用户刚生成的正文会凭空消失。
      // 只有「没有东西要存」或「确实存进去了」两种情况才清空。
      if (!hasPartialToSave || saveSuccess) {
        setStreamContent("");
        streamContentRef.current = "";
      }
      setGenerationMode(null);
      setIsGenerating(false);
    }
  }, [toast]);

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
