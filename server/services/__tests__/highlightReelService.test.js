import { jest } from "@jest/globals";
import mongoose from "mongoose";
import {
  generateHighlightReel,
  generateExportHtml,
  updateHighlightReel,
} from "../highlightReelService.js";
import HighlightReel from "../../models/highlightReelModel.js";
import Meeting from "../../models/meetingModel.js";

jest.mock("../GenerativeAIService.js", () => ({
  __esModule: true,
  generateHighlightReelAI: jest.fn(),
}));

const mockMeetingId = new mongoose.Types.ObjectId().toString();
const mockOrgId = new mongoose.Types.ObjectId().toString();

describe("HighlightReelService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateHighlightReel", () => {
    it("should throw if generation is already pending", async () => {
      jest
        .spyOn(HighlightReel, "findOne")
        .mockResolvedValue({ status: "pending" });
      jest.spyOn(HighlightReel, "findOneAndUpdate").mockResolvedValue(null);

      await expect(
        generateHighlightReel(mockMeetingId, mockOrgId),
      ).rejects.toThrow("Highlight Reel generation is already in progress.");
    });
  });

  describe("updateHighlightReel", () => {
    it("should update narrative and trimmed/reordered highlights", async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      const mockReel = {
        meetingId: mockMeetingId,
        organization: mockOrgId,
        narrative: "Old narrative",
        highlights: [],
        save: mockSave,
      };

      jest.spyOn(HighlightReel, "findOne").mockResolvedValue(mockReel);

      const updateData = {
        narrative: "Updated narrative",
        highlights: [
          {
            type: "insight",
            timestamp: 10,
            endTime: 45,
            speaker: "Alice",
            excerpt: "Trimmed clip excerpt",
            aiRationale: "Rationale",
          },
        ],
      };

      const updatedReel = await updateHighlightReel(
        mockMeetingId,
        mockOrgId,
        updateData,
      );

      expect(updatedReel.narrative).toBe("Updated narrative");
      expect(updatedReel.highlights).toHaveLength(1);
      expect(updatedReel.highlights[0].endTime).toBe(45);
      expect(mockSave).toHaveBeenCalled();
    });

    it("should throw if reel not found for update", async () => {
      jest.spyOn(HighlightReel, "findOne").mockResolvedValue(null);

      await expect(
        updateHighlightReel(mockMeetingId, mockOrgId, { narrative: "Test" }),
      ).rejects.toThrow("Highlight reel not found");
    });
  });

  describe("generateExportHtml", () => {
    it("should generate valid HTML for a completed reel", async () => {
      const mockReel = {
        status: "completed",
        narrative: "Testing narrative",
        highlights: [
          {
            type: "insight",
            timestamp: 100,
            speaker: "Bob",
            excerpt: "Hello world",
            sentiment: "neutral",
            importance: 5,
            aiRationale: "Important",
          },
        ],
      };
      jest.spyOn(HighlightReel, "findOne").mockResolvedValue(mockReel);
      jest
        .spyOn(Meeting, "findById")
        .mockResolvedValue({ title: "My Meeting" });

      const html = await generateExportHtml(mockMeetingId, mockOrgId);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("My Meeting");
      expect(html).toContain("Testing narrative");
      expect(html).toContain("Hello world");
    });

    it("should throw if reel is not completed", async () => {
      jest
        .spyOn(HighlightReel, "findOne")
        .mockResolvedValue({ status: "pending" });

      await expect(
        generateExportHtml(mockMeetingId, mockOrgId),
      ).rejects.toThrow("Highlight reel not available for export.");
    });
  });
});
