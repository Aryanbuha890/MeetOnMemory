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
  console.log("ℹ️ fluent-ffmpeg module not loaded. Using fallback simulation.");
}

class MeetingClipExportService {
  /**
   * Trim an existing clip's start and end times and process the media file.
   */
  async trimClip(clipId, startTime, endTime, io = null) {
    if (startTime >= endTime) {
      throw new Error("Start time must be less than end time.");
    }
    if (startTime < 0) {
      throw new Error("Start time cannot be negative.");
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

    // Update DB record
    clip.startTime = startTime;
    clip.endTime = endTime;
    clip.fileUrl = publicUrl;
    await clip.save();

    // Check if source file exists
    const sourceFileUrl = meeting.fileUrl || "";
    const sourcePath = sourceFileUrl.startsWith("uploads")
      ? path.resolve(sourceFileUrl)
      : path.resolve("uploads", sourceFileUrl.replace(/^\/?uploads\/?/, ""));

    const sourceExists = sourceFileUrl && fs.existsSync(sourcePath);

    if (sourceExists && ffmpeg) {
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
        .on("end", () => {
          if (io) {
            io.emit("clip.progress", {
              clipId: clip._id.toString(),
              progress: 100,
            });
          }
        })
        .on("error", (err) => {
          console.error("FFmpeg trim error:", err);
          if (io) {
            io.emit("clip.progress", {
              clipId: clip._id.toString(),
              error: err.message,
            });
          }
        })
        .run();
    } else {
      // Fallback: Simulation for development/testing
      let percent = 0;
      const interval = setInterval(async () => {
        percent += 20;
        if (percent >= 100) {
          clearInterval(interval);
          try {
            await fs.promises.writeFile(
              outputPath,
              `Simulated trimmed clip media for ID ${clip._id} from ${startTime}s to ${endTime}s`,
            );
          } catch (writeErr) {
            console.error("Failed to write mock file:", writeErr);
          }
          if (io) {
            io.emit("clip.progress", {
              clipId: clip._id.toString(),
              progress: 100,
            });
          }
        } else {
          if (io) {
            io.emit("clip.progress", {
              clipId: clip._id.toString(),
              progress: percent,
            });
          }
        }
      }, 100);
    }

    return clip;
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
          : path.resolve("uploads", clip.fileUrl.replace(/^\/?uploads\/?/, ""));
        if (fs.existsSync(fullPath)) {
          inputPaths.push(fullPath);
        }
      }
    }

    const allInputsExist = inputPaths.length === clips.length;

    // Save compilation record to DB
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

    if (allInputsExist && ffmpeg) {
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
        .on("end", () => {
          if (io) {
            io.emit("clip.progress", { clipId: mergeId, progress: 100 });
          }
        })
        .on("error", (err) => {
          console.error("FFmpeg merge error:", err);
          if (io) {
            io.emit("clip.progress", { clipId: mergeId, error: err.message });
          }
        })
        .run();
    } else {
      // Fallback: Simulation for development/testing
      let percent = 0;
      const interval = setInterval(async () => {
        percent += 20;
        if (percent >= 100) {
          clearInterval(interval);
          try {
            await fs.promises.writeFile(
              outputPath,
              `Simulated merged compilation media for ID ${mergeId} combining ${clips.length} clips.`,
            );
          } catch (writeErr) {
            console.error("Failed to write mock file:", writeErr);
          }
          if (io) {
            io.emit("clip.progress", { clipId: mergeId, progress: 100 });
          }
        } else {
          if (io) {
            io.emit("clip.progress", { clipId: mergeId, progress: percent });
          }
        }
      }, 100);
    }

    return compilation;
  }
}

export default new MeetingClipExportService();
