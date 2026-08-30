import { meetingSeriesDiffService } from "../services/meetingSeriesDiffService.js";

export const getPairwiseDiff = async (req, res) => {
  try {
    const { m1Id, m2Id } = req.query;

    if (!m1Id || !m2Id) {
      return res
        .status(400)
        .json({ error: "m1Id and m2Id query parameters are required" });
    }

    const diff = await meetingSeriesDiffService.compareMeetings(
      m1Id,
      m2Id,
      req.user,
    );
    res.json(diff);
  } catch (error) {
    console.error("Error getting pairwise diff:", error);
    if (error.message.includes("Unauthorized")) {
      res.status(403).json({ error: "Unauthorized access to meeting diff" });
    } else if (error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Failed to generate meeting diff" });
    }
  }
};

export const getSeriesTimeline = async (req, res) => {
  try {
    const { seriesId } = req.params;

    if (!seriesId) {
      return res.status(400).json({ error: "seriesId parameter is required" });
    }

    const timelineData = await meetingSeriesDiffService.getSeriesTimeline(
      seriesId,
      req.user,
    );
    res.json(timelineData);
  } catch (error) {
    console.error("Error getting series timeline:", error);
    res.status(500).json({ error: "Failed to fetch series timeline" });
  }
};
