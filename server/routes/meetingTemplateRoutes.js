import express from "express";
import {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  instantiateTemplate,
} from "../controllers/meetingTemplateController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership, requireRole } from "../middleware/rbac.js";

const router = express.Router();

router.use(userAuth);
router.use(requireOrgMembership);

router.post("/", requireRole(["admin", "owner"]), createTemplate);
router.get("/", getTemplates);
router.get("/:id", getTemplateById);
router.put("/:id", requireRole(["admin", "owner"]), updateTemplate);
router.delete("/:id", requireRole(["admin", "owner"]), deleteTemplate);
router.post("/:id/instantiate", instantiateTemplate);

export default router;
