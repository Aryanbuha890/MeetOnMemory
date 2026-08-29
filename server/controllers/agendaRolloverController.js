import { rolloverAgenda } from "../services/agendaRolloverService.js";

export const handleAgendaRollover = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { sourceMeetingId } = req.body;
    const userId = req.user?._id || req.user?.id;

    if (!sourceMeetingId) {
      return res.status(400).json({
        success: false,
        message: "sourceMeetingId is required",
      });
    }

    const result = await rolloverAgenda(sourceMeetingId, meetingId, userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/meetings/rollover/preview
export const previewAgendaRollover = async (req, res, next) => {
  try {
    const { sourceMeetingId } = req.query;
    const organizationId = req.user?.organization || req.user?.organizationId;

    if (!sourceMeetingId) {
      return res.status(400).json({
        success: false,
        message: "sourceMeetingId is required",
      });
    }

    const Meeting = (await import("../models/meetingModel.js")).default;
    const sourceMeeting = await Meeting.findById(sourceMeetingId);
    if (!sourceMeeting) {
      return res
        .status(404)
        .json({ success: false, message: "Source meeting not found" });
    }

    if (
      sourceMeeting.organization &&
      organizationId &&
      String(sourceMeeting.organization) !== String(organizationId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting's agenda",
      });
    }

    const { analyzeAgendaItemPacing } =
      await import("../services/agendaRolloverService.js");

    const unfinishedItems = sourceMeeting.agendaItems.filter(
      (item) => item.status !== "completed",
    );

    const previewItems = [];

    for (const item of unfinishedItems) {
      const pacing = await analyzeAgendaItemPacing(organizationId, item.text);
      const recommendedDuration = pacing
        ? pacing.recommendation
        : item.duration;

      previewItems.push({
        text: item.text,
        description: item.description || "",
        duration: recommendedDuration,
        status: "pending",
        rolledOver: true,
        sourceAgendaItemId: item._id,
        pacing,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        agendaItems: previewItems,
      },
    });
  } catch (error) {
    next(error);
  }
};
