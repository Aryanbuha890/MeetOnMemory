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
   * Helper to retrieve media file duration using ffprobe.
   */
  getFileDuration(sourcePath) {
    return new Promise((resolve, reject) => {
      if (!ffmpeg || typeof ffmpeg.ffprobe !== "function") {
        return reject(new Error("FFmpeg/ffprobe is not available."));
      }
      ffmpeg.ffprobe(sourcePath, (err, metadata) => {
        if (err) {
          return reject(err);
        }
        const duration = metadata?.format?.duration;
        if (duration === undefined || isNaN(duration)) {
          return reject(new Error("Unable to determine media duration."));
        }
        resolve(Number(duration));
      });
    });
  }

  /**
   * Helper to safely remove partial output files on failure.
   */
  cleanupPartialFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Failed to delete partial file ${filePath}:`, err);
      }
    }
  }

  /**
   * Trim an existing clip's start and end times and process the media file.
   * Note: startTime and endTime are meeting-relative timestamps (offsets from the original meeting video).
   */
  async trimClip(clipId, startTime, endTime, io = null) {
    // Validate boundaries
    if (
      startTime === undefined ||
      endTime === undefined ||
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime)
    ) {
      throw new Error("Start time and end time must be finite numeric values.");
    }
    if (startTime < 0) {
      throw new Error("Start time cannot be negative.");
    }
    if (endTime <= startTime) {
      throw new Error("End time must be greater than start time.");
    }

    const clip = await MeetingClip.findById(clipId);
    if (!clip) {
      throw new Error("Clip not found.");
    }

    const meeting = await Meeting.findById(clip.meeting);
    if (!meeting) {
      throw new Error("Associated meeting not found.");
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
      : path.resolve("uploads", sourceFileUrl.replace(/^\/?uploads\/?/, ""));

    const sourceExists = sourceFileUrl && fs.existsSync(sourcePath);
    if (!sourceExists) {
      throw new Error("Source media file not found.");
    }
    if (!ffmpeg) {
      throw new Error("FFmpeg is not available.");
    }

    // Validate boundaries against the actual source duration
    const sourceDuration = await this.getFileDuration(sourcePath);
    if (endTime > sourceDuration) {
      throw new Error(
        `End time (${endTime}s) exceeds source duration (${sourceDuration}s).`,
      );
    }

    // Run FFmpeg processing as a native Promise wrapper
    return new Promise((resolve, reject) => {
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
          this.cleanupPartialFile(outputPath);
          if (io) {
            io.emit("clip.progress", {
              clipId: clip._id.toString(),
              error: err.message,
            });
          }
          reject(err);
        })
        .run();
    });
  }

  /**
   * Merge multiple clips into a single compilation file and save to DB.
   */
  async mergeClips(clipIds, title, userId, io = null) {
    if (!clipIds || clipIds.length === 0) {
      throw new Error("No clips provided for merge.");
    }

    const clips = await MeetingClip.find({ _id: { $in: clipIds } });
    if (clips.length === 0) {
      throw new Error("No valid clips found.");
    }

    // Sort and reconstruct the clips array to preserve the requested order
    const clipMap = new Map(clips.map((c) => [c._id.toString(), c]));
    const orderedClips = clipIds
      .map((id) => clipMap.get(id.toString()))
      .filter(Boolean);

    if (orderedClips.length !== clipIds.length) {
      throw new Error("Some clips were not found.");
    }

    // Validate merge scope: all clips must belong to the same meeting
    const firstMeetingId = orderedClips[0].meeting.toString();
    const sameMeeting = orderedClips.every(
      (c) => c.meeting.toString() === firstMeetingId,
    );
    if (!sameMeeting) {
      throw new Error("Cannot merge clips from different meetings.");
    }

    // Validate the timing metadata range of every clip before performing calculations
    for (const clip of orderedClips) {
      if (
        clip.startTime === undefined ||
        clip.endTime === undefined ||
        !Number.isFinite(clip.startTime) ||
        !Number.isFinite(clip.endTime)
      ) {
        throw new Error(
          `Clip ${clip._id} has invalid timing range (non-finite or undefined).`,
        );
      }
      if (clip.startTime < 0) {
        throw new Error(`Clip ${clip._id} has negative start time.`);
      }
      if (clip.endTime <= clip.startTime) {
        throw new Error(
          `Clip ${clip._id} has end time less than or equal to start time.`,
        );
      }
    }

    const firstClip = orderedClips[0];
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
    for (const clip of orderedClips) {
      if (clip.fileUrl) {
        const fullPath = clip.fileUrl.startsWith("uploads")
          ? path.resolve(clip.fileUrl)
          : path.resolve("uploads", clip.fileUrl.replace(/^\/?uploads\/?/, ""));
        if (fs.existsSync(fullPath)) {
          inputPaths.push(fullPath);
        }
      }
    }

    const allInputsExist = inputPaths.length === orderedClips.length;
    if (!allInputsExist) {
      throw new Error("One or more clip source files are missing.");
    }
    if (!ffmpeg) {
      throw new Error("FFmpeg is not available.");
    }

    const tempDir = path.resolve("uploads/temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const command = ffmpeg();
    inputPaths.forEach((ip) => command.input(ip));

    return new Promise((resolve, reject) => {
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
            // Save compilation record to DB only after successful merge completion
            const totalDuration = orderedClips.reduce(
              (acc, c) => acc + (c.endTime - c.startTime),
              0,
            );

            const compilation = new MeetingClip({
              _id: mergeId,
              meeting: firstClip.meeting,
              createdBy: userId,
              title: title || "Merged Compilation",
              description: `Merged compilation of ${orderedClips.length} clips.`,
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
          this.cleanupPartialFile(outputPath);
          if (io) {
            io.emit("clip.progress", { clipId: mergeId, error: err.message });
          }
          reject(err);
        })
        .run();
    });
  }
}

export default new MeetingClipExportService();
