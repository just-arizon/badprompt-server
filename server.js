// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import analyzePromptRouter from "./routes/analyzePrompt.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

const allowedOrigins = [
  "http://localhost:5173",
  "https://bad-prompt.vercel.app",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use("/api/analyze-prompt", analyzePromptRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`✅  API server running → http://localhost:${PORT}`);
});