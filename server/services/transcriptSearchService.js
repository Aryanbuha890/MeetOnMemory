import mongoose from "mongoose";
import Transcript from "../models/transcriptModel.js";

export const searchAcrossTranscripts = async ({
  query,
  organizationId,
  userId,
  speaker,
  startDate,
  endDate,
  page = 1,
  limit = 20,
}) => {
  const skip = (page - 1) * limit;

  const matchStage = {
    $text: { $search: query },
  };

  if (organizationId) {
    matchStage.organizationId = new mongoose.Types.ObjectId(organizationId);
  }

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: "meetings",
        localField: "meeting",
        foreignField: "_id",
        as: "meetingDoc",
      },
    },
    { $unwind: "$meetingDoc" },
  ];

  const meetingMatch = {};
  if (startDate || endDate) {
    meetingMatch["meetingDoc.date"] = {};
    if (startDate) meetingMatch["meetingDoc.date"].$gte = new Date(startDate);
    if (endDate) meetingMatch["meetingDoc.date"].$lte = new Date(endDate);
  }

  // If user is not an admin, they should only see transcripts of meetings they are part of
  // In a real app we'd want strict RBAC, but this is a simplified check based on schema
  if (userId) {
    meetingMatch["$or"] = [
      { "meetingDoc.participants": new mongoose.Types.ObjectId(userId) },
      { "meetingDoc.createdBy": new mongoose.Types.ObjectId(userId) },
      { "meetingDoc.uploadedBy": new mongoose.Types.ObjectId(userId) },
    ];
  }

  if (Object.keys(meetingMatch).length > 0) {
    pipeline.push({ $match: meetingMatch });
  }

  pipeline.push({
    $addFields: {
      fullSegments: "$segments",
    },
  });

  pipeline.push({
    $unwind: { path: "$segments", includeArrayIndex: "segmentIndex" },
  });

  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const segmentMatch = {
    "segments.text": { $regex: safeQuery, $options: "i" },
  };

  if (speaker) {
    segmentMatch["segments.speaker"] = { $regex: speaker, $options: "i" };
  }

  pipeline.push({ $match: segmentMatch });

  pipeline.push({
    $facet: {
      metadata: [{ $count: "total" }],
      data: [
        { $sort: { "meetingDoc.date": -1, segmentIndex: 1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            meetingId: "$meeting",
            meetingTitle: "$meetingDoc.title",
            meetingDate: "$meetingDoc.date",
            segment: "$segments",
            segmentIndex: 1,
            score: { $meta: "textScore" },
            contextSegments: {
              $slice: [
                "$fullSegments",
                { $max: [0, { $subtract: ["$segmentIndex", 1] }] },
                3,
              ],
            },
          },
        },
      ],
    },
  });

  const results = await Transcript.aggregate(pipeline);

  const data = results[0].data;
  const total = results[0].metadata[0]?.total || 0;

  return {
    results: data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};
