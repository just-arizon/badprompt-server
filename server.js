// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import analyzePromptRouter from "./routes/analyzePrompt.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:5173";
app.use(cors({
  origin: allowedOrigin,
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

app.use("/api/analyze-prompt", analyzePromptRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`✅  API server running → http://localhost:${PORT}`);
});