import express from "express";
import { handleHybridSearch } from "../controllers/hybridSearchController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

router.use(userAuth);

router.get("/hybrid", handleHybridSearch);

export default router;
