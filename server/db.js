import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "data", "exam.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS exams (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    subject   TEXT NOT NULL,
    grade     TEXT NOT NULL,
    unit      TEXT NOT NULL,
    round     TEXT,
    teacher_pw TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS sections (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id  INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    seq      INTEGER NOT NULL,
    title    TEXT,
    passage  TEXT,
    image    TEXT
  );

  CREATE TABLE IF NOT EXISTS questions (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id  INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    qnum     INTEGER NOT NULL,
    type     TEXT NOT NULL,
    text     TEXT,
    options  TEXT,
    answer   TEXT,
    pts      INTEGER NOT NULL DEFAULT 5,
    rubric   TEXT,
    meta     TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id   INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    name      TEXT NOT NULL,
    class_num TEXT NOT NULL,
    answers   TEXT NOT NULL,
    results   TEXT NOT NULL,
    total     INTEGER NOT NULL,
    pct       INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

/* ── helpers ── */

export function deactivateAllExams() {
  db.prepare("UPDATE exams SET is_active = 0").run();
}

export function insertExam({ subject, grade, unit, round, teacherPassword }) {
  const info = db.prepare(
    "INSERT INTO exams (subject, grade, unit, round, teacher_pw) VALUES (?,?,?,?,?)"
  ).run(subject, grade, unit, round || "", teacherPassword);
  return info.lastInsertRowid;
}

export function insertSection(examId, seq, { title, passage, image }) {
  const info = db.prepare(
    "INSERT INTO sections (exam_id, seq, title, passage, image) VALUES (?,?,?,?,?)"
  ).run(examId, seq, title || "", passage || "", image || null);
  return info.lastInsertRowid;
}

export function insertQuestion(examId, sectionId, q) {
  const meta = {};
  if (q.labels) meta.labels = q.labels;
  if (q.orderItems) meta.orderItems = q.orderItems;
  if (Array.isArray(q.answer)) meta.slots = q.answer.length;

  db.prepare(
    "INSERT INTO questions (exam_id, section_id, qnum, type, text, options, answer, pts, rubric, meta) VALUES (?,?,?,?,?,?,?,?,?,?)"
  ).run(
    examId, sectionId, q.id, q.type, q.text || "",
    q.options ? JSON.stringify(q.options) : null,
    JSON.stringify(q.answer), q.pts || 5, q.rubric || null,
    Object.keys(meta).length ? JSON.stringify(meta) : null
  );
}

export function getActiveExam() {
  return db.prepare("SELECT * FROM exams WHERE is_active = 1 ORDER BY id DESC LIMIT 1").get();
}

export function getExamSections(examId) {
  return db.prepare("SELECT * FROM sections WHERE exam_id = ? ORDER BY seq").all(examId);
}

export function getExamQuestions(examId) {
  return db.prepare("SELECT * FROM questions WHERE exam_id = ? ORDER BY qnum").all(examId);
}

export function getSectionQuestions(sectionId) {
  return db.prepare("SELECT * FROM questions WHERE section_id = ? ORDER BY qnum").all(sectionId);
}

export function insertSubmission(examId, { name, classNum, answers, results, total, pct }) {
  db.prepare(
    "INSERT INTO submissions (exam_id, name, class_num, answers, results, total, pct) VALUES (?,?,?,?,?,?,?)"
  ).run(examId, name, classNum, JSON.stringify(answers), JSON.stringify(results), total, pct);
}

export function getSubmissions(examId) {
  return db.prepare("SELECT * FROM submissions WHERE exam_id = ? ORDER BY CAST(class_num AS INTEGER)").all(examId);
}

export function deleteSubmissions(examId) {
  db.prepare("DELETE FROM submissions WHERE exam_id = ?").run(examId);
}

export function verifyTeacherPw(examId, pw) {
  const exam = db.prepare("SELECT teacher_pw FROM exams WHERE id = ?").get(examId);
  return exam && exam.teacher_pw === pw;
}

export function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}

export default db;
