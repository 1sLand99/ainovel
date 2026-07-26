// 模型输出的章节文本解析
//
// 全项目唯一的章节标题/正文拆分实现。此前 Generate.tsx 与 use-novel-generation.ts
// 各有一份副本，且后者会无条件把首行当作标题剔除，导致模型直接输出正文时
// 第一段被吞掉。统一到这里，避免同类修复只打一半。

export interface ParsedChapter {
  title: string;
  content: string;
}

/** 中文数字 + 阿拉伯数字，用于匹配「第 N 章」 */
const CHAPTER_NUMBER = "[0-9０-９一二三四五六七八九十百千零两]+";
const CHAPTER_HEADING = new RegExp(`^第\\s*${CHAPTER_NUMBER}\\s*[章回节]`);
const CHAPTER_PREFIX = new RegExp(`^第\\s*${CHAPTER_NUMBER}\\s*[章回节][\\s:：、.\\-—]*`);

/** 标题行的长度上限，超过则认为是正文段落而非标题 */
const MAX_TITLE_LENGTH = 50;

/**
 * 判断首行是否为章节标题：markdown 标题，或形如「第三章 惊变」且长度合理。
 * 长度限制用于避免把以「第 N 章」开头的正文段落误判为标题。
 */
function looksLikeTitle(line: string): boolean {
  if (line.startsWith("#")) return true;
  return CHAPTER_HEADING.test(line) && line.length <= MAX_TITLE_LENGTH;
}

/**
 * 拆分模型输出为章节标题与正文。
 *
 * 只有当首行确实像标题时才把它从正文中剔除；否则全文都是正文，
 * 标题使用调用方给出的兜底值。正文保留原有的空行与段落结构。
 *
 * @param raw 模型输出的原始文本
 * @param fallbackTitle 首行不是标题时使用的章节名
 */
export function parseGeneratedChapter(raw: string, fallbackTitle: string): ParsedChapter {
  const text = (raw || "").trim();
  if (!text) return { title: fallbackTitle, content: "" };

  const newlineIndex = text.indexOf("\n");
  const firstLine = (newlineIndex === -1 ? text : text.slice(0, newlineIndex)).trim();
  const rest = newlineIndex === -1 ? "" : text.slice(newlineIndex + 1).trim();

  // 首行不像标题，或剔除首行后正文为空 —— 两种情况都按「全文即正文」处理，
  // 宁可标题用兜底值，也不能丢内容。
  if (!looksLikeTitle(firstLine) || !rest) {
    return { title: fallbackTitle, content: text };
  }

  const title = firstLine.replace(/^#+\s*/, "").replace(CHAPTER_PREFIX, "").trim();
  return { title: title || fallbackTitle, content: rest };
}

/**
 * 依据目标字数推算 max_tokens。
 *
 * 中文按最保守的 1 字 ≈ 1 token 估算，再留 60% 余量给标题和模型的发挥空间，
 * 避免用户把章节字数调高后输出被静默截断。
 */
export function estimateMaxTokens(targetWords: number): number {
  const words = Number.isFinite(targetWords) && targetWords > 0 ? targetWords : 3000;
  return Math.min(32000, Math.max(2048, Math.ceil(words * 1.6)));
}
