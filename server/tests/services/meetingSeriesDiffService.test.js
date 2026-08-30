import mongoose from "mongoose";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { meetingSeriesDiffService } from "../../../server/services/meetingSeriesDiffService.js";
import Meeting from "../../../server/models/meetingModel.js";
import ActionItem from "../../../server/models/actionItemModel.js";
import Decision from "../../../server/models/decisionModel.js";
import MeetingTopic from "../../../server/models/meetingTopicModel.js";

vi.mock("../../../server/models/meetingModel.js");
vi.mock("../../../server/models/actionItemModel.js");
vi.mock("../../../server/models/decisionModel.js");
vi.mock("../../../server/models/meetingTopicModel.js");

describe("meetingSeriesDiffService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("compareMeetings", () => {
    it("should correctly identify additions, removals, and modifications for agenda items", async () => {
      const orgId = new mongoose.Types.ObjectId();
      const m1 = {
        _id: new mongoose.Types.ObjectId(),
        title: "Meeting 1",
        organization: orgId,
        agendaItems: [
          { text: "Topic A", duration: 15 },
          { text: "Topic B", duration: 10 },
        ],
      };

      const m2 = {
        _id: new mongoose.Types.ObjectId(),
        title: "Meeting 2",
        organization: orgId,
        agendaItems: [
          { text: "Topic A", duration: 20 }, // modified duration
          { text: "New Distinct Topic", duration: 10 }, // added
        ], // Topic B removed
      };

      Meeting.findById.mockImplementation((id) => {
        if (id === m1._id) return { lean: () => m1 };
        if (id === m2._id) return { lean: () => m2 };
        return { lean: () => null };
      });

      ActionItem.find.mockReturnValue({ lean: () => [] });
      Decision.find.mockReturnValue({ lean: () => [] });
      MeetingTopic.findOne.mockReturnValue({ lean: () => null });

      const user = { organization: orgId };
      const diff = await meetingSeriesDiffService.compareMeetings(
        m1._id,
        m2._id,
        user,
      );

      expect(diff.agenda.added).toHaveLength(1);
      expect(diff.agenda.added[0].text).toBe("New Distinct Topic");

      expect(diff.agenda.removed).toHaveLength(1);
      expect(diff.agenda.removed[0].text).toBe("Topic B");

      expect(diff.agenda.modified).toHaveLength(1);
      expect(diff.agenda.modified[0].new.text).toBe("Topic A");
      expect(diff.agenda.modified[0].old.duration).toBe(15);
      expect(diff.agenda.modified[0].new.duration).toBe(20);
    });

    it("should correctly identify carried over and completed action items", async () => {
      const orgId = new mongoose.Types.ObjectId();
      const m1 = {
        _id: new mongoose.Types.ObjectId(),
        title: "Meeting 1",
        organization: orgId,
        agendaItems: [],
      };
      const m2 = {
        _id: new mongoose.Types.ObjectId(),
        title: "Meeting 2",
        organization: orgId,
        agendaItems: [],
      };

      Meeting.findById.mockImplementation((id) => {
        if (id === m1._id) return { lean: () => m1 };
        if (id === m2._id) return { lean: () => m2 };
        return { lean: () => null };
      });

      const ai1 = { _id: "ai1", text: "Task 1", status: "pending" };
      const ai2 = { _id: "ai2", text: "Task 2", status: "completed" };

      ActionItem.find.mockImplementation((query) => {
        if (query.sourceMeetingId === m1._id) return { lean: () => [ai1, ai2] };
        if (query.sourceMeetingId === m2._id)
          return {
            lean: () => [{ _id: "ai3", text: "Task 1", status: "pending" }],
          };
        return { lean: () => [] };
      });

      Decision.find.mockReturnValue({ lean: () => [] });
      MeetingTopic.findOne.mockReturnValue({ lean: () => null });

      const user = { organization: orgId };
      const diff = await meetingSeriesDiffService.compareMeetings(
        m1._id,
        m2._id,
        user,
      );

      expect(diff.actionItems.carriedOver).toHaveLength(1);
      expect(diff.actionItems.carriedOver[0].new.text).toBe("Task 1");
      expect(diff.actionItems.completed).toHaveLength(1);
      expect(diff.actionItems.completed[0].text).toBe("Task 2");
    });
  });
});
