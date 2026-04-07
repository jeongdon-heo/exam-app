import { Router } from "express";
import multer from "multer";
import {
  deactivateAllExams, insertExam, insertSection, insertQuestion,
  getActiveExam, getExamSections, getExamQuestions, getSectionQuestions,
  verifyTeacherPw, getSetting,
} from "../db.js";
import { parseExamDocument } from "../documentParser.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function saveExamToDB({ exam, sections }) {
  deactivateAllExams();
  const examId = insertExam(exam);
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const sectionId = insertSection(examId, i, sec);
    for (const q of (sec.questions || [])) {
      insertQuestion(examId, sectionId, q);
    }
  }
  return examId;
}

/* ── 시험 JSON 업로드 ── */
router.post("/upload", upload.single("file"), (req, res) => {
  try {
    let data;
    if (req.file) {
      data = JSON.parse(req.file.buffer.toString("utf-8"));
    } else if (req.body && req.body.exam) {
      data = req.body;
    } else {
      return res.status(400).json({ error: "JSON 파일 또는 데이터가 필요합니다." });
    }

    const { exam, sections } = data;
    if (!exam || !sections || !Array.isArray(sections)) {
      return res.status(400).json({ error: "잘못된 형식: exam, sections 필수" });
    }

    const examId = saveExamToDB({ exam, sections });
    res.json({ ok: true, examId: Number(examId) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* ── PDF/이미지 시험지 업로드 (AI 분석) ── */
router.post("/upload-document", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "파일이 필요합니다." });

    const mime = req.file.mimetype;
    const apiKey = getSetting("gemini_api_key") || process.env.GEMINI_API_KEY || "";

    const parsed = await parseExamDocument(req.file.buffer, mime, apiKey);
    const examId = saveExamToDB(parsed);

    res.json({ ok: true, examId: Number(examId) });
  } catch (e) {
    const status = e.message.includes("API_KEY") ? 400 : e.message.includes("지원하지") ? 400 : 500;
    res.status(status).json({ error: e.message });
  }
});

/* ── 활성 시험 조회 (학생용 - 정답 제외) ── */
router.get("/active", (req, res) => {
  const exam = getActiveExam();
  if (!exam) return res.json({ exam: null, sections: [] });

  const sections = getExamSections(exam.id).map(sec => {
    const questions = getSectionQuestions(sec.id).map(q => {
      const r = { id: q.qnum, type: q.type, text: q.text, options: q.options ? JSON.parse(q.options) : null, pts: q.pts };
      if (q.meta) {
        const m = JSON.parse(q.meta);
        if (m.labels) r.labels = m.labels;
        if (m.orderItems) r.orderItems = m.orderItems;
        if (m.slots) r.slots = m.slots;
      }
      return r;
    });
    return { title: sec.title, passage: sec.passage, image: sec.image, questions };
  });

  res.json({
    exam: { id: exam.id, subject: exam.subject, grade: exam.grade, unit: exam.unit, round: exam.round },
    sections,
  });
});

/* ── 활성 시험 전체 조회 (교사용 - 정답 포함) ── */
router.get("/active/full", (req, res) => {
  const { pw } = req.query;
  const exam = getActiveExam();
  if (!exam) return res.json({ exam: null, sections: [] });
  if (!verifyTeacherPw(exam.id, pw)) return res.status(403).json({ error: "비밀번호 오류" });

  const sections = getExamSections(exam.id).map(sec => {
    const questions = getSectionQuestions(sec.id).map(q => {
      const r = { id: q.qnum, type: q.type, text: q.text, options: q.options ? JSON.parse(q.options) : null, answer: JSON.parse(q.answer), pts: q.pts, rubric: q.rubric };
      if (q.meta) {
        const m = JSON.parse(q.meta);
        if (m.labels) r.labels = m.labels;
        if (m.orderItems) r.orderItems = m.orderItems;
      }
      return r;
    });
    return { title: sec.title, passage: sec.passage, image: sec.image, questions };
  });

  res.json({
    exam: { id: exam.id, subject: exam.subject, grade: exam.grade, unit: exam.unit, round: exam.round, teacherPassword: exam.teacher_pw },
    sections,
  });
});

export default router;
