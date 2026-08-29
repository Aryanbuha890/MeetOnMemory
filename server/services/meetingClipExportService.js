import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import MeetingClip from "../models/meetingClipModel.js";
import Meeting from "../models/meetingModel.js";

let ffmpeg = null;
try {
  // Dynamically import fluent-ffmpeg so we don't crash if it isn't installed
  const fluentFfmpeg = await import("fluent-ffmpeg");
  ffmpeg = fluentFfmpeg.default || fluentFfmpeg;
} catch (_err) {
  console.log("ℹ️ fluent-ffmpeg module not loaded.");
}

class MeetingClipExportService {
  /**
   * Trim an existing clip's start and end times and process the media file.
   */
  trimClip(clipId, startTime, endTime, io = null) {
    return new Promise(async (resolve, reject) => {
      try {
        if (startTime >= endTime) {
          return reject(new Error("Start time must be less than end time."));
        }
        if (startTime < 0) {
          return reject(new Error("Start time cannot be negative."));
        }

        const clip = await MeetingClip.findById(clipId);
        if (!clip) {
          return reject(new Error("Clip not found."));
        }

        const meeting = await Meeting.findById(clip.meeting);
        if (!meeting) {
          return reject(new Error("Associated meeting not found."));
        }

        // Resolve directory paths
        const clipsDir = path.resolve("uploads/clips");
        if (!fs.existsSync(clipsDir)) {
          fs.mkdirSync(clipsDir, { recursive: true });
        }

        const outputFilename = `trimmed_${clip._id}.mp4`;
        const outputPath = path.join(clipsDir, outputFilename);
        const publicUrl = `/uploads/clips/${outputFilename}`;

        // Check if source file exists
        const sourceFileUrl = meeting.fileUrl || "";
        const sourcePath = sourceFileUrl.startsWith("uploads")
          ? path.resolve(sourceFileUrl)
          : path.resolve(
              "uploads",
              sourceFileUrl.replace(/^\/?uploads\/?/, ""),
            );

        const sourceExists = sourceFileUrl && fs.existsSync(sourcePath);
        if (!sourceExists) {
          return reject(new Error("Source media file not found."));
        }
        if (!ffmpeg) {
          return reject(new Error("FFmpeg is not available."));
        }

        // Run actual FFmpeg command
        ffmpeg(sourcePath)
          .setStartTime(startTime)
          .setDuration(endTime - startTime)
          .output(outputPath)
          .on("progress", (progress) => {
            const percent = Math.min(99, Math.round(progress.percent || 0));
            if (io) {
              io.emit("clip.progress", {
                clipId: clip._id.toString(),
                progress: percent,
              });
            }
          })
          .on("end", async () => {
            try {
              // Update DB record only after successful media generation
              clip.startTime = startTime;
              clip.endTime = endTime;
              clip.fileUrl = publicUrl;
              await clip.save();

              if (io) {
                io.emit("clip.progress", {
                  clipId: clip._id.toString(),
                  progress: 100,
                });
              }
              resolve(clip);
            } catch (dbErr) {
              reject(dbErr);
            }
          })
          .on("error", (err) => {
            console.error("FFmpeg trim error:", err);
            // Cleanup partial files on failure
            if (fs.existsSync(outputPath)) {
              try {
                fs.unlinkSync(outputPath);
              } catch (unlinkErr) {
                console.error("Failed to delete partial file:", unlinkErr);
              }
            }
            if (io) {
              io.emit("clip.progress", {
                clipId: clip._id.toString(),
                error: err.message,
              });
            }
            reject(err);
          })
          .run();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Merge multiple clips into a single compilation file and save to DB.
   */
  mergeClips(clipIds, title, userId, io = null) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!clipIds || clipIds.length === 0) {
          return reject(new Error("No clips provided for merge."));
        }

        const clips = await MeetingClip.find({ _id: { $in: clipIds } });
        if (clips.length === 0) {
          return reject(new Error("No valid clips found."));
        }

        // Validate merge scope: all clips must belong to the same meeting
        const firstMeetingId = clips[0].meeting.toString();
        const sameMeeting = clips.every(
          (c) => c.meeting.toString() === firstMeetingId,
        );
        if (!sameMeeting) {
          return reject(
            new Error("Cannot merge clips from different meetings."),
          );
        }

        const firstClip = clips[0];
        const mergeId = new mongoose.Types.ObjectId().toString();

        // Resolve directory paths
        const clipsDir = path.resolve("uploads/clips");
        if (!fs.existsSync(clipsDir)) {
          fs.mkdirSync(clipsDir, { recursive: true });
        }

        const outputFilename = `merged_${mergeId}.mp4`;
        const outputPath = path.join(clipsDir, outputFilename);
        const publicUrl = `/uploads/clips/${outputFilename}`;

        // Get all source file paths that exist
        const inputPaths = [];
        for (const clip of clips) {
          if (clip.fileUrl) {
            const fullPath = clip.fileUrl.startsWith("uploads")
              ? path.resolve(clip.fileUrl)
              : path.resolve(
                  "uploads",
                  clip.fileUrl.replace(/^\/?uploads\/?/, ""),
                );
            if (fs.existsSync(fullPath)) {
              inputPaths.push(fullPath);
            }
          }
        }

        const allInputsExist = inputPaths.length === clips.length;
        if (!allInputsExist) {
          return reject(
            new Error("One or more clip source files are missing."),
          );
        }
        if (!ffmpeg) {
          return reject(new Error("FFmpeg is not available."));
        }

        const tempDir = path.resolve("uploads/temp");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const command = ffmpeg();
        inputPaths.forEach((ip) => command.input(ip));

        command
          .mergeToFile(outputPath, tempDir)
          .on("progress", (progress) => {
            const percent = Math.min(99, Math.round(progress.percent || 0));
            if (io) {
              io.emit("clip.progress", { clipId: mergeId, progress: percent });
            }
          })
          .on("end", async () => {
            try {
              // Save compilation record to DB only after successful merge
              const totalDuration = clips.reduce(
                (acc, c) => acc + (c.endTime - c.startTime),
                0,
              );

              const compilation = new MeetingClip({
                _id: mergeId,
                meeting: firstClip.meeting,
                createdBy: userId,
                title: title || "Merged Compilation",
                description: `Merged compilation of ${clips.length} clips.`,
                startTime: 0,
                endTime: totalDuration,
                fileUrl: publicUrl,
                isCompilation: true,
                mergedClips: clipIds,
              });
              await compilation.save();

              if (io) {
                io.emit("clip.progress", { clipId: mergeId, progress: 100 });
              }
              resolve(compilation);
            } catch (dbErr) {
              reject(dbErr);
            }
          })
          .on("error", (err) => {
            console.error("FFmpeg merge error:", err);
            // Cleanup partial files on failure
            if (fs.existsSync(outputPath)) {
              try {
                fs.unlinkSync(outputPath);
              } catch (unlinkErr) {
                console.error("Failed to delete partial file:", unlinkErr);
              }
            }
            if (io) {
              io.emit("clip.progress", { clipId: mergeId, error: err.message });
            }
            reject(err);
          })
          .run();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export default new MeetingClipExportService();
