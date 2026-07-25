import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { streamNovelGeneration } from "@/lib/stream-novel";
import { useModelProviders } from "@/hooks/use-model-providers";
import { BookOpen, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { NovelSettingsForm, GenerateMode } from "@/components/novel-settings/NovelSettingsForm";
import { NovelSettings } from "@/components/novel-settings/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Generate() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [generationMode, setGenerationMode] = useState("");
  const abortRef = useRef(false);
  const requestAbortControllerRef = useRef<AbortController | null>(null);
  const [latestSettings, setLatestSettings] = useState<NovelSettings | null>(null);

  const {
    effectiveProvider,
    currentApiKey,
    effectiveApiBaseUrl,
    effectiveActualModel,
    displayModelName,
  } = useModelProviders();

  // Auto-scroll preview
  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.scrollTop = previewRef.current.scrollHeight;
    }
  }, [previewContent]);

  useEffect(() => {
    return () => {
      requestAbortControllerRef.current?.abort();
      requestAbortControllerRef.current = null;
    };
  }, []);

  const handleGenerate = async (mode: GenerateMode, settings: NovelSettings) => {
    if (!session?.access_token) {
      toast({ title: "未登录", description: "请先登录", variant: "destructive" });
      return;
    }
    setLatestSettings(settings);
    setIsGenerating(true);
    setPreviewContent("");
    setGenerationMode(mode);
    abortRef.current = false;
    requestAbortControllerRef.current?.abort();
    const controller = new AbortController();
    requestAbortControllerRef.current = controller;
    let fullContent = "";

    await streamNovelGeneration({
      params: {
        mode,
        settings,
        model: effectiveProvider,
        apiKey: currentApiKey,
        apiBaseUrl: effectiveApiBaseUrl,
        actualModel: effectiveActualModel,
        temperature: settings.writingStyle.temperature,
        chapterNumber: 1,
      },
      onDelta: (text) => {
        if (abortRef.current) return;
        fullContent += text;
        setPreviewContent(fullContent);
      },
      onDone: async () => {
        requestAbortControllerRef.current = null;
        setIsGenerating(false);
        if (abortRef.current) return;

        // Auto-save based on mode
        if (mode === "generate" && user) {
          try {
            const lines = fullContent.split("\n").filter((l) => l.trim());
            // 智能检测第一行是否为章节标题
            const firstLine = lines[0] || "";
            const isTitleLine = /^#+\s*/.test(firstLine) || /^第.+章/.test(firstLine);
            let chapterTitle: string;
            let chapterContent: string;
            if (isTitleLine) {
              chapterTitle = firstLine.replace(/^#+\s*/, "").replace(/^第.+章\s*/, "") || "第一章";
              chapterContent = lines.slice(1).join("\n").trim();
            } else {
              chapterTitle = "第一章";
              chapterContent = fullContent.trim();
            }
            // 如果解析后内容为空，回退使用完整内容
            if (!chapterContent) {
              chapterContent = fullContent.trim();
            }
            const initialWordCount = chapterContent.length;

            // Create novel
            const { data: novel, error: novelErr } = await supabase
              .from("novels")
              .insert({
                user_id: user.id,
                title: settings.mainCharacter.name
                  ? `${settings.mainCharacter.name}的故事`
                  : "未命名小说",
                genre: settings.genres,
                settings_json: settings,
                word_count: initialWordCount,
              })
              .select()
              .single();

            if (novelErr) throw novelErr;

            const { error: chapterErr } = await supabase.from("chapters").insert({
              novel_id: novel.id,
              chapter_number: 1,
              title: chapterTitle,
              content: chapterContent,
              word_count: chapterContent.length,
            });
            if (chapterErr) throw chapterErr;

            toast({ title: "创作完成", description: "小说已自动保存到书库" });
          } catch (e: any) {
            toast({ title: "保存失败", description: e.message, variant: "destructive" });
          }
        } else if (mode === "outline" && user) {
          toast({ title: "大纲生成完成", description: "开始创作时将自动使用此大纲" });
        } else if (mode === "characters") {
          toast({ title: "人物卡生成完成" });
        }
      },
      onError: (error) => {
        requestAbortControllerRef.current = null;
        if (abortRef.current) return;
        setIsGenerating(false);
        toast({ title: "生成失败", description: error, variant: "destructive" });
      },
      signal: controller.signal,
    });
  };

  const handleStop = () => {
    abortRef.current = true;
    requestAbortControllerRef.current?.abort();
    requestAbortControllerRef.current = null;
    setIsGenerating(false);
  };

  const previewArea = (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex h-12 items-center justify-between border-b border-border/50 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">实时预览</span>
        </div>
        {isGenerating && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在创作中...
          </div>
        )}
      </div>
      <div ref={previewRef} className="flex-1 overflow-auto p-4 md:p-8">
        {previewContent ? (
          <div className="mx-auto max-w-3xl glass p-6 md:p-12 rounded-xl shadow-xl font-serif text-base leading-loose text-foreground/90 border border-white/20 dark:border-white/5 relative overflow-hidden">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="mb-6 text-2xl font-bold text-center">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-4 mt-8 text-xl font-bold">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-3 mt-6 text-lg font-semibold">{children}</h3>,
                p: ({ children }) => <p className="mb-4 indent-8 leading-loose">{children}</p>,
                code: ({ children }) => <pre className="my-4 rounded-lg bg-muted p-4 text-sm overflow-x-auto"><code>{children}</code></pre>,
              }}
            >
              {previewContent}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-muted-foreground">
            <div>
              <BookOpen className="mx-auto mb-4 h-16 w-16 opacity-20 animate-pulse text-primary" />
              <p className="text-lg">设定好参数后，点击“开始创作”</p>
              <p className="text-sm">AI将在这里实时生成你的小说</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-3rem)] md:h-screen bg-gradient-soft bg-[length:200%_200%] animate-gradient-slow">
      {/* 移动端: Tab 切换 */}
      <div className="h-full md:hidden">
        <Tabs defaultValue="settings" className="h-full flex flex-col">
          <TabsList className="mx-4 mt-2 w-auto">
            <TabsTrigger value="settings">创作设定</TabsTrigger>
            <TabsTrigger value="preview">
              实时预览
              {isGenerating && <Loader2 className="ml-1 h-3 w-3 animate-spin" />}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="settings" className="flex-1 overflow-auto mt-0">
            <NovelSettingsForm
              modelName={displayModelName}
              isGenerating={isGenerating}
              onGenerate={handleGenerate}
              onStop={handleStop}
            />
          </TabsContent>
          <TabsContent value="preview" className="flex-1 overflow-hidden mt-0">
            {previewArea}
          </TabsContent>
        </Tabs>
      </div>

      {/* 桌面端: 左右分栏 */}
      <div className="hidden md:flex h-full">
        <NovelSettingsForm
          modelName={displayModelName}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          onStop={handleStop}
        />
        <div className="flex-1">
          {previewArea}
        </div>
      </div>
    </div>
  );
}
