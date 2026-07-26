// Streaming helper for novel generation (local direct API call)

import type { NovelSettings } from "@/components/novel-settings/types";
import { normalizeNovelSettings } from "@/components/novel-settings/types";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type GenerationMode,
} from "@/lib/build-prompt";
import { estimateMaxTokens } from "@/lib/parse-chapter";

export interface StreamNovelParams {
  mode: GenerationMode;
  /** 表单设定；来自 DB 的 settings_json 可能是历史结构，内部会统一清洗 */
  settings: NovelSettings | unknown;
  model: string;
  apiKey: string;
  apiBaseUrl?: string;
  actualModel?: string;
  temperature?: number;
  novelId?: string;
  /** 全书大纲，参与提示词拼接以保证续写与大纲一致 */
  outline?: string | null;
  chapterNumber?: number;
  rewriteContent?: string;
  currentText?: string;
  currentChapterTitle?: string;
  currentChapterNumber?: number;
}

export async function streamNovelGeneration({
  params,
  onDelta,
  onDone,
  onError,
  signal,
}: {
  params: StreamNovelParams;
  onDelta: (text: string) => void;
  onDone: () => void | Promise<void>;
  onError: (error: string) => void;
  signal?: AbortSignal;
}) {
  const provider = params.model.toLowerCase();
  const isClaude = provider === "claude";
  const apiKey = params.apiKey || "";
  const baseUrl =
    params.apiBaseUrl || (isClaude ? "https://api.anthropic.com/v1" : "https://api.openai.com/v1");

  // 格式化 API 端点
  const endpoint = isClaude
    ? baseUrl.endsWith("/messages")
      ? baseUrl
      : `${baseUrl.trim().replace(/\/+$/, "")}/messages`
    : baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : `${baseUrl.trim().replace(/\/+$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (isClaude) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  // 统一清洗后再拼接提示词，保证表单里的每一项设定都能进入 prompt
  const settings = normalizeNovelSettings(params.settings);
  const systemPrompt = buildSystemPrompt(params.mode);
  const userPrompt = buildUserPrompt({
    mode: params.mode,
    settings,
    outline: params.outline,
    chapterNumber: params.chapterNumber,
    rewriteContent: params.rewriteContent,
    currentText: params.currentText,
    currentChapterTitle: params.currentChapterTitle,
    currentChapterNumber: params.currentChapterNumber,
  });

  // 大纲与人物卡不受单章字数约束，其余模式按目标字数推算上限
  const maxTokens =
    params.mode === "outline" || params.mode === "characters"
      ? 8192
      : estimateMaxTokens(settings.chapterWords);

  // temperature 允许为 0（保守模式），必须用 ?? 而非 ||
  const temperature = params.temperature ?? settings.writingStyle.temperature ?? 0.7;

  const requestBody = isClaude
    ? {
        model: params.actualModel || "claude-3-5-sonnet-20241022",
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        stream: true,
        temperature,
        max_tokens: maxTokens,
      }
    : {
        model: params.actualModel || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
        temperature,
        max_tokens: maxTokens,
      };

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!resp.ok) {
      const rawText = await resp.text();
      if (resp.status === 401 || resp.status === 403) {
        onError(
          `API Key 无效或无权访问 [状态码 ${resp.status}]，请到「模型设置」检查 API Key 与 API 地址是否匹配`,
        );
        return;
      }
      onError(`本地直连 API 失败 [状态码 ${resp.status}]: ${rawText.slice(0, 200) || "无错误详情"}`);
      return;
    }

    if (!resp.body) {
      onError("无法获取流式响应");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    /**
     * 上一行 JSON 解析失败时暂存的 payload。
     *
     * 唯一合法的成因是：payload 内部含有原始换行符，被我们按 \n 切行时切断了。
     * 因此下一行会尝试与它拼接（不还原换行符，那个换行是切分产物）。拼不上就
     * 说明它本来就是坏数据 —— 丢弃它，并把当前行当作全新的一行重新处理。
     *
     * 关键点是绝不把坏行塞回 buffer：那会让坏行反复参与解析，把它后面本来正常
     * 的数据一起拖垮（此前 “坏包 + 正常包” 相邻时后续内容会整段丢失）。
     */
    let pending: string | null = null;
    /** pending 的长度上限，防止畸形流把内存吃光 */
    const MAX_PENDING = 1_000_000;

    /** 解析一条 payload 并派发增量；返回是否解析成功 */
    const consume = (payload: string): boolean => {
      let parsed: any;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return false;
      }
      if (isClaude) {
        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
          onDelta(parsed.delta.text);
        }
      } else {
        const content = parsed.choices?.[0]?.delta?.content;
        if (typeof content === "string" && content) onDelta(content);
      }
      return true;
    };

    /** 处理一条完整的 SSE 行；返回 true 表示流已正常结束（收到 [DONE]） */
    const handleLine = (rawLine: string): boolean => {
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

      if (pending !== null) {
        const candidate = pending + line;
        pending = null;
        if (candidate.length <= MAX_PENDING && consume(candidate)) return false;
        // 拼接失败：说明 pending 是坏数据，丢弃后按新行继续处理当前行
      }

      if (line.startsWith(":") || line.trim() === "") return false;
      if (!line.startsWith("data:")) return false;

      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return true;
      if (!payload) return false;

      if (!consume(payload)) pending = payload;
      return false;
    };

    let finished = false;
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (handleLine(line)) {
          finished = true;
          break;
        }
      }
    }

    // buffer 中可能还留有最后一条没有换行符结尾的完整行
    if (!finished && buffer.trim()) handleLine(buffer);

    await onDone();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return;
    const message = e instanceof Error ? e.message : "";
    onError(
      message || "直连大模型时发生网络连接错误（请检查您的网络代理或 API 地址是否正确）",
    );
  }
}
