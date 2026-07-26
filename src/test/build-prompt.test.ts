import { describe, it, expect } from "vitest";
import { buildSettingsBlock, buildUserPrompt, buildCopyPrompt } from "@/lib/build-prompt";
import {
  createDefaultNovelSettings,
  createEmptySideCharacter,
  createEmptyAntagonist,
  createEmptyPlotBeat,
  createEmptyTaboo,
  createEmptyReferenceWork,
  normalizeNovelSettings,
  type NovelSettings,
} from "@/components/novel-settings/types";

/** 一份把所有设定项都填满的表单数据 */
function fullSettings(): NovelSettings {
  const s = createDefaultNovelSettings();
  s.genres = ["仙侠", "重生"];
  s.oneLinePitch = "一句话简介内容";
  s.mainCharacter = { name: "林轩", gender: "男", age: "18", personality: "冷静" };
  s.sideCharacters = [{ ...createEmptySideCharacter(), name: "苏挽月", background: "药王谷弟子" }];
  s.antagonists = [{ ...createEmptyAntagonist(), name: "魔尊", motive: "夺取仙器" }];
  s.worldSummary = "九州大陆";
  s.conflictTheme = "正邪之争";
  s.worldDetails = {
    powerSystem: "炼气到大乘九重",
    factions: "三大宗门鼎立",
    historyEvents: "百年前的仙魔大战",
    importantLocations: "青云峰",
    cultureAndTaboos: "禁止同门相残",
  };
  s.opening = "废柴少年获得传承";
  s.middleBeats = [{ ...createEmptyPlotBeat(), title: "宗门大比", detail: "一鸣惊人" }];
  s.subplots = [{ ...createEmptyPlotBeat(), title: "身世之谜", detail: "牵出上古恩怨" }];
  s.endingType = "HE";
  s.writingStyle = {
    narration: "第三人称有限",
    tones: ["热血", "爽快"],
    cheatLevel: "稳步成长",
    focusAreas: ["战斗", "智斗"],
    wordsPerChapter: 3000,
    temperature: 0.8,
  };
  s.totalWords = 200000;
  s.chapterWords = 3000;
  s.taboos = [{ ...createEmptyTaboo(), content: "不写现代科技" }];
  s.references = [{ ...createEmptyReferenceWork(), title: "凡人修仙传", inspiration: "稳健流" }];
  return s;
}

describe("提示词拼接：表单里的每一项设定都必须进入 prompt", () => {
  it("设定块覆盖全部字段，不遗漏世界观、情节、禁忌与参考作品", () => {
    const block = buildSettingsBlock(fullSettings());

    // 曾经因字段名写错（geography / rules / tone / synopsis）而被整体丢弃的部分
    expect(block).toContain("炼气到大乘九重");
    expect(block).toContain("三大宗门鼎立");
    expect(block).toContain("百年前的仙魔大战");
    expect(block).toContain("青云峰");
    expect(block).toContain("禁止同门相残");
    expect(block).toContain("热血、爽快");
    expect(block).toContain("一句话简介内容");

    // 曾经完全没有被读取过的部分
    expect(block).toContain("苏挽月");
    expect(block).toContain("魔尊");
    expect(block).toContain("废柴少年获得传承");
    expect(block).toContain("宗门大比");
    expect(block).toContain("身世之谜");
    expect(block).toContain("不写现代科技");
    expect(block).toContain("凡人修仙传");
    expect(block).toContain("战斗、智斗");
  });

  it("剪贴板提示词与真实 API 提示词共用同一个设定块", () => {
    const settings = fullSettings();
    const block = buildSettingsBlock(settings);

    expect(buildCopyPrompt(settings)).toContain(block);
    expect(buildUserPrompt({ mode: "generate", settings })).toContain(block);
  });

  it("大纲会被拼进提示词，续写因此能与大纲保持一致", () => {
    const prompt = buildUserPrompt({
      mode: "continue",
      settings: fullSettings(),
      outline: "第一卷：出山；第二卷：入宗",
      chapterNumber: 7,
    });

    expect(prompt).toContain("【全书大纲】");
    expect(prompt).toContain("第一卷：出山；第二卷：入宗");
    expect(prompt).toContain("第7章");
  });

  it("没有大纲时不会出现空的大纲小节", () => {
    const prompt = buildUserPrompt({ mode: "continue", settings: fullSettings(), outline: null });
    expect(prompt).not.toContain("【全书大纲】");
  });

  it("清洗后的历史数据同样能安全拼接，不会因类型错误抛异常", () => {
    const legacy = normalizeNovelSettings({
      genres: "仙侠",
      worldDetails: { geography: "旧字段", rules: "旧字段" },
      writingStyle: { tone: "热血" },
      taboos: null,
    });

    expect(() => buildUserPrompt({ mode: "generate", settings: legacy })).not.toThrow();
    expect(legacy.genres).toEqual([]);
    expect(legacy.writingStyle.tones).toEqual([]);
    expect(legacy.taboos).toEqual([]);
  });
});

describe("设定清洗 normalizeNovelSettings", () => {
  it("拒绝非数组的 genres 并回退为空数组", () => {
    for (const bad of ["仙侠", { name: "仙侠" }, 12345, null, undefined]) {
      expect(normalizeNovelSettings({ genres: bad }).genres).toEqual([]);
    }
  });

  it("过滤掉不在枚举内的题材", () => {
    expect(normalizeNovelSettings({ genres: ["仙侠", "不存在的题材", 42] }).genres).toEqual([
      "仙侠",
    ]);
  });

  it("非对象输入直接返回基准值", () => {
    const base = createDefaultNovelSettings();
    expect(normalizeNovelSettings(null, base)).toBe(base);
    expect(normalizeNovelSettings("字符串", base)).toBe(base);
    expect(normalizeNovelSettings([1, 2, 3], base)).toBe(base);
  });

  it("保留合法值，并为缺失字段补齐默认结构", () => {
    const result = normalizeNovelSettings({
      oneLinePitch: "测试",
      mainCharacter: { name: "张三" },
      writingStyle: { temperature: 0 },
    });

    expect(result.oneLinePitch).toBe("测试");
    expect(result.mainCharacter.name).toBe("张三");
    expect(result.mainCharacter.gender).toBe("男");
    // temperature 为 0 是合法取值，不能被默认值顶掉
    expect(result.writingStyle.temperature).toBe(0);
    expect(result.worldDetails.powerSystem).toBe("");
    expect(Array.isArray(result.subplots)).toBe(true);
  });
});
