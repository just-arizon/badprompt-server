import { Router } from "express";
import { analyzePrompt } from "../controllers/analyzePrompt.js";

const router = Router();
router.post("/", analyzePrompt);

export default router;