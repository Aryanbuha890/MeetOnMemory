import { performHybridSearch } from "../services/hybridSearchService.js";

export const hybridSearch = async (req, res, next) => {
  try {
    const query = req.body?.query || req.query?.query;
    const dateFrom =
      req.body?.dateFrom ||
      req.body?.startDate ||
      req.query?.dateFrom ||
      req.query?.startDate;
    const dateTo =
      req.body?.dateTo ||
      req.body?.endDate ||
      req.query?.dateTo ||
      req.query?.endDate;
    const tags = req.body?.tags || req.query?.tags;
    const speaker = req.body?.speaker || req.query?.speaker;
    const organizer = req.body?.organizer || req.query?.organizer;
    const department = req.body?.department || req.query?.department;

    const organizationId = req.user?.organization || req.user?.organizationId;
    const userId = req.user?._id || req.user?.id;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "query field is required",
      });
    }

    let tagsArray = undefined;
    if (tags) {
      tagsArray = Array.isArray(tags)
        ? tags
        : tags.split(",").map((t) => t.trim());
    }

    const result = await performHybridSearch({
      query,
      organizationId,
      userId,
      dateFrom,
      dateTo,
      tags: tagsArray,
      speaker,
      organizer,
      department,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleHybridSearch = hybridSearch;
