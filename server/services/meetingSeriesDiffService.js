import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import MeetingTopic from "../models/meetingTopicModel.js";

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(s, t) {
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const arr = [];
  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] =
        i === 0
          ? j
          : Math.min(
              arr[i - 1][j] + 1,
              arr[i][j - 1] + 1,
              arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1),
            );
    }
  }
  return arr[t.length][s.length];
}

function calculateSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const s1Lower = s1.toLowerCase();
  const s2Lower = s2.toLowerCase();
  if (s1Lower === s2Lower) return 1.0;

  const distance = levenshteinDistance(s1Lower, s2Lower);
  const maxLen = Math.max(s1Lower.length, s2Lower.length);
  return (maxLen - distance) / maxLen;
}

const SIMILARITY_THRESHOLD = 0.75;

export const meetingSeriesDiffService = {
  /**
   * Compare two meetings and return a structured diff.
   * Assumes m1 is the older meeting, m2 is the newer meeting.
   */
  async compareMeetings(m1Id, m2Id, user) {
    const [m1, m2] = await Promise.all([
      Meeting.findById(m1Id).lean(),
      Meeting.findById(m2Id).lean(),
    ]);

    if (!m1 || !m2) {
      throw new Error("One or both meetings not found.");
    }

    // Ensure user has access (basic check)
    if (
      m1.organization?.toString() !== user.organization?.toString() ||
      m2.organization?.toString() !== user.organization?.toString()
    ) {
      throw new Error("Unauthorized access to meeting diff.");
    }

    // Fetch related entities
    const [
      m1ActionItems,
      m2ActionItems,
      m1Decisions,
      m2Decisions,
      m1TopicsDoc,
      m2TopicsDoc,
    ] = await Promise.all([
      ActionItem.find({ sourceMeetingId: m1Id }).lean(),
      ActionItem.find({ sourceMeetingId: m2Id }).lean(),
      Decision.find({ sourceMeetingId: m1Id }).lean(),
      Decision.find({ sourceMeetingId: m2Id }).lean(),
      MeetingTopic.findOne({ meeting: m1Id }).lean(),
      MeetingTopic.findOne({ meeting: m2Id }).lean(),
    ]);

    const m1Topics = m1TopicsDoc ? m1TopicsDoc.topics : [];
    const m2Topics = m2TopicsDoc ? m2TopicsDoc.topics : [];

    // --- Agenda Diff ---
    const agendaDiff = this._diffAgendaItems(
      m1.agendaItems || [],
      m2.agendaItems || [],
    );

    // --- Action Items Diff ---
    const actionItemsDiff = this._diffActionItems(m1ActionItems, m2ActionItems);

    // --- Decisions Diff ---
    const decisionsDiff = this._diffDecisions(m1Decisions, m2Decisions);

    // --- Topics Diff ---
    const topicsDiff = this._diffTopics(m1Topics, m2Topics);

    return {
      meeting1: { id: m1._id, date: m1.date, title: m1.title },
      meeting2: { id: m2._id, date: m2.date, title: m2.title },
      agenda: agendaDiff,
      actionItems: actionItemsDiff,
      decisions: decisionsDiff,
      topics: topicsDiff,
      metrics: {
        added:
          agendaDiff.added.length +
          decisionsDiff.added.length +
          topicsDiff.added.length +
          actionItemsDiff.added.length,
        removed:
          agendaDiff.removed.length +
          decisionsDiff.removed.length +
          topicsDiff.removed.length,
        carriedOver:
          actionItemsDiff.carriedOver.length +
          agendaDiff.modified.length +
          topicsDiff.recurring.length,
        completedActionItems: actionItemsDiff.completed.length,
      },
    };
  },

  _diffAgendaItems(oldItems, newItems) {
    const diff = { added: [], removed: [], modified: [] };
    const matchedNewIndices = new Set();

    oldItems.forEach((oldItem) => {
      // Find best match in new items
      let bestMatchIndex = -1;
      let highestSim = 0;

      newItems.forEach((newItem, idx) => {
        if (matchedNewIndices.has(idx)) return;
        const sim = calculateSimilarity(oldItem.text, newItem.text);
        if (sim > highestSim && sim >= SIMILARITY_THRESHOLD) {
          highestSim = sim;
          bestMatchIndex = idx;
        }
      });

      if (bestMatchIndex !== -1) {
        matchedNewIndices.add(bestMatchIndex);
        const matchedNewItem = newItems[bestMatchIndex];
        // Check if modified
        if (highestSim < 1.0 || oldItem.duration !== matchedNewItem.duration) {
          diff.modified.push({
            old: oldItem,
            new: matchedNewItem,
            type: "modified",
          });
        } else {
          // unchanged, maybe just track as carried over if needed, but usually we just want changes
          diff.modified.push({
            old: oldItem,
            new: matchedNewItem,
            type: "unchanged",
          });
        }
      } else {
        diff.removed.push(oldItem);
      }
    });

    newItems.forEach((newItem, idx) => {
      if (!matchedNewIndices.has(idx)) {
        diff.added.push(newItem);
      }
    });

    return diff;
  },

  _diffActionItems(oldItems, newItems) {
    const diff = { added: [], completed: [], carriedOver: [], dropped: [] };
    const matchedNewIndices = new Set();

    oldItems.forEach((oldItem) => {
      let bestMatchIndex = -1;
      let highestSim = 0;

      newItems.forEach((newItem, idx) => {
        if (matchedNewIndices.has(idx)) return;
        // Match by text similarity or recurring/consolidation links
        const sim = calculateSimilarity(oldItem.text, newItem.text);
        if (sim > highestSim && sim >= SIMILARITY_THRESHOLD) {
          highestSim = sim;
          bestMatchIndex = idx;
        }
      });

      if (bestMatchIndex !== -1) {
        matchedNewIndices.add(bestMatchIndex);
        const matchedNewItem = newItems[bestMatchIndex];
        diff.carriedOver.push({ old: oldItem, new: matchedNewItem });
      } else {
        if (oldItem.status === "completed" || oldItem.status === "resolved") {
          diff.completed.push(oldItem);
        } else {
          diff.dropped.push(oldItem);
        }
      }
    });

    newItems.forEach((newItem, idx) => {
      if (!matchedNewIndices.has(idx)) {
        diff.added.push(newItem);
      }
    });

    return diff;
  },

  _diffDecisions(oldDecisions, newDecisions) {
    const diff = { added: [], removed: [], modified: [] };
    const matchedNewIndices = new Set();

    oldDecisions.forEach((oldDec) => {
      let bestMatchIndex = -1;
      let highestSim = 0;

      newDecisions.forEach((newDec, idx) => {
        if (matchedNewIndices.has(idx)) return;
        const sim = calculateSimilarity(oldDec.text, newDec.text);
        if (sim > highestSim && sim >= SIMILARITY_THRESHOLD) {
          highestSim = sim;
          bestMatchIndex = idx;
        }
      });

      if (bestMatchIndex !== -1) {
        matchedNewIndices.add(bestMatchIndex);
        const matchedNewDec = newDecisions[bestMatchIndex];
        if (oldDec.status !== matchedNewDec.status) {
          diff.modified.push({ old: oldDec, new: matchedNewDec });
        }
      } else {
        diff.removed.push(oldDec);
      }
    });

    newDecisions.forEach((newDec, idx) => {
      if (!matchedNewIndices.has(idx)) {
        diff.added.push(newDec);
      }
    });

    return diff;
  },

  _diffTopics(oldTopics, newTopics) {
    const diff = { added: [], removed: [], recurring: [] };
    const matchedNewIndices = new Set();

    oldTopics.forEach((oldTopic) => {
      let bestMatchIndex = -1;
      let highestSim = 0;

      newTopics.forEach((newTopic, idx) => {
        if (matchedNewIndices.has(idx)) return;
        const sim = calculateSimilarity(oldTopic.name, newTopic.name);
        if (sim > highestSim && sim >= SIMILARITY_THRESHOLD) {
          highestSim = sim;
          bestMatchIndex = idx;
        }
      });

      if (bestMatchIndex !== -1) {
        matchedNewIndices.add(bestMatchIndex);
        diff.recurring.push({ old: oldTopic, new: newTopics[bestMatchIndex] });
      } else {
        diff.removed.push(oldTopic);
      }
    });

    newTopics.forEach((newTopic, idx) => {
      if (!matchedNewIndices.has(idx)) {
        diff.added.push(newTopic);
      }
    });

    return diff;
  },

  /**
   * Get timeline diffs for a whole series
   */
  async getSeriesTimeline(seriesId, user) {
    const meetings = await Meeting.find({
      series: seriesId,
      organization: user.organization,
    })
      .sort({ seriesOccurrence: 1, date: 1 })
      .lean();

    if (!meetings.length) return { timeline: [], trendMetrics: {} };

    const timeline = [];
    let totalActionItemsCompleted = 0;
    let totalActionItemsCreated = 0;
    let totalDecisions = 0;

    for (let i = 0; i < meetings.length; i++) {
      const currentMeeting = meetings[i];
      let diffSummary = null;

      if (i > 0) {
        const prevMeeting = meetings[i - 1];
        try {
          const diff = await this.compareMeetings(
            prevMeeting._id,
            currentMeeting._id,
            user,
          );
          diffSummary = diff.metrics;

          totalActionItemsCompleted += diff.actionItems.completed.length;
          totalActionItemsCreated += diff.actionItems.added.length;
          totalDecisions += diff.decisions.added.length;
        } catch (error) {
          console.error(
            `Failed to generate diff for ${prevMeeting._id} -> ${currentMeeting._id}`,
            error,
          );
        }
      }

      timeline.push({
        meetingId: currentMeeting._id,
        title: currentMeeting.title,
        date: currentMeeting.date,
        occurrence: currentMeeting.seriesOccurrence,
        diffSummary,
      });
    }

    const trendMetrics = {
      actionItemCompletionRate: totalActionItemsCreated
        ? totalActionItemsCompleted / totalActionItemsCreated
        : 0,
      decisionVelocity:
        meetings.length > 1
          ? totalDecisions / (meetings.length - 1)
          : totalDecisions,
    };

    return { timeline, trendMetrics };
  },
};
