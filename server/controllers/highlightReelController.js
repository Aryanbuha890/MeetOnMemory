import * as highlightReelService from "../services/highlightReelService.js";
import Meeting from "../models/meetingModel.js";

export const generateHighlightReel = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const organizationId = req.user.organization;

    // Verify access
    const meeting = await Meeting.findOne({
      _id: meetingId,
      organization: organizationId,
    });
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    // Start generation asynchronously
    highlightReelService
      .generateHighlightReel(meetingId, organizationId)
      .catch((err) => {
        console.error("Async Highlight Reel Generation failed:", err);
      });

    res
      .status(202)
      .json({ success: true, message: "Highlight Reel generation started" });
  } catch (error) {
    console.error("Error starting highlight reel generation:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHighlightReel = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const organizationId = req.user.organization;

    const reel = await highlightReelService.getHighlightReel(
      meetingId,
      organizationId,
    );
    if (!reel) {
      return res
        .status(404)
        .json({ success: false, message: "Highlight reel not found" });
    }

    res.status(200).json({ success: true, data: reel });
  } catch (error) {
    console.error("Error fetching highlight reel:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const exportHighlightReelHtml = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const organizationId = req.user.organization;

    const html = await highlightReelService.generateExportHtml(
      meetingId,
      organizationId,
    );

    res.setHeader("Content-Type", "text/html");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=highlight_reel_${meetingId}.html`,
    );
    res.status(200).send(html);
  } catch (error) {
    console.error("Error exporting highlight reel HTML:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateHighlightReel = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const organizationId = req.user.organization;
    const { narrative, highlights } = req.body;

    const meeting = await Meeting.findOne({
      _id: meetingId,
      organization: organizationId,
    });
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    const reel = await highlightReelService.updateHighlightReel(
      meetingId,
      organizationId,
      { narrative, highlights },
    );

    res.status(200).json({ success: true, data: reel });
  } catch (error) {
    console.error("Error updating highlight reel:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
