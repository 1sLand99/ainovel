// 所有可选的小说类型（题材）
const randomId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const ALL_NOVEL_GENRES = [
  "玄幻",
  "仙侠",
  "奇幻",
  "武侠",
  "都市",
  "言情",
  "科幻",
  "系统文",
  "后宫",
  "无限流",
  "悬疑",
  "历史",
  "军事",
  "游戏",
  "末世",
  "穿越",
  "重生",
  "网游",
  "竞技",
  "机甲",
  "星际",
  "灵异",
  "恐怖",
  "宫斗",
  "种田",
  "娱乐圈",
  "盗墓",
  "洪荒",
] as const;

export type NovelGenre = (typeof ALL_NOVEL_GENRES)[number];

export type RelationshipType =
  | "盟友"
  | "恋人"
  | "导师"
  | "死敌"
  | "家人"
  | "竞争者"
  | "炮灰"
  | "同门"
  | "队友"
  | "上司"
  | "下属"
  | "其他";

export type CharacterArc = "成长" | "黑化" | "救赎" | "牺牲" | "退场" | "保持不变" | "其他";

export type EndingType = "HE" | "BE" | "开放" | "大团圆" | "虐" | "爽" | "开放式";

export type NarrationType = "第一人称" | "第三人称有限" | "全知视角";

export type ToneType =
  | "热血"
  | "黑暗"
  | "轻松"
  | "细腻"
  | "幽默"
  | "压抑"
  | "爽快"
  | "文艺"
  | "写实";

export type CheatLevel = "无敌流" | "稳步成长" | "真实吃力" | "反转流" | "废柴逆袭";

export type FocusArea =
  | "战斗"
  | "感情"
  | "智斗"
  | "日常"
  | "装逼"
  | "后宫"
  | "权谋"
  | "经营";

export interface MainCharacter {
  name: string;
  gender: "男" | "女" | "其他";
  age: string;
  personality: string;
}

export interface CharacterBase {
  id: string;
  name: string;
  nickname: string;
  gender: "男" | "女" | "其他";
  age: string;
  relationship: RelationshipType | "";
  relationshipCustom: string;
  personalityTags: string[];
  background: string;
  abilities: string;
  role: string;
  arc: CharacterArc | "";
  arcCustom: string;
}

export interface SideCharacter extends CharacterBase {}

export interface Antagonist extends CharacterBase {
  motive: string;
  fate: string;
}

export interface WorldDetails {
  powerSystem: string;
  factions: string;
  historyEvents: string;
  importantLocations: string;
  cultureAndTaboos: string;
}

export interface PlotBeat {
  id: string;
  title: string;
  detail: string;
}

export interface WritingStyle {
  narration: NarrationType;
  tones: ToneType[];
  cheatLevel: CheatLevel;
  focusAreas: FocusArea[];
  wordsPerChapter: number;
  temperature: number;
}

export interface TabooRule {
  id: string;
  content: string;
}

export interface ReferenceWork {
  id: string;
  title: string;
  inspiration: string;
}

export interface NovelSettings {
  // 基础信息
  genres: NovelGenre[];
  oneLinePitch: string;
  // 主角
  mainCharacter: MainCharacter;
  // 角色
  sideCharacters: SideCharacter[];
  antagonists: Antagonist[];
  // 世界观
  worldSummary: string;
  conflictTheme: string;
  worldDetails: WorldDetails;
  // 情节
  opening: string;
  middleBeats: PlotBeat[];
  endingType: EndingType | "";
  subplots: PlotBeat[];
  // 写作风格
  writingStyle: WritingStyle;
  // 规模与开关
  totalWords: number;
  chapterWords: number;
  nsfw: boolean;
  systemNovel: boolean;
  harem: boolean;
  // 约束与参考
  taboos: TabooRule[];
  references: ReferenceWork[];
}

