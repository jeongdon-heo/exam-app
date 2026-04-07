import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";

import examsRouter from "./routes/exams.js";
import submissionsRouter from "./routes/submissions.js";
import settingsRouter from "./routes/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

/* ── API routes ── */
app.use("/api/exams", examsRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/settings", settingsRouter);

/* ── 프로덕션: dist 정적 파일 서빙 ── */
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
