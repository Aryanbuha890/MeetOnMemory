import { z } from "zod";
import FocusTimeService from "../services/focusTimeService.js";

const createBlockSchema = z.object({
  title: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  isRecurring: z.boolean().optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  timezone: z.string().optional(),
  allowOverride: z.boolean().optional(),
  policy: z.enum(["warn", "block"]).optional(),
});

export const createFocusTimeBlock = async (req, res, next) => {
  try {
    const validatedData = createBlockSchema.parse(req.body);
    const block = await FocusTimeService.createBlock(
      req.user._id,
      validatedData,
    );
    res.status(201).json(block);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Validation error", errors: error.errors });
    }
    next(error);
  }
};

export const getFocusTimeBlocks = async (req, res, next) => {
  try {
    const blocks = await FocusTimeService.getUserBlocks(req.user._id);
    res.json(blocks);
  } catch (error) {
    next(error);
  }
};

const updateBlockSchema = createBlockSchema.partial();

export const updateFocusTimeBlock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedData = updateBlockSchema.parse(req.body);

    const block = await FocusTimeService.updateBlock(
      req.user._id,
      id,
      validatedData,
    );

    if (!block) {
      return res.status(404).json({ message: "Focus time block not found" });
    }

    res.json(block);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Validation error", errors: error.errors });
    }
    next(error);
  }
};

export const deleteFocusTimeBlock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const block = await FocusTimeService.deleteBlock(req.user._id, id);

    if (!block) {
      return res.status(404).json({ message: "Focus time block not found" });
    }

    res.json({ message: "Focus time block deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const getFocusTimeAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "startDate and endDate query parameters are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const analytics = await FocusTimeService.calculateAnalytics(
      req.user._id,
      start,
      end,
    );
    res.json(analytics);
  } catch (error) {
    next(error);
  }
};

export const checkFocusTimeConflicts = async (req, res, next) => {
  try {
    const { startTime, endTime, userId } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        message: "startTime and endTime query parameters are required",
      });
    }

    const targetUserId = userId || req.user._id;
    const conflictResult = await FocusTimeService.checkConflicts(
      targetUserId,
      startTime,
      endTime,
    );

    res.json(conflictResult);
  } catch (error) {
    next(error);
  }
};