export const createEmptySideCharacter = (): SideCharacter => ({
  id: randomId(),
  name: "",
  nickname: "",
  gender: "男",
  age: "",
  relationship: "",
  relationshipCustom: "",
  personalityTags: [],
  background: "",
  abilities: "",
  role: "",
  arc: "",
  arcCustom: "",
});

export const createEmptyAntagonist = (): Antagonist => ({
  ...createEmptySideCharacter(),
  id: randomId(),
  motive: "",
  fate: "",
});

export const createEmptyPlotBeat = (): PlotBeat => ({
  id: randomId(),
  title: "",
  detail: "",
});

export const createEmptyTaboo = (): TabooRule => ({
  id: randomId(),
  content: "",
});

export const createEmptyReferenceWork = (): ReferenceWork => ({
  id: randomId(),
  title: "",
  inspiration: "",
});

export const createDefaultNovelSettings = (): NovelSettings => ({
  genres: [],
  oneLinePitch: "",
  mainCharacter: {
    name: "",
    gender: "男",
    age: "",
    personality: "",
  },
  sideCharacters: [],
  antagonists: [],
  worldSummary: "",
  conflictTheme: "",
  worldDetails: {
    powerSystem: "",
    factions: "",
    historyEvents: "",
    importantLocations: "",
    cultureAndTaboos: "",
  },
  opening: "",
  middleBeats: [],
  endingType: "",
  subplots: [],
  writingStyle: {
    narration: "第三人称有限",
    tones: [],
    cheatLevel: "稳步成长",
    focusAreas: [],
    wordsPerChapter: 3000,
    temperature: 0.7,
  },
  totalWords: 100000,
  chapterWords: 3000,
  nsfw: false,
  systemNovel: false,
  harem: false,
  taboos: [],
  references: [],
});

/* ------------------------------------------------------------------ *
 * 外部数据清洗
 *
 * 设定对象有三个不受信任的来源：localStorage 缓存、用户导入的 JSON 文件、
 * 数据库中历史版本写入的 settings_json。它们都可能字段缺失或类型错误，
 * 因此统一在这里做一次清洗，保证下游（尤其是提示词拼接中的 .join /
 * .forEach 等数组操作）永远拿到符合 NovelSettings 的结构。
 * ------------------------------------------------------------------ */

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

