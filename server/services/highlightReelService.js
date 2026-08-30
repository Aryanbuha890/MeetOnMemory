import Meeting from "../models/meetingModel.js";
import Transcript from "../models/transcriptModel.js";
import KeyMoment from "../models/keyMomentModel.js";
import SentimentTimeline from "../models/sentimentTimelineModel.js";
import HighlightReel from "../models/highlightReelModel.js";
import { generateHighlightReelAI } from "./GenerativeAIService.js";

/**
 * Orchestrates the generation of an AI-curated highlight reel for a meeting.
 */
export const generateHighlightReel = async (meetingId, organizationId) => {
  try {
    // 1. Check if a reel already exists or is pending
    let reel = await HighlightReel.findOne({
      meetingId,
      organization: organizationId,
    });
    if (reel && reel.status === "pending") {
      throw new Error("Highlight Reel generation is already in progress.");
    }

    if (!reel) {
      reel = new HighlightReel({
        meetingId,
        organization: organizationId,
        narrative: "Generating narrative...",
        highlights: [],
        status: "pending",
      });
      await reel.save();
    } else {
      reel.status = "pending";
      await reel.save();
    }

    // 2. Fetch necessary data
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) throw new Error("Meeting not found");

    const transcripts = await Transcript.find({ meetingId }).sort({
      "segments.startTime": 1,
    });
    const transcriptSegments = transcripts
      .flatMap((t) => t.segments)
      .map((s) => ({
        speaker: s.speaker,
        text: s.text,
        startTime: s.startTime,
        endTime: s.endTime,
      }));

    const keyMoments = await KeyMoment.find({ meetingId }).sort({
      startTime: 1,
    });
    const sentimentTimelines = await SentimentTimeline.find({ meetingId }).sort(
      { timestamp: 1 },
    );

    // 3. Call AI Service
    const aiResult = await generateHighlightReelAI(
      meeting.title,
      transcriptSegments,
      keyMoments,
      sentimentTimelines,
    );

    // 4. Update the reel
    reel.narrative = aiResult.narrative;
    reel.highlights = aiResult.highlights;
    reel.status = "completed";
    reel.generatedAt = new Date();
    await reel.save();

    return reel;
  } catch (error) {
    console.error("Error generating highlight reel:", error);
    await HighlightReel.findOneAndUpdate(
      { meetingId, organization: organizationId },
      { status: "failed" },
    );
    throw error;
  }
};

/**
 * Fetches the highlight reel for a given meeting.
 */
export const getHighlightReel = async (meetingId, organizationId) => {
  return HighlightReel.findOne({ meetingId, organization: organizationId });
};

/**
 * Updates the highlight reel (narrative and/or highlights trim/order).
 */
export const updateHighlightReel = async (
  meetingId,
  organizationId,
  updateData,
) => {
  const reel = await HighlightReel.findOne({
    meetingId,
    organization: organizationId,
  });
  if (!reel) {
    throw new Error("Highlight reel not found");
  }

  if (typeof updateData.narrative === "string") {
    reel.narrative = updateData.narrative;
  }

  if (Array.isArray(updateData.highlights)) {
    reel.highlights = updateData.highlights.map((h) => ({
      ...h,
      timestamp: Number(h.timestamp) || 0,
      endTime:
        h.endTime !== undefined && h.endTime !== null
          ? Number(h.endTime)
          : undefined,
    }));
  }

  await reel.save();
  return reel;
};

/**
 * Generates an HTML string for exporting the highlight reel.
 */
export const generateExportHtml = async (meetingId, organizationId) => {
  const reel = await getHighlightReel(meetingId, organizationId);
  const meeting = await Meeting.findById(meetingId);

  if (!reel || reel.status !== "completed") {
    throw new Error("Highlight reel not available for export.");
  }

  const escapeHtml = (unsafe) => {
    return (unsafe || "").replace(/[&<"'>]/g, (m) => {
      switch (m) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#039;";
        default:
          return m;
      }
    });
  };

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Highlight Reel: ${escapeHtml(meeting?.title || "Meeting")}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { color: #111; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
    .narrative { font-size: 1.1rem; color: #444; margin-bottom: 2rem; white-space: pre-line; }
    .highlight-card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .highlight-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .type-badge { background: #e0f2fe; color: #0284c7; padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: 600; font-size: 0.875rem; text-transform: uppercase; }
    .sentiment-badge { font-weight: 600; font-size: 0.875rem; }
    .sentiment-positive { color: #16a34a; }
    .sentiment-neutral { color: #4b5563; }
    .sentiment-negative { color: #dc2626; }
    .timestamp { color: #6b7280; font-size: 0.875rem; }
    .excerpt { font-size: 1.25rem; font-weight: 500; font-style: italic; color: #111; border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 1rem 0; }
    .speaker { font-weight: 600; color: #4b5563; margin-bottom: 0.5rem; }
    .rationale { font-size: 0.95rem; color: #4b5563; background: #f9fafb; padding: 1rem; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Highlight Reel: ${escapeHtml(meeting?.title || "Meeting")}</h1>
  <div class="narrative">${escapeHtml(reel.narrative)}</div>
  <h2>Key Highlights</h2>
`;

  reel.highlights.forEach((h) => {
    const timeFormat = new Date(h.timestamp * 1000).toISOString().substr(11, 8);
    html += `
  <div class="highlight-card">
    <div class="highlight-header">
      <span class="type-badge">${escapeHtml(h.type)}</span>
      <div style="display:flex; gap: 1rem; align-items: center;">
        <span class="sentiment-badge sentiment-${h.sentiment}">${escapeHtml(h.sentiment)}</span>
        <span class="timestamp">${timeFormat}</span>
      </div>
    </div>
    <div class="speaker">${escapeHtml(h.speaker)}</div>
    <div class="excerpt">"${escapeHtml(h.excerpt)}"</div>
    <div class="rationale"><strong>Why this matters:</strong> ${escapeHtml(h.aiRationale)}</div>
  </div>`;
  });

  html += `
</body>
</html>`;

  return html;
};
