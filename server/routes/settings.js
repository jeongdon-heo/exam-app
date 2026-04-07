import { Router } from "express";
import { getSetting, setSetting } from "../db.js";

const router = Router();

/* ── API 키 조회 (마스킹) ── */
router.get("/api-key", (req, res) => {
  const key = getSetting("gemini_api_key") || "";
  if (!key) return res.json({ set: false, masked: "" });
  const masked = key.slice(0, 6) + "..." + key.slice(-4);
  res.json({ set: true, masked });
});

/* ── API 키 저장 ── */
router.post("/api-key", (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.trim()) return res.status(400).json({ error: "API 키가 필요합니다." });
  setSetting("gemini_api_key", apiKey.trim());
  res.json({ ok: true });
});

export default router;
