const SUPPORTED_TYPES = {
  "application/pdf": "application/pdf",
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

const PROMPT = `당신은 초등학교 시험지 분석기입니다. 이 시험지에서 모든 문제를 추출하여 아래 JSON 형식으로 반환하세요.

반드시 유효한 JSON만 반환하세요. 마크다운 코드 블록이나 설명 없이 JSON만 출력하세요.

{
  "exam": {
    "subject": "과목명",
    "grade": "학년-학기 (예: 4-1)",
    "unit": "단원명",
    "round": "회차 (예: 1회)",
    "teacherPassword": "1234"
  },
  "sections": [
    {
      "title": "섹션 제목/지시문 (예: ※ 다음 글을 읽고 물음에 답하시오.)",
      "passage": "지문 내용 (없으면 빈 문자열)",
      "questions": [
        {
          "id": 1,
          "type": "문제 유형",
          "text": "문제 내용",
          "options": ["① 보기1", "② 보기2", ...] 또는 null,
          "answer": "정답",
          "pts": 배점,
          "rubric": "채점 기준 (서술형만)"
        }
      ]
    }
  ]
}

문제 유형 규칙:
- "single5": 5지선다 (보기 5개), answer는 ["정답번호"] (예: ["3"])
- "single": 보기 5개 미만 객관식, answer 형식 동일
- "multi2": 2개 고르기, answer는 ["3","4"]
- "short": 단답형 (답 1개), answer는 ["정답"] (허용 답안 배열)
- "short2": 단답형 (답 2개 이상), answer는 ["답1","답2"], labels 배열 추가
- "circle": ○표 하기, answer는 ["번호"]
- "xmark": ✕표/틀린 것 고르기, answer는 ["번호"]
- "order": 순서 배열, answer는 ["2","3","1"], orderItems 배열 추가
- "essay": 서술형 (답란 1개), answer는 "모범답안 문자열", rubric 필수
- "essay2": 서술형 (답란 2개 이상), answer는 "모범답안 문자열", rubric과 labels 필수

중요 규칙:
- 시험지에서 과목, 학년, 단원, 회차 정보를 반드시 추출하세요
- 배점이 표시되어 있으면 그대로 사용, 없으면 5점 기본
- 같은 지문을 공유하는 문제들은 하나의 section으로 묶으세요
- 문제 번호(id)는 시험지에 표시된 번호를 사용하세요
- 정답을 시험지에서 확인할 수 없는 경우 answer에 빈 배열 [] 또는 빈 문자열 ""을 넣으세요
- options의 각 항목에는 번호(①②③④⑤)를 포함하세요`;

export async function parseExamDocument(fileBuffer, mimeType, apiKey) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. 서버 .env 파일에 키를 추가하세요.");
  }

  const supportedMime = SUPPORTED_TYPES[mimeType];
  if (!supportedMime) {
    throw new Error(`지원하지 않는 파일 형식입니다: ${mimeType}. PDF, JPG, PNG, WebP만 가능합니다.`);
  }

  const base64 = Buffer.from(fileBuffer).toString("base64");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: supportedMime, data: base64 } },
            { text: PROMPT },
          ],
        }],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.1,
        },
      }),
    });
    clearTimeout(timer);

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API 오류 (${r.status})`);
    }

    const d = await r.json();
    // thinking 파트 제외, text 파트만 추출
    const parts = d.candidates?.[0]?.content?.parts || [];
    const text = parts.filter(p => !p.thought).map(p => p.text || "").join("");

    console.log("[documentParser] Gemini 응답 길이:", text.length);
    if (text.length < 500) console.log("[documentParser] 응답 내용:", text);

    if (!text) {
      throw new Error("Gemini API가 빈 응답을 반환했습니다. 다시 시도해 주세요.");
    }

    // JSON 추출: 코드블록 안의 JSON 또는 첫 { ~ 마지막 } 사이
    let jsonStr;
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    } else {
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = text.slice(firstBrace, lastBrace + 1);
      } else {
        jsonStr = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("[documentParser] JSON 파싱 실패:", parseErr.message);
      console.error("[documentParser] 추출된 문자열 앞 200자:", jsonStr?.slice(0, 200));
      throw new Error("AI가 시험 문제를 인식하지 못했습니다. 더 선명한 파일로 다시 시도해 주세요.");
    }

    if (!parsed.exam || !parsed.sections || !Array.isArray(parsed.sections)) {
      throw new Error("AI 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.");
    }

    // 기본값 보정
    parsed.exam.teacherPassword = parsed.exam.teacherPassword || "1234";
    parsed.exam.subject = parsed.exam.subject || "미지정";
    parsed.exam.grade = parsed.exam.grade || "미지정";
    parsed.exam.unit = parsed.exam.unit || "미지정";
    parsed.exam.round = parsed.exam.round || "1회";

    for (const sec of parsed.sections) {
      sec.title = sec.title || "";
      sec.passage = sec.passage || "";
      for (const q of (sec.questions || [])) {
        q.pts = q.pts || 5;
      }
    }

    return parsed;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      throw new Error("AI 분석 시간이 초과되었습니다. 파일 크기를 줄여서 다시 시도해 주세요.");
    }
    throw e;
  }
}
