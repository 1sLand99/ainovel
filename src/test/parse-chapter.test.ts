import { describe, it, expect } from "vitest";
import { parseGeneratedChapter, estimateMaxTokens } from "@/lib/parse-chapter";

describe("章节解析 parseGeneratedChapter", () => {
  it("识别 markdown 标题并从正文中剔除", () => {
    const { title, content } = parseGeneratedChapter(
      "# 初入宗门\n\n少年抬头望向山门。\n\n他握紧了手中的剑。",
      "第一章",
    );
    expect(title).toBe("初入宗门");
    expect(content).toBe("少年抬头望向山门。\n\n他握紧了手中的剑。");
  });

  it("识别「第 N 章 标题」格式并剥离章节号", () => {
    const { title, content } = parseGeneratedChapter(
      "第三章 惊变\n\n风雪骤起。",
      "第三章",
    );
    expect(title).toBe("惊变");
    expect(content).toBe("风雪骤起。");
  });

  it("模型直接输出正文时不吞掉第一段", () => {
    const raw = "少年抬头望向山门，心中五味杂陈。\n\n这一走，便是十年。";
    const { title, content } = parseGeneratedChapter(raw, "第五章");

    expect(title).toBe("第五章");
    // 关键回归：首行不是标题时必须原样保留，此前会被当作标题剔除
    expect(content).toBe(raw);
    expect(content).toContain("少年抬头望向山门");
  });

  it("以「第 N 章」开头的长段落不会被误判为标题", () => {
    const raw =
      "第三章的内容他早已烂熟于心，可当真正踏上这条路时，才发现书上写的与现实相去甚远，脚下的每一步都比想象中艰难。\n\n他叹了口气。";
    const { title, content } = parseGeneratedChapter(raw, "第四章");

    expect(title).toBe("第四章");
    expect(content).toBe(raw);
  });

  it("保留正文中的空行与段落结构", () => {
    const { content } = parseGeneratedChapter(
      "# 标题\n\n第一段。\n\n第二段。\n\n第三段。",
      "兜底",
    );
    expect(content).toBe("第一段。\n\n第二段。\n\n第三段。");
    expect(content.split("\n\n")).toHaveLength(3);
  });

  it("只有标题没有正文时，把全文当作正文而不是丢弃", () => {
    const { title, content } = parseGeneratedChapter("# 只有一个标题", "兜底标题");
    expect(title).toBe("兜底标题");
    expect(content).toBe("# 只有一个标题");
  });

  it("空输入返回兜底标题与空正文", () => {
    expect(parseGeneratedChapter("", "兜底")).toEqual({ title: "兜底", content: "" });
    expect(parseGeneratedChapter("   \n  ", "兜底")).toEqual({ title: "兜底", content: "" });
  });

  it("标题为空时回退到兜底标题", () => {
    const { title } = parseGeneratedChapter("# \n\n正文内容", "第九章");
    expect(title).toBe("第九章");
  });
});

describe("max_tokens 估算 estimateMaxTokens", () => {
  it("随目标字数增长，长章节不会被 4096 截断", () => {
    expect(estimateMaxTokens(8000)).toBeGreaterThan(8000);
    expect(estimateMaxTokens(3000)).toBeGreaterThan(4096);
  });

  it("短章节仍保留合理下限", () => {
    expect(estimateMaxTokens(100)).toBe(2048);
  });

  it("非法输入回退到默认字数", () => {
    expect(estimateMaxTokens(0)).toBe(estimateMaxTokens(3000));
    expect(estimateMaxTokens(NaN)).toBe(estimateMaxTokens(3000));
  });

  it("有上限，避免超出模型能力", () => {
    expect(estimateMaxTokens(10_000_000)).toBe(32000);
  });
});
