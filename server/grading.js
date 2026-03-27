function norm(s) {
  return (s || "").toString().replace(/\s/g, "").replace(/[.。,，]/g, "").toLowerCase();
}

export function autoGrade(q, ans) {
  if (!ans || (Array.isArray(ans) && ans.every(a => !a)) || ans.toString().trim() === "")
    return { score: 0, st: "empty" };

  switch (q.type) {
    case "single5": case "single": case "xmark": case "circle": {
      const c = norm(q.answer[0]), g = norm(ans);
      if (g === c) return { score: q.pts, st: "ok" };
      if (q.options) {
        const i = q.options.findIndex(o => norm(o).includes(g) && g.length > 1);
        if (i >= 0 && String(i + 1) === c) return { score: q.pts, st: "ok" };
      }
      return { score: 0, st: "ng" };
    }
    case "multi2": {
      const cs = new Set(q.answer.map(norm));
      const gs = new Set((Array.isArray(ans) ? ans : []).map(norm).filter(Boolean));
      let m = 0; cs.forEach(c => { if (gs.has(c)) m++; });
      if (m === cs.size && gs.size === cs.size) return { score: q.pts, st: "ok" };
      if (m === 1) return { score: Math.floor(q.pts / 2), st: "pt" };
      return { score: 0, st: "ng" };
    }
    case "short": {
      const g = norm(ans);
      const ok = q.answer.some(a => { const n = norm(a); return n === g || g.includes(n) || n.includes(g); });
      return ok ? { score: q.pts, st: "ok" } : { score: 0, st: "ng" };
    }
    case "short2": {
      const aa = Array.isArray(ans) ? ans : [ans];
      let m = 0;
      q.answer.forEach((a, i) => { if (aa[i] && norm(aa[i]) === norm(a)) m++; });
      if (m === q.answer.length) return { score: q.pts, st: "ok" };
      if (m > 0) return { score: Math.floor(q.pts * m / q.answer.length), st: "pt" };
      return { score: 0, st: "ng" };
    }
    case "order": {
      const aa = Array.isArray(ans) ? ans : [];
      return q.answer.every((a, i) => norm(aa[i]) === norm(a))
        ? { score: q.pts, st: "ok" } : { score: 0, st: "ng" };
    }
    case "essay": case "essay2":
      return { score: -1, st: "ai" };
    default:
      return { score: 0, st: "ng" };
  }
}

export function gradeEssayLocal(q, ans) {
  const combined = Array.isArray(ans) ? ans.filter(Boolean).join(" ") : (ans || "");
  if (!combined.trim()) return { score: 0, reason: "미응답" };
  const answer = (q.answer || "").toLowerCase();
  const keywords = answer.replace(/[.,!?]/g, "").split(/\s+/).filter(w => w.length >= 2);
  const input = combined.toLowerCase();
  let matched = 0;
  for (const kw of keywords) { if (input.includes(kw)) matched++; }
  const ratio = keywords.length > 0 ? matched / keywords.length : 0;
  const score = Math.round(q.pts * Math.min(ratio * 1.3, 1));
  const reason = score >= q.pts ? "핵심 내용 포함" : score > 0 ? "일부 핵심 내용 포함" : "핵심 내용 부족";
  return { score, reason };
}

export async function gradeEssay(q, ans, apiKey) {
  const combined = Array.isArray(ans) ? ans.filter(Boolean).join("\n") : ans;
  if (!combined || !combined.trim()) return { score: 0, reason: "미응답" };
  if (!apiKey) return gradeEssayLocal(q, ans);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `초등4학년 국어 채점.\n[문제]${q.text}\n[배점]${q.pts}점\n[모범답안]${q.answer}\n[채점기준]${q.rubric}\n[학생답안]${combined}\n핵심 내용 맞으면 점수 부여. JSON만: {"score":숫자,"reason":"사유"}`
        }]
      })
    });
    clearTimeout(timer);
    if (!r.ok) return gradeEssayLocal(q, ans);
    const d = await r.json();
    const t = (d.content || []).map(c => c.text || "").join("");
    return JSON.parse(t.replace(/```json|```/g, "").trim());
  } catch (e) {
    return gradeEssayLocal(q, ans);
  }
}
