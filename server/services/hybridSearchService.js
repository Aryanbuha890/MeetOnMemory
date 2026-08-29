import { searchVectorStore } from "../utils/embeddingUtils.js";
import { searchAcrossTranscripts } from "./transcriptSearchService.js";
import { generateText } from "./GenerativeAIService.js";

export const performHybridSearch = async ({
  query,
  organizationId,
  userId,
  dateFrom,
  dateTo,
  tags,
  speaker,
  organizer,
  department,
  limit = 10,
}) => {
  // 1. Perform Vector Search
  let vectorResults = [];
  try {
    vectorResults = await searchVectorStore(query, {
      organization: organizationId,
      limit: limit * 2, // Fetch more to allow filtering
      dateFrom,
      dateTo,
      tags,
    });
  } catch (err) {
    console.error(
      "Vector search failed, falling back to keyword search only:",
      err,
    );
  }

  // 2. Perform Keyword Search
  let keywordResults = [];
  try {
    const kw = await searchAcrossTranscripts({
      query,
      organizationId,
      userId,
      speaker,
      startDate: dateFrom,
      endDate: dateTo,
      limit: limit * 2,
    });
    keywordResults = kw.results || [];
  } catch (err) {
    console.error("Keyword search failed:", err);
  }

  // 3. Resolve Custom Filters (Organizer, Department)
  let organizerUserIds = null;
  if (organizer) {
    const User = (await import("../models/userModel.js")).default;
    const users = await User.find({
      $or: [
        { name: { $regex: organizer, $options: "i" } },
        { email: { $regex: organizer, $options: "i" } },
      ],
    }).lean();
    organizerUserIds = users.map((u) => u._id.toString());
  }

  let departmentMeetingIds = null;
  if (department) {
    const User = (await import("../models/userModel.js")).default;
    const users = await User.find({
      $or: [
        { team: { $regex: department, $options: "i" } },
        { department: { $regex: department, $options: "i" } },
      ],
    }).lean();
    const userIds = users.map((u) => u._id.toString());

    const Meeting = (await import("../models/meetingModel.js")).default;
    const meetings = await Meeting.find({
      customFields: {
        $elemMatch: {
          $or: [
            { key: { $regex: /department/i } },
            { name: { $regex: /department/i } },
          ],
          value: { $regex: department, $options: "i" },
        },
      },
    }).lean();
    const meetIds = meetings.map((m) => m._id.toString());

    departmentMeetingIds = {
      userIds,
      meetIds,
    };
  }

  // 4. Batch fetch candidate meetings to filter and resolve titles/dates
  const candidateIds = [
    ...new Set([
      ...vectorResults.map((r) => r.meetingId.toString()),
      ...keywordResults.map((r) => r.meetingId.toString()),
    ]),
  ];

  const Meeting = (await import("../models/meetingModel.js")).default;
  const meetings = await Meeting.find({ _id: { $in: candidateIds } }).lean();
  const meetingsMap = new Map(meetings.map((m) => [m._id.toString(), m]));

  // Apply filters on candidate meetings list
  const filteredCandidates = new Set(
    candidateIds.filter((id) => {
      const meeting = meetingsMap.get(id);
      if (!meeting) return false;

      // Apply organizer filter
      if (
        organizerUserIds &&
        !organizerUserIds.includes(meeting.uploadedBy?.toString())
      ) {
        return false;
      }

      // Apply department filter
      if (departmentMeetingIds) {
        const matchesUser = departmentMeetingIds.userIds.includes(
          meeting.uploadedBy?.toString(),
        );

        const matchesCustomField = meeting.customFields?.some(
          (cf) =>
            (cf.key?.toLowerCase().includes("department") ||
              cf.name?.toLowerCase().includes("department")) &&
            cf.value
              ?.toString()
              .toLowerCase()
              .includes(department.toLowerCase()),
        );

        if (!matchesUser && !matchesCustomField) {
          return false;
        }
      }

      return true;
    }),
  );

  // 5. Combine and Rank (Hybrid Scoring)
  const combinedMap = new Map();

  // Add vector results to map if they pass filters
  vectorResults.forEach((vr) => {
    const id = vr.meetingId.toString();
    if (!filteredCandidates.has(id)) return;

    combinedMap.set(id, {
      meetingId: id,
      title: vr.title,
      text: vr.transcript || vr.summary || "",
      type: "vector",
      score: vr.similarityScore * 1.5,
      date: vr.createdAt,
      tags: vr.tags,
    });
  });

  // Merge keyword results if they pass filters
  keywordResults.forEach((kr) => {
    const id = kr.meetingId.toString();
    if (!filteredCandidates.has(id)) return;

    const segmentText = kr.segment?.text || "";
    const speakerName = kr.segment?.speaker || "Speaker";
    const startTimeSec = kr.segment?.startTime || 0;

    const timeString = new Date(startTimeSec * 1000)
      .toISOString()
      .substr(11, 8);

    if (combinedMap.has(id)) {
      const existing = combinedMap.get(id);
      existing.score += 1.0; // Boost score if found in both
      existing.segments = existing.segments || [];
      existing.segments.push({
        text: segmentText,
        speaker: speakerName,
        time: timeString,
        startTimeSec,
      });
    } else {
      combinedMap.set(id, {
        meetingId: id,
        title: kr.meetingTitle,
        text: segmentText,
        type: "keyword",
        score: 1.0,
        date: kr.meetingDate,
        segments: [
          {
            text: segmentText,
            speaker: speakerName,
            time: timeString,
            startTimeSec,
          },
        ],
      });
    }
  });

  const rankedResults = Array.from(combinedMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // 6. Generate AI Summary Answer with Citations
  let aiAnswer = "No context was found to generate an AI answer.";
  if (rankedResults.length > 0) {
    const contextBlocks = rankedResults
      .map((r, i) => {
        const segs =
          r.segments && r.segments.length > 0
            ? r.segments
                .map((s) => `[${s.time}] ${s.speaker}: "${s.text}"`)
                .join("\n")
            : r.text;
        return `Meeting #${i + 1}: ${r.title} (ID: ${r.meetingId})\nContext:\n${segs}`;
      })
      .join("\n\n");

    const prompt = `
You are the MeetOnMemory AI Assistant. Your goal is to answer the user's question accurately using only the provided meeting transcript contexts.

User Question: "${query}"

Context from meetings:
${contextBlocks}

Instructions:
- Write a clear, professional, and direct answer to the user's question.
- Do not mention the word "context" or "meetings provided". Simply answer the question.
- Crucially, cite your sources by referencing the meeting using markdown links formatted exactly like:
  [Meeting Title](meetingId#t=seconds)
  For example, if the information is from Meeting #1 which has ID "60c72b2f9b1d8a00155b4a56" and timestamp "00:02:15", you would write: "...as resolved by the team [Project Sync](60c72b2f9b1d8a00155b4a56#t=135)..."
- If the timestamp is not explicitly given, use #t=0.
- If the contexts do not contain enough information to answer the question, state that you could not find a clear answer in the transcripts.
`;

    try {
      aiAnswer = await generateText(prompt, "hybrid-search-answer");
    } catch (err) {
      console.error("AI answer generation failed:", err);
      aiAnswer =
        "Failed to generate AI citation answer due to a transient LLM error.";
    }
  }

  return {
    results: rankedResults,
    aiAnswer,
  };
};

export default performHybridSearch;
