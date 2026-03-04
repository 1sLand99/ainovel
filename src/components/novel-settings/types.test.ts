import { describe, it, expect } from "vitest";
import {
  createEmptySideCharacter,
  createEmptyAntagonist,
  createEmptyPlotBeat,
  createEmptyTaboo,
  createEmptyReferenceWork,
  createDefaultNovelSettings,
} from "./types";

describe("Novel Settings Types Generators", () => {
  describe("createEmptySideCharacter", () => {
    it("should create a side character with default values", () => {
      const char = createEmptySideCharacter();
      expect(char.id).toBeDefined();
      expect(typeof char.id).toBe("string");
      expect(char.name).toBe("");
      expect(char.nickname).toBe("");
      expect(char.gender).toBe("男");
      expect(char.age).toBe("");
      expect(char.relationship).toBe("");
      expect(char.relationshipCustom).toBe("");
      expect(char.personalityTags).toEqual([]);
      expect(char.background).toBe("");
      expect(char.abilities).toBe("");
      expect(char.role).toBe("");
      expect(char.arc).toBe("");
      expect(char.arcCustom).toBe("");
    });

    it("should generate unique IDs", () => {
      const char1 = createEmptySideCharacter();
      const char2 = createEmptySideCharacter();
      expect(char1.id).not.toBe(char2.id);
    });
  });

  describe("createEmptyAntagonist", () => {
    it("should create an antagonist with default values", () => {
      const ant = createEmptyAntagonist();
      expect(ant.id).toBeDefined();
      expect(ant.name).toBe("");
      expect(ant.gender).toBe("男");
      expect(ant.motive).toBe("");
      expect(ant.fate).toBe("");
    });

    it("should generate unique IDs", () => {
      const ant1 = createEmptyAntagonist();
      const ant2 = createEmptyAntagonist();
      expect(ant1.id).not.toBe(ant2.id);
    });
  });

  describe("createEmptyPlotBeat", () => {
    it("should create a plot beat with default values", () => {
      const beat = createEmptyPlotBeat();
      expect(beat.id).toBeDefined();
      expect(beat.title).toBe("");
      expect(beat.detail).toBe("");
    });

    it("should generate unique IDs", () => {
      const beat1 = createEmptyPlotBeat();
      const beat2 = createEmptyPlotBeat();
      expect(beat1.id).not.toBe(beat2.id);
    });
  });

  describe("createEmptyTaboo", () => {
    it("should create a taboo rule with default values", () => {
      const taboo = createEmptyTaboo();
      expect(taboo.id).toBeDefined();
      expect(taboo.content).toBe("");
    });

    it("should generate unique IDs", () => {
      const taboo1 = createEmptyTaboo();
      const taboo2 = createEmptyTaboo();
      expect(taboo1.id).not.toBe(taboo2.id);
    });
  });

  describe("createEmptyReferenceWork", () => {
    it("should create a reference work with default values", () => {
      const ref = createEmptyReferenceWork();
      expect(ref.id).toBeDefined();
      expect(ref.title).toBe("");
      expect(ref.inspiration).toBe("");
    });

    it("should generate unique IDs", () => {
      const ref1 = createEmptyReferenceWork();
      const ref2 = createEmptyReferenceWork();
      expect(ref1.id).not.toBe(ref2.id);
    });
  });

  describe("createDefaultNovelSettings", () => {
    it("should create novel settings with complex default values", () => {
      const settings = createDefaultNovelSettings();
      expect(settings.genres).toEqual([]);
      expect(settings.oneLinePitch).toBe("");
      expect(settings.mainCharacter).toEqual({
        name: "",
        gender: "男",
        age: "",
        personality: "",
      });
      expect(settings.sideCharacters).toEqual([]);
      expect(settings.antagonists).toEqual([]);
      expect(settings.worldSummary).toBe("");
      expect(settings.conflictTheme).toBe("");
      expect(settings.worldDetails).toEqual({
        powerSystem: "",
        factions: "",
        historyEvents: "",
        importantLocations: "",
        cultureAndTaboos: "",
      });
      expect(settings.opening).toBe("");
      expect(settings.middleBeats).toEqual([]);
      expect(settings.endingType).toBe("");
      expect(settings.subplots).toEqual([]);
      expect(settings.writingStyle).toEqual({
        narration: "第三人称有限",
        tones: [],
        cheatLevel: "稳步成长",
        focusAreas: [],
        wordsPerChapter: 3000,
        temperature: 0.7,
      });
      expect(settings.totalWords).toBe(100000);
      expect(settings.chapterWords).toBe(3000);
      expect(settings.nsfw).toBe(false);
      expect(settings.systemNovel).toBe(false);
      expect(settings.harem).toBe(false);
      expect(settings.taboos).toEqual([]);
      expect(settings.references).toEqual([]);
    });
  });
});
