// 小说提示词拼接
//
// 全项目唯一的提示词构造入口：既服务于「生成小说提示词」的剪贴板导出，
// 也服务于 stream-novel.ts 的真实 API 调用。两条路径必须共用同一份实现，
// 否则表单里填写的设定会在其中一条路径上被静默丢弃。

import type { NovelSettings } from "@/components/novel-settings/types";

export type GenerationMode =
  | "generate"
  | "outline"
  | "characters"
  | "rewrite"
  | "continue"
  | "continue_chapter";

export interface PromptContext {
  mode: GenerationMode;
  settings: NovelSettings;
  /** 已生成的全书大纲，用于保证续写与大纲一致 */
  outline?: string | null;
  chapterNumber?: number;
  /** rewrite 模式下待重写的章节原文 */
  rewriteContent?: string;
  /** continue_chapter 模式下本章已写的内容 */
  currentText?: string;
  currentChapterTitle?: string;
  currentChapterNumber?: number;
}

/**
 * 拼接完整的设定描述块（不含任务指令）。
 * 覆盖 NovelSettings 的全部字段，任何新增设定项都应在此登记。
 */
export function buildSettingsBlock(s: NovelSettings): string {
  const lines: string[] = [];

  lines.push("【作品信息】");
  lines.push(`题材：${s.genres.join("、") || "未指定"}`);
  lines.push(`一句话简介：${s.oneLinePitch || "未填写"}`);
  lines.push("");

  lines.push("【主角设定】");
  lines.push(
    `姓名：${s.mainCharacter.name || "未命名"}，性别：${s.mainCharacter.gender}，年龄：${
      s.mainCharacter.age || "未知"
    }，性格：${s.mainCharacter.personality || "未填写"}`,
  );
  lines.push("");

  if (s.sideCharacters.length) {
    lines.push("【配角设定】");
    s.sideCharacters.forEach((c, idx) => {
      const relation = c.relationshipCustom || c.relationship || "未填写关系";
      const tags = c.personalityTags.join("、") || "未填写性格";
      lines.push(
        `${idx + 1}. ${c.name || "未命名"}（${relation}）：性格【${tags}】，背景【${
          c.background || "未填写"
        }】，能力/弱点【${c.abilities || "未填写"}】，故事作用【${c.role || "未填写"}】，人物弧光【${
          c.arcCustom || c.arc || "未填写"
        }】`,
      );
    });
    lines.push("");
  }

  if (s.antagonists.length) {
    lines.push("【反派 / 敌人】");
    s.antagonists.forEach((c, idx) => {
      const relation = c.relationshipCustom || c.relationship || "未填写关系";
      const tags = c.personalityTags.join("、") || "未填写性格";
      lines.push(
        `${idx + 1}. ${c.name || "未命名"}（${relation}）：性格【${tags}】，背景【${
          c.background || "未填写"
        }】，能力/弱点【${c.abilities || "未填写"}】，动机【${
          c.motive || "未填写"
        }】，最终下场【${c.fate || "未填写"}】，人物弧光【${
          c.arcCustom || c.arc || "未填写"
        }】`,
      );
    });
    lines.push("");
  }

  lines.push("【世界观与规则】");
  lines.push(`整体背景：${s.worldSummary || "未填写"}`);
  lines.push(`核心冲突 / 主题：${s.conflictTheme || "未填写"}`);
  lines.push(`力量 / 科技 / 修炼体系：${s.worldDetails.powerSystem || "未填写"}`);
  lines.push(`社会结构与势力分布：${s.worldDetails.factions || "未填写"}`);
  lines.push(`历史重大事件：${s.worldDetails.historyEvents || "未填写"}`);
  lines.push(`重要地点：${s.worldDetails.importantLocations || "未填写"}`);
  lines.push(`文化习俗与禁忌：${s.worldDetails.cultureAndTaboos || "未填写"}`);
  lines.push("");

  lines.push("【情节大纲】");
  lines.push(`开头（前 30%）：${s.opening || "未填写"}`);
  if (s.middleBeats.length) {
    lines.push("中段高潮与关键转折：");
    s.middleBeats.forEach((b, idx) => {
      lines.push(`${idx + 1}. ${b.title || "未命名节点"}：${b.detail || "未填写"}`);
    });
  }
  if (s.subplots.length) {
    lines.push("主要副线：");
    s.subplots.forEach((b, idx) => {
      lines.push(`${idx + 1}. ${b.title || "未命名副线"}：${b.detail || "未填写"}`);
    });
  }
  lines.push(`结局类型：${s.endingType || "未指定"}`);
  lines.push("");

  lines.push("【写作风格与重点】");
  lines.push(`叙述视角：${s.writingStyle.narration}`);
  lines.push(`整体语气：${s.writingStyle.tones.join("、") || "未指定"}`);
  lines.push(`金手指程度：${s.writingStyle.cheatLevel}`);
  lines.push(`重点描写内容：${s.writingStyle.focusAreas.join("、") || "未指定"}`);
  lines.push(
    `建议篇幅：全书约 ${s.totalWords} 字，每章约 ${s.writingStyle.wordsPerChapter} 字，temperature≈${s.writingStyle.temperature}`,
  );
  if (s.nsfw) lines.push("允许适度 NSFW 内容。");
  if (s.systemNovel) lines.push("这是系统文，主角拥有类似面板/系统等金手指。");
  if (s.harem) lines.push("允许存在后宫元素。");
  lines.push("");

  if (s.taboos.length) {
    const filled = s.taboos.filter((t) => t.content.trim());
    if (filled.length) {
      lines.push("【写作禁忌】");
      filled.forEach((t, idx) => lines.push(`${idx + 1}. ${t.content.trim()}`));
      lines.push("");
    }
  }

  if (s.references.length) {
    lines.push("【参考作品与借鉴点】");
    s.references.forEach((r, idx) => {
      lines.push(`${idx + 1}. 《${r.title || "未命名"}》：${r.inspiration || "未填写借鉴点"}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

/** 供「复制提示词」按钮使用：设定块 + 首尾的角色扮演与约束说明 */
export function buildCopyPrompt(s: NovelSettings): string {
  return [
    "你现在是一名经验丰富的中文网络小说作者，请严格按照以下设定创作：",
    "",
    buildSettingsBlock(s),
    "请在创作过程中严格遵守以上所有设定，保证人物行为、世界观规则和情节发展前后一致。",
  ].join("\n");
}

/** 按生成模式拼接具体任务指令 */
function buildTaskInstruction(ctx: PromptContext): string {
  const { settings: s } = ctx;
  switch (ctx.mode) {
    case "outline":
      return `请生成一个详细的长篇小说大纲，预计总字数：${s.totalWords} 字。用结构化 markdown 输出，包含分卷、关键剧情节点与人物成长线。`;
    case "characters":
      return "请为这部小说生成 3-5 个主要角色的详细人物卡，包含外貌、性格、背景、能力与人物弧光。";
    case "rewrite":
      return [
        "以下是需要重写的章节内容：",
        "",
        ctx.rewriteContent ?? "",
        "",
        `请帮我重新润色和重写本章，保持剧情走向不变，篇幅约 ${s.chapterWords} 字。`,
        "请在第一行输出章节标题，随后空一行再输出正文。",
      ].join("\n");
    case "continue_chapter":
      return [
        `以下是第${ctx.currentChapterNumber ?? 1}章《${ctx.currentChapterTitle ?? "未命名"}》已写的内容：`,
        "",
        ctx.currentText ?? "",
        "",
        "请在这段内容末尾直接继续往下续写，保持剧情连贯与风格统一。",
        "只输出续写的正文，不要重复已有内容，也不要输出章节标题。",
      ].join("\n");
    case "continue":
      return [
        `请继续创作第${ctx.chapterNumber ?? 1}章，篇幅约 ${s.chapterWords} 字。`,
        "请在第一行输出章节标题，随后空一行再输出正文。",
      ].join("\n");
    case "generate":
    default:
      return [
        `请生成第${ctx.chapterNumber ?? 1}章，篇幅约 ${s.chapterWords} 字。`,
        "请在第一行输出章节标题，随后空一行再输出正文。",
      ].join("\n");
  }
}

/** 拼接发送给模型的完整 user prompt */
export function buildUserPrompt(ctx: PromptContext): string {
  const parts = [buildSettingsBlock(ctx.settings)];

  const outline = ctx.outline?.trim();
  if (outline) {
    parts.push("【全书大纲】", outline, "");
  }

  parts.push(buildTaskInstruction(ctx));
  return parts.join("\n");
}

/** 按生成模式返回 system prompt */
export function buildSystemPrompt(mode: GenerationMode): string {
  if (mode === "outline") {
    return "You are a top Chinese web novelist. Generate a detailed novel outline in simplified Chinese. Format as structured markdown.";
  }
  if (mode === "characters") {
    return "You are a top Chinese web novelist. Generate detailed character profiles in simplified Chinese. Format as structured markdown.";
  }
  return "You are a top Chinese web novelist with 15 years experience. Write in beautiful, addictive simplified Chinese.";
}
