import { Router } from "express";
import {
  getActiveExam, getExamQuestions, insertSubmission,
  getSubmissions, deleteSubmissions, verifyTeacherPw,
} from "../db.js";
import { autoGrade, gradeEssay } from "../grading.js";

const router = Router();

/* ── 답안 제출 + 서버 채점 ── */
router.post("/", async (req, res) => {
  try {
    const { name, classNum, answers } = req.body;
    if (!name || !classNum || !answers) {
      return res.status(400).json({ error: "name, classNum, answers 필수" });
    }

    const exam = getActiveExam();
    if (!exam) return res.status(404).json({ error: "활성 시험 없음" });

    const questions = getExamQuestions(exam.id).map(q => ({
      id: q.qnum,
      type: q.type,
      text: q.text,
      options: q.options ? JSON.parse(q.options) : null,
      answer: JSON.parse(q.answer),
      pts: q.pts,
      rubric: q.rubric,
    }));

    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    const results = {};
    const totalPts = questions.reduce((s, q) => s + q.pts, 0);

    for (const q of questions) {
      const a = answers[q.id];
      const r = autoGrade(q, a);
      if (r.st === "ai") {
        const ai = await gradeEssay(q, a, apiKey);
        results[q.id] = {
          score: Math.min(ai.score, q.pts),
          st: ai.score >= q.pts ? "ok" : ai.score > 0 ? "pt" : "ng",
          reason: ai.reason,
        };
      } else if (r.st === "empty") {
        results[q.id] = { score: 0, st: "empty" };
      } else {
        results[q.id] = r;
      }
    }

    const total = questions.reduce((s, q) => s + (results[q.id]?.score || 0), 0);
    const pct = Math.round(total / totalPts * 100);

    insertSubmission(exam.id, { name, classNum, answers, results, total, pct });

    res.json({ ok: true, results, total, pct });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── 채점 결과 조회 (교사용) ── */
router.get("/", (req, res) => {
  const { examId, pw } = req.query;
  const exam = getActiveExam();
  if (!exam) return res.json([]);

  const eid = examId ? Number(examId) : exam.id;
  if (!verifyTeacherPw(eid, pw)) return res.status(403).json({ error: "비밀번호 오류" });

  const rows = getSubmissions(eid).map(r => ({
    id: r.id,
    name: r.name,
    classNum: r.class_num,
    answers: JSON.parse(r.answers),
    results: JSON.parse(r.results),
    total: r.total,
    pct: r.pct,
    time: r.created_at,
  }));
  res.json(rows);
});

/* ── 결과 초기화 (교사용) ── */
router.delete("/", (req, res) => {
  const { examId, pw } = req.query;
  const exam = getActiveExam();
  if (!exam) return res.json({ ok: true });

  const eid = examId ? Number(examId) : exam.id;
  if (!verifyTeacherPw(eid, pw)) return res.status(403).json({ error: "비밀번호 오류" });

  deleteSubmissions(eid);
  res.json({ ok: true });
});

export default router;
