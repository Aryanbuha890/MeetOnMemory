import { searchAcrossTranscripts } from "../services/transcriptSearchService.js";

export const searchGlobalTranscripts = async (req, res) => {
  try {
    const { q, speaker, startDate, endDate, page, limit } = req.query;

    if (!q) {
      return res
        .status(400)
        .json({ success: false, message: "Search query 'q' is required" });
    }

    const organizationId = req.user?.organization;
    const userId = req.user?._id;

    const results = await searchAcrossTranscripts({
      query: q,
      organizationId,
      userId,
      speaker,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error searching global transcripts:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