/** 仅保留数组中属于给定枚举集合的字符串项 */
const asEnumArray = <T extends string>(value: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(value) ? value.filter((item): item is T => allowed.includes(item as T)) : [];

/** 按 factory 生成的空对象为模板，逐项合并数组元素 */
const asObjectArray = <T>(value: unknown, factory: () => T): T[] =>
  Array.isArray(value)
    ? value.map((item) => ({ ...factory(), ...(isPlainObject(item) ? item : {}) }))
    : [];

/** 校验取值是否属于枚举，否则回退 */
const asEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const ALL_NARRATIONS: readonly NarrationType[] = ["第一人称", "第三人称有限", "全知视角"];
const ALL_TONES: readonly ToneType[] = [
  "热血", "黑暗", "轻松", "细腻", "幽默", "压抑", "爽快", "文艺", "写实",
];
const ALL_CHEAT_LEVELS: readonly CheatLevel[] = [
  "无敌流", "稳步成长", "真实吃力", "反转流", "废柴逆袭",
];
const ALL_FOCUS_AREAS: readonly FocusArea[] = [
  "战斗", "感情", "智斗", "日常", "装逼", "后宫", "权谋", "经营",
];
const ALL_ENDING_TYPES: readonly EndingType[] = [
  "HE", "BE", "开放", "大团圆", "虐", "爽", "开放式",
];
const ALL_GENDERS: readonly MainCharacter["gender"][] = ["男", "女", "其他"];

/**
 * 把任意来源的数据清洗为合法的 NovelSettings。
 * @param raw 待清洗的原始数据（可能是任何类型）
 * @param base 缺省值基准，默认使用出厂设定
 */
export function normalizeNovelSettings(
  raw: unknown,
  base: NovelSettings = createDefaultNovelSettings(),
): NovelSettings {
  if (!isPlainObject(raw)) return base;

  const mainCharacter = isPlainObject(raw.mainCharacter) ? raw.mainCharacter : {};
  const worldDetails = isPlainObject(raw.worldDetails) ? raw.worldDetails : {};
  const writingStyle = isPlainObject(raw.writingStyle) ? raw.writingStyle : {};

  return {
    genres: Array.isArray(raw.genres)
      ? asEnumArray(raw.genres, ALL_NOVEL_GENRES)
      : base.genres,
    oneLinePitch: asString(raw.oneLinePitch, base.oneLinePitch),
    mainCharacter: {
      name: asString(mainCharacter.name, base.mainCharacter.name),
      gender: asEnum(mainCharacter.gender, ALL_GENDERS, base.mainCharacter.gender),
      age: asString(mainCharacter.age, base.mainCharacter.age),
      personality: asString(mainCharacter.personality, base.mainCharacter.personality),
    },
    sideCharacters: Array.isArray(raw.sideCharacters)
      ? asObjectArray(raw.sideCharacters, createEmptySideCharacter)
      : base.sideCharacters,
    antagonists: Array.isArray(raw.antagonists)
      ? asObjectArray(raw.antagonists, createEmptyAntagonist)
      : base.antagonists,
    worldSummary: asString(raw.worldSummary, base.worldSummary),
    conflictTheme: asString(raw.conflictTheme, base.conflictTheme),
    worldDetails: {
      powerSystem: asString(worldDetails.powerSystem, base.worldDetails.powerSystem),
      factions: asString(worldDetails.factions, base.worldDetails.factions),
      historyEvents: asString(worldDetails.historyEvents, base.worldDetails.historyEvents),
      importantLocations: asString(
        worldDetails.importantLocations,
        base.worldDetails.importantLocations,
      ),
      cultureAndTaboos: asString(
        worldDetails.cultureAndTaboos,
        base.worldDetails.cultureAndTaboos,
      ),
    },
    opening: asString(raw.opening, base.opening),
    middleBeats: Array.isArray(raw.middleBeats)
      ? asObjectArray(raw.middleBeats, createEmptyPlotBeat)
      : base.middleBeats,
    endingType: raw.endingType === "" ? "" : asEnum(raw.endingType, ALL_ENDING_TYPES, base.endingType || ""),
    subplots: Array.isArray(raw.subplots)
      ? asObjectArray(raw.subplots, createEmptyPlotBeat)
      : base.subplots,
    writingStyle: {
      narration: asEnum(writingStyle.narration, ALL_NARRATIONS, base.writingStyle.narration),
      tones: Array.isArray(writingStyle.tones)
        ? asEnumArray(writingStyle.tones, ALL_TONES)
        : base.writingStyle.tones,
      cheatLevel: asEnum(writingStyle.cheatLevel, ALL_CHEAT_LEVELS, base.writingStyle.cheatLevel),
      focusAreas: Array.isArray(writingStyle.focusAreas)
        ? asEnumArray(writingStyle.focusAreas, ALL_FOCUS_AREAS)
        : base.writingStyle.focusAreas,
      wordsPerChapter: asNumber(
        writingStyle.wordsPerChapter,
        base.writingStyle.wordsPerChapter,
      ),
      temperature: asNumber(writingStyle.temperature, base.writingStyle.temperature),
    },
    totalWords: asNumber(raw.totalWords, base.totalWords),
    chapterWords: asNumber(raw.chapterWords, base.chapterWords),
    nsfw: asBoolean(raw.nsfw, base.nsfw),
    systemNovel: asBoolean(raw.systemNovel, base.systemNovel),
    harem: asBoolean(raw.harem, base.harem),
    taboos: Array.isArray(raw.taboos)
      ? asObjectArray(raw.taboos, createEmptyTaboo)
      : base.taboos,
    references: Array.isArray(raw.references)
      ? asObjectArray(raw.references, createEmptyReferenceWork)
      : base.references,
  };
}

