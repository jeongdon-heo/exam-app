import { useState, useEffect, useRef } from "react";

const C={bg:"#f6f7fb",card:"#ffffff",acc:"#4361ee",ok:"#2ecc71",ng:"#e74c3c",pt:"#f39c12",tx:"#2d3436",tx2:"#636e72",bd:"#e0e4ea",inp:"#f1f3f7",wh:"#fff",hero:"linear-gradient(135deg,#4361ee 0%,#7c3aed 100%)"};
const F=`'Pretendard','Noto Sans KR',system-ui,sans-serif`;

export default function App(){
  const [mode,setMode]=useState("login");
  const [name,setName]=useState("");
  const [num,setNum]=useState("");
  const [ans,setAns]=useState({});
  const [res,setRes]=useState({});
  const [prog,setProg]=useState(0);
  const [gmsg,setGmsg]=useState("");
  const [si,setSi]=useState(0);
  const [pw,setPw]=useState("");
  const [allRes,setAllRes]=useState([]);
  const [td,setTd]=useState(null);
  const sr=useRef(null);

  /* ── API 상태 ── */
  const [exam,setExam]=useState(null);
  const [sections,setSections]=useState([]);
  const [loading,setLoading]=useState(true);
  const [totalScore,setTotalScore]=useState(0);
  const [pctScore,setPctScore]=useState(0);
  const [teacherAuth,setTeacherAuth]=useState(false);

  /* ── 파생 값 ── */
  const allQ=sections.flatMap(s=>s.questions);
  const total=allQ.reduce((s,q)=>s+q.pts,0);

  /* ── 시험 데이터 로드 ── */
  const loadExam=()=>{
    setLoading(true);
    fetch("/api/exams/active")
      .then(r=>r.json())
      .then(d=>{setExam(d.exam);setSections(d.sections||[]);setLoading(false);})
      .catch(()=>setLoading(false));
  };
  useEffect(loadExam,[]);

  /* ── 헬퍼 ── */
  const setA=(id,v)=>setAns(p=>({...p,[id]:v}));
  const getA=id=>ans[id]||"";
  const answered=allQ.filter(q=>{const a=ans[q.id];return a&&(Array.isArray(a)?a.some(Boolean):a.toString().trim());}).length;
  const ico=st=>({ok:"✅",pt:"🔶",ng:"❌",empty:"⬜"}[st]||"⬜");
  const tC=st=>({ok:C.ok,pt:C.pt,ng:C.ng}[st]||C.tx2);
  const typeTag=t=>({single5:"선택",single:"선택",multi2:"2개 선택",short:"단답형",short2:"단답형",xmark:"×표시",circle:"○표시",order:"순서",essay:"서술형",essay2:"서술형"}[t]||"");
  const typeClr=t=>["essay","essay2"].includes(t)?"#e74c3c":["short","short2"].includes(t)?"#e67e22":t==="order"?"#9b59b6":["xmark","circle"].includes(t)?"#16a085":"#3498db";

  /* ── 답안 제출 (서버 채점) ── */
  const doSubmit=async()=>{
    setMode("submit");setProg(10);setGmsg("서버에 제출 중...");
    try{
      const r=await fetch("/api/submissions",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name,classNum:num,answers:ans}),
      });
      setProg(80);
      const d=await r.json();
      if(d.ok){
        setRes(d.results);setTotalScore(d.total);setPctScore(d.pct);setProg(100);setMode("result");
      }else{
        alert("제출 실패: "+(d.error||"알 수 없는 오류"));setMode("test");
      }
    }catch(e){alert("네트워크 오류: "+e.message);setMode("test");}
  };

  /* ── 교사 인증 (서버 검증) ── */
  const doTeacherAuth=async()=>{
    try{
      const r=await fetch(`/api/submissions?pw=${encodeURIComponent(pw)}`);
      if(r.ok){const data=await r.json();setAllRes(data);setTeacherAuth(true);loadApiKey();}
      else{alert("비밀번호가 틀립니다.");}
    }catch(e){alert("서버 오류: "+e.message);}
  };

  /* ── 교사 결과 초기화 (서버) ── */
  const resetAll=async()=>{
    if(!confirm("모든 결과를 삭제합니까?"))return;
    try{
      await fetch(`/api/submissions?pw=${encodeURIComponent(pw)}`,{method:"DELETE"});
      setAllRes([]);
    }catch(e){alert("오류: "+e.message);}
  };

  /* ── 시험 JSON 업로드 ── */
  const uploadExam=async(file)=>{
    const fd=new FormData();fd.append("file",file);
    try{
      const r=await fetch("/api/exams/upload",{method:"POST",body:fd});
      const d=await r.json();
      if(d.ok){alert("시험 업로드 완료! (ID: "+d.examId+")");loadExam();}
      else{alert("업로드 실패: "+(d.error||""));}
    }catch(e){alert("오류: "+e.message);}
  };

  /* ── PDF/이미지 시험지 업로드 (AI 분석) ── */
  const [docUploading,setDocUploading]=useState(false);
  const [docError,setDocError]=useState("");
  const uploadDocument=async(file)=>{
    setDocUploading(true);setDocError("");
    const fd=new FormData();fd.append("file",file);
    try{
      const r=await fetch("/api/exams/upload-document",{method:"POST",body:fd});
      const d=await r.json();
      if(d.ok){alert("AI 분석 완료! 시험이 등록되었습니다. (ID: "+d.examId+")");loadExam();}
      else{setDocError(d.error||"업로드 실패");}
    }catch(e){setDocError("네트워크 오류: "+e.message);}
    finally{setDocUploading(false);}
  };

  /* ── Gemini API 키 관리 ── */
  const [apiKeyInput,setApiKeyInput]=useState("");
  const [apiKeyMasked,setApiKeyMasked]=useState("");
  const [apiKeySet,setApiKeySet]=useState(false);
  const [apiKeySaving,setApiKeySaving]=useState(false);
  const loadApiKey=()=>{
    fetch("/api/settings/api-key").then(r=>r.json()).then(d=>{setApiKeySet(d.set);setApiKeyMasked(d.masked||"");}).catch(()=>{});
  };
  const saveApiKey=async()=>{
    if(!apiKeyInput.trim())return;
    setApiKeySaving(true);
    try{
      const r=await fetch("/api/settings/api-key",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiKey:apiKeyInput})});
      const d=await r.json();
      if(d.ok){setApiKeyInput("");loadApiKey();alert("API 키가 저장되었습니다.");}
      else{alert("저장 실패: "+(d.error||""));}
    }catch(e){alert("오류: "+e.message);}
    finally{setApiKeySaving(false);}
  };

  const css=`@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');*{box-sizing:border-box;margin:0;padding:0}input:focus,textarea:focus,select:focus{outline:2px solid ${C.acc};outline-offset:-1px}::placeholder{color:#adb5bd}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#ccc;border-radius:2px}`;

  /* ── 입력 렌더링 ── */
  const renderInput=(q)=>{
    const a=getA(q.id);
    const os=(sel)=>({display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",borderRadius:10,cursor:"pointer",background:sel?C.acc+"10":C.inp,border:`2px solid ${sel?C.acc:"transparent"}`,transition:"all .15s",marginBottom:4});
    switch(q.type){
      case "single5":case "single":
        return <div>{q.options.map((o,i)=>{const v=String(i+1),sel=a===v;return <label key={i} style={os(sel)}><input type="radio" name={`q${q.id}`} checked={sel} onChange={()=>setA(q.id,v)} style={{accentColor:C.acc,marginTop:3,flexShrink:0}} /><span style={{fontSize:14,color:sel?C.acc:C.tx,fontWeight:sel?600:400,lineHeight:1.5}}>{o}</span></label>;})}</div>;
      case "circle":
        return <div>{q.options.map((o,i)=>{const v=String(i+1),sel=a===v;return <div key={i} onClick={()=>setA(q.id,sel?"":v)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:10,cursor:"pointer",background:sel?"#e8f8f5":C.inp,border:`2px solid ${sel?"#16a085":"transparent"}`,transition:"all .15s",marginBottom:4,userSelect:"none"}}><span style={{width:32,height:32,borderRadius:"50%",border:`3px solid ${sel?"#16a085":"#bbb"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#16a085",flexShrink:0,background:sel?"#d5f5e3":"transparent"}}>{sel?"○":""}</span><span style={{fontSize:14,color:sel?"#16a085":C.tx,fontWeight:sel?600:400,lineHeight:1.5}}>{o}</span></div>;})}</div>;
      case "xmark":
        return <div>{q.options.map((o,i)=>{const v=String(i+1),sel=a===v;return <div key={i} onClick={()=>setA(q.id,sel?"":v)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:10,cursor:"pointer",background:sel?"#fdedec":C.inp,border:`2px solid ${sel?"#e74c3c":"transparent"}`,transition:"all .15s",marginBottom:4,userSelect:"none"}}><span style={{width:32,height:32,borderRadius:6,border:`3px solid ${sel?"#e74c3c":"#bbb"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#e74c3c",flexShrink:0,background:sel?"#f9e0de":"transparent"}}>{sel?"✕":""}</span><span style={{fontSize:14,color:sel?"#e74c3c":C.tx,fontWeight:sel?600:400,lineHeight:1.5,textDecoration:sel?"line-through":"none"}}>{o}</span></div>;})}</div>;
      case "multi2":
        return <div><div style={{fontSize:12,color:C.pt,fontWeight:600,marginBottom:6}}>⚠ 2개를 선택하세요</div>{q.options.map((o,i)=>{const v=String(i+1),arr=Array.isArray(a)?a:[],sel=arr.includes(v);return <label key={i} style={os(sel)}><input type="checkbox" checked={sel} onChange={()=>{let c=[...arr];if(sel)c=c.filter(x=>x!==v);else{if(c.length>=2)c.shift();c.push(v);}setA(q.id,c);}} style={{accentColor:C.acc,marginTop:3,flexShrink:0}} /><span style={{fontSize:14,color:sel?C.acc:C.tx,fontWeight:sel?600:400,lineHeight:1.5}}>{o}</span></label>;})}</div>;
      case "short":
        return <input value={a} onChange={e=>setA(q.id,e.target.value)} placeholder="답을 입력하세요" style={{fontFamily:F,fontSize:15,padding:"12px 16px",background:C.inp,border:`2px solid ${C.bd}`,borderRadius:10,color:C.tx,width:"100%"}} />;
      case "short2":{
        const cnt=q.slots||q.labels?.length||2;
        return <div style={{display:"flex",flexDirection:"column",gap:8}}>{Array.from({length:cnt},(_,i)=><div key={i}><div style={{fontSize:12,color:C.tx2,marginBottom:4,lineHeight:1.5}}>{q.labels?.[i]||`(${i+1})`}</div><input value={Array.isArray(a)?(a[i]||""):""} onChange={e=>{const arr=Array.isArray(a)?[...a]:[];arr[i]=e.target.value;setA(q.id,arr);}} placeholder="답 입력" style={{fontFamily:F,fontSize:15,padding:"10px 14px",background:C.inp,border:`2px solid ${C.bd}`,borderRadius:10,color:C.tx,width:"100%"}} /></div>)}</div>;}
      case "order":{
        const cnt=q.slots||3;
        return <div>{q.orderItems&&q.orderItems.map((item,i)=><div key={i} style={{fontSize:13,color:C.tx2,marginBottom:4,lineHeight:1.5,background:C.inp,borderRadius:8,padding:"8px 12px"}}>{item}</div>)}<div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,flexWrap:"wrap"}}><span style={{fontSize:13,color:C.tx2}}>순서:</span>{Array.from({length:cnt},(_,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:4}}><select value={Array.isArray(a)?(a[i]||""):""} onChange={e=>{const arr=Array.isArray(a)?[...a]:[];arr[i]=e.target.value;setA(q.id,arr);}} style={{fontFamily:F,fontSize:15,padding:"8px 12px",background:C.inp,border:`2px solid ${C.bd}`,borderRadius:8,color:C.tx}}><option value="">-</option>{Array.from({length:cnt},(_,j)=><option key={j+1} value={String(j+1)}>({j+1})</option>)}</select>{i<cnt-1&&<span style={{color:C.tx2}}>→</span>}</div>)}</div></div>;}
      case "essay":
        return <textarea value={a} onChange={e=>setA(q.id,e.target.value)} placeholder="답을 자세히 쓰세요" rows={4} style={{fontFamily:F,fontSize:15,padding:"12px 16px",background:C.inp,border:`2px solid ${C.bd}`,borderRadius:10,color:C.tx,width:"100%",resize:"vertical",lineHeight:1.7}} />;
      case "essay2":
        return <div style={{display:"flex",flexDirection:"column",gap:10}}>{(q.labels||["질문","답"]).map((lb,i)=><div key={i}><div style={{fontSize:13,color:C.acc,fontWeight:600,marginBottom:4}}>{lb}</div><textarea value={Array.isArray(a)?(a[i]||""):""} onChange={e=>{const arr=Array.isArray(a)?[...a]:[];arr[i]=e.target.value;setA(q.id,arr);}} placeholder={`${lb}을(를) 쓰세요`} rows={2} style={{fontFamily:F,fontSize:15,padding:"10px 14px",background:C.inp,border:`2px solid ${C.bd}`,borderRadius:10,color:C.tx,width:"100%",resize:"vertical",lineHeight:1.6}} /></div>)}</div>;
      default: return null;
    }
  };

  /* ══════════ LOADING ══════════ */
  if(loading) return (
    <div style={{fontFamily:F,background:C.bg,color:C.tx,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40}}>
      <style>{css}</style>
      <div style={{fontSize:48,marginBottom:20}}>📝</div>
      <div style={{fontSize:18,fontWeight:700}}>시험 데이터 로딩 중...</div>
    </div>
  );

  /* ══════════ NO EXAM ══════════ */
  if(!exam) return (
    <div style={{fontFamily:F,background:C.bg,color:C.tx,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40}}>
      <style>{css}</style>
      <div style={{fontSize:48,marginBottom:20}}>📭</div>
      <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>등록된 시험이 없습니다</div>
      <div style={{fontSize:14,color:C.tx2,marginBottom:24}}>선생님이 시험을 등록해 주세요.</div>
      <button onClick={()=>setMode("teacher")} style={{fontFamily:F,fontSize:13,fontWeight:500,border:`1px solid ${C.bd}`,borderRadius:10,cursor:"pointer",padding:"10px 20px",background:"transparent",color:C.tx2}}>🔐 선생님 시험 관리</button>
      {mode==="teacher"&&<TeacherPanel pw={pw} setPw={setPw} teacherAuth={teacherAuth} doTeacherAuth={doTeacherAuth} setTeacherAuth={setTeacherAuth} setMode={setMode} exam={exam} allQ={allQ} total={total} allRes={allRes} td={td} setTd={setTd} ico={ico} tC={tC} resetAll={resetAll} uploadExam={uploadExam} css={css} C={C} F={F} />}
    </div>
  );

  /* ══════════ LOGIN ══════════ */
  if(mode==="login") return (
    <div style={{fontFamily:F,background:C.bg,color:C.tx,minHeight:"100vh"}}>
      <style>{css}</style>
      <div style={{background:C.hero,padding:"36px 24px 32px",borderRadius:"0 0 28px 28px",textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:42,marginBottom:8}}>📝</div>
        <div style={{fontSize:22,fontWeight:800,color:C.wh}}>{exam.subject} {exam.grade}</div>
        <div style={{fontSize:15,color:"rgba(255,255,255,0.85)",marginTop:4}}>{exam.unit} ({exam.round})</div>
      </div>
      <div style={{padding:"0 20px"}}>
        <div style={{background:C.card,borderRadius:16,padding:"20px 22px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)",marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:16}}>🙋 학생 정보</div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:13,fontWeight:600,color:C.tx2,display:"block",marginBottom:4}}>번호</label>
            <input value={num} onChange={e=>setNum(e.target.value)} placeholder="예: 15" type="number" style={{fontFamily:F,fontSize:16,padding:"12px 16px",background:C.inp,border:`2px solid ${C.bd}`,borderRadius:10,color:C.tx,width:"100%"}} />
          </div>
          <div style={{marginBottom:20}}>
            <label style={{fontSize:13,fontWeight:600,color:C.tx2,display:"block",marginBottom:4}}>이름</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="이름을 입력하세요" style={{fontFamily:F,fontSize:16,padding:"12px 16px",background:C.inp,border:`2px solid ${C.bd}`,borderRadius:10,color:C.tx,width:"100%"}} />
          </div>
          <button onClick={()=>{if(name.trim()&&num.trim()){setSi(0);setMode("test");}}} disabled={!name.trim()||!num.trim()} style={{fontFamily:F,fontSize:14,fontWeight:600,border:"none",borderRadius:10,cursor:"pointer",padding:"12px 24px",background:name.trim()&&num.trim()?C.acc:"#ccc",color:C.wh,width:"100%",opacity:name.trim()&&num.trim()?1:0.5}}>시험 시작하기</button>
        </div>
        <button onClick={()=>setMode("teacher")} style={{fontFamily:F,fontSize:13,fontWeight:500,border:`1px solid ${C.bd}`,borderRadius:10,cursor:"pointer",padding:"10px 20px",background:"transparent",color:C.tx2,width:"100%"}}>🔐 선생님 채점 결과 보기</button>
      </div>
    </div>
  );

  /* ══════════ TEST ══════════ */
  if(mode==="test"){
    const sec=sections[si];
    if(!sec) return null;
    return (
      <div style={{fontFamily:F,background:C.bg,color:C.tx,minHeight:"100vh",display:"flex",flexDirection:"column"}}>
        <style>{css}</style>
        <div style={{background:C.wh,borderBottom:`1px solid ${C.bd}`,padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10}}>
          <div><div style={{fontSize:13,fontWeight:700,color:C.acc}}>{name} ({num}번)</div><div style={{fontSize:11,color:C.tx2}}>{answered}/{allQ.length}문항</div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:80,height:6,background:C.inp,borderRadius:3}}><div style={{width:`${allQ.length?answered/allQ.length*100:0}%`,height:"100%",background:C.acc,borderRadius:3,transition:"width .3s"}} /></div><span style={{fontSize:12,fontWeight:700,color:C.acc}}>{allQ.length?Math.round(answered/allQ.length*100):0}%</span></div>
        </div>
        <div style={{display:"flex",overflowX:"auto",background:C.wh,borderBottom:`1px solid ${C.bd}`,padding:"0 8px",flexShrink:0}}>
          {sections.map((s,i)=><button key={i} onClick={()=>{setSi(i);sr.current?.scrollTo(0,0);}} style={{fontFamily:F,fontSize:12,fontWeight:i===si?700:400,border:"none",padding:"10px 10px",cursor:"pointer",flexShrink:0,background:"transparent",color:i===si?C.acc:C.tx2,borderBottom:i===si?`2px solid ${C.acc}`:"2px solid transparent"}}>{s.questions[0]?.id}{s.questions.length>1?`-${s.questions[s.questions.length-1].id}`:""}번</button>)}
        </div>
        <div ref={sr} style={{flex:1,overflow:"auto",padding:"16px 16px 100px"}}>
          <div style={{background:"#fef9ef",border:"2px solid #f4e6c8",borderRadius:14,padding:"16px 18px",marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#b8860b",marginBottom:10}}>{sec.title}</div>
            {sec.image && <img src={sec.image} alt="지문 이미지" style={{width:"100%",borderRadius:8,marginBottom:10,border:"1px solid #e8dcc8"}} />}
            <div style={{fontSize:14,color:"#4a3f35",lineHeight:1.85,whiteSpace:"pre-wrap"}}>{sec.passage}</div>
          </div>
          {sec.questions.map(q=>(
            <div key={q.id} style={{background:C.card,borderRadius:14,padding:"18px 20px",marginBottom:12,boxShadow:"0 2px 8px rgba(0,0,0,0.04)",border:`1px solid ${C.bd}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <span style={{background:C.acc,color:C.wh,borderRadius:8,padding:"3px 10px",fontSize:13,fontWeight:800}}>{q.id}</span>
                <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:6,background:typeClr(q.type)+"18",color:typeClr(q.type)}}>{typeTag(q.type)}</span>
                <span style={{fontSize:11,fontWeight:600,color:C.tx2}}>{q.pts}점</span>
              </div>
              <div style={{fontSize:14.5,color:C.tx,marginBottom:14,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{q.text}</div>
              {renderInput(q)}
            </div>
          ))}
        </div>
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.wh,borderTop:`1px solid ${C.bd}`,padding:"10px 16px",display:"flex",gap:8,zIndex:10}}>
          {si>0&&<button onClick={()=>{setSi(si-1);sr.current?.scrollTo(0,0);}} style={{fontFamily:F,fontSize:14,fontWeight:600,border:"none",borderRadius:10,cursor:"pointer",padding:"12px 0",background:C.inp,color:C.tx,flex:1}}>← 이전</button>}
          {si<sections.length-1?
            <button onClick={()=>{setSi(si+1);sr.current?.scrollTo(0,0);}} style={{fontFamily:F,fontSize:14,fontWeight:600,border:"none",borderRadius:10,cursor:"pointer",padding:"12px 0",background:C.acc,color:C.wh,flex:2}}>다음 →</button>:
            <button onClick={doSubmit} style={{fontFamily:F,fontSize:14,fontWeight:600,border:"none",borderRadius:10,cursor:"pointer",padding:"12px 0",background:answered===allQ.length?C.ok:"#e67e22",color:C.wh,flex:2}}>{answered===allQ.length?"✅ 제출하기":`⚠ 제출 (${allQ.length-answered}문항 미응답)`}</button>
          }
        </div>
      </div>
    );
  }

  /* ══════════ SUBMITTING ══════════ */
  if(mode==="submit") return (
    <div style={{fontFamily:F,background:C.bg,color:C.tx,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40}}>
      <style>{css}</style>
      <div style={{fontSize:48,marginBottom:20}}>📝</div>
      <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>채점 중...</div>
      <div style={{fontSize:13,color:C.tx2,marginBottom:24}}>{gmsg}</div>
      <div style={{width:260,height:8,background:C.bd,borderRadius:4,overflow:"hidden",marginBottom:10}}><div style={{width:`${prog}%`,height:"100%",background:C.hero,borderRadius:4,transition:"width .3s"}} /></div>
      <div style={{fontSize:28,fontWeight:800,color:C.acc}}>{prog}%</div>
    </div>
  );

  /* ══════════ RESULT ══════════ */
  if(mode==="result") return (
    <div style={{fontFamily:F,background:C.bg,color:C.tx,minHeight:"100vh"}}>
      <style>{css}</style>
      <div style={{background:C.hero,padding:"32px 24px",borderRadius:"0 0 28px 28px",textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:36,marginBottom:8}}>🎉</div>
        <div style={{fontSize:18,fontWeight:700,color:C.wh}}>시험 완료!</div>
        <div style={{fontSize:48,fontWeight:900,color:C.wh,margin:"8px 0"}}>{totalScore}<span style={{fontSize:20}}>/{total}</span></div>
        <div style={{display:"inline-block",background:"rgba(255,255,255,0.2)",borderRadius:20,padding:"4px 16px",fontSize:14,color:C.wh,fontWeight:600}}>{pctScore}점</div>
      </div>
      <div style={{padding:"0 16px 20px"}}>
        <div style={{background:C.card,borderRadius:16,padding:"20px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>📋 문항별 결과</div>
          {allQ.map(q=>{const r=res[q.id];if(!r)return null;const a=ans[q.id];const as=Array.isArray(a)?a.filter(Boolean).join(", "):(a||"미응답");
            return <div key={q.id} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"8px 0",borderBottom:`1px solid ${C.bd}40`}}>
              <span style={{fontSize:13,fontWeight:700,color:C.tx2,minWidth:28}}>{q.id}번</span><span>{ico(r.st)}</span>
              <div style={{flex:1,fontSize:13}}><div style={{color:C.tx,lineHeight:1.5}}>{as.length>40?as.slice(0,40)+"...":as}</div>{r.reason&&<div style={{fontSize:11,color:C.tx2,marginTop:2}}>💬 {r.reason}</div>}</div>
              <span style={{fontSize:13,fontWeight:700,color:tC(r.st)}}>{r.score}/{q.pts}</span>
            </div>;})}
        </div>
        <button onClick={()=>{setAns({});setRes({});setName("");setNum("");setMode("login");}} style={{fontFamily:F,fontSize:14,fontWeight:600,border:"none",borderRadius:10,cursor:"pointer",padding:"12px",background:C.acc,color:C.wh,width:"100%"}}>처음으로 돌아가기</button>
      </div>
    </div>
  );

  /* ══════════ TEACHER ══════════ */
  if(mode==="teacher"){
    if(!teacherAuth) return (
      <div style={{fontFamily:F,background:C.bg,color:C.tx,minHeight:"100vh",padding:24}}>
        <style>{css}</style>
        <button onClick={()=>setMode("login")} style={{fontFamily:F,fontSize:13,background:"none",border:"none",color:C.tx2,cursor:"pointer",marginBottom:20}}>← 돌아가기</button>
        <div style={{background:C.card,borderRadius:16,padding:"20px 22px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:18,fontWeight:700,marginBottom:16}}>🔐 선생님 인증</div>
          <input value={pw} onChange={e=>setPw(e.target.value)} placeholder="비밀번호" type="password" style={{fontFamily:F,fontSize:16,padding:"12px 16px",background:C.inp,border:`2px solid ${C.bd}`,borderRadius:10,color:C.tx,width:"100%",marginBottom:12}} onKeyDown={e=>{if(e.key==="Enter")doTeacherAuth();}} />
          <button onClick={doTeacherAuth} style={{fontFamily:F,fontSize:14,fontWeight:600,border:"none",borderRadius:10,cursor:"pointer",padding:"12px",background:C.acc,color:C.wh,width:"100%"}}>확인</button>
        </div>
      </div>
    );

    const sorted=[...allRes].sort((a,b)=>Number(a.classNum)-Number(b.classNum));
    const avg=sorted.length?Math.round(sorted.reduce((s,r)=>s+r.pct,0)/sorted.length):0;
    const acc=qId=>{if(!sorted.length)return 0;return Math.round(sorted.filter(r=>r.results[qId]?.st==="ok").length/sorted.length*100);};

    const dlCSV=()=>{
      const h=["번호","이름",...allQ.map(q=>`${q.id}(${q.pts})`),"총점","환산"];
      const rows=sorted.map(r=>{const sc=allQ.map(q=>r.results[q.id]?.score??0);return[r.classNum,r.name,...sc,r.total,r.pct];});
      const csv="\uFEFF"+[h,...rows].map(r=>r.join(",")).join("\n");
      const b=new Blob([csv],{type:"text/csv;charset=utf-8;"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="채점결과.csv";a.click();
    };

    return (
      <div style={{fontFamily:F,background:C.bg,color:C.tx,minHeight:"100vh"}}>
        <style>{css}</style>
        <div style={{background:C.hero,padding:"24px",borderRadius:"0 0 20px 20px",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:14,fontWeight:700,color:C.wh}}>📊 채점 대시보드</div>{exam&&<div style={{fontSize:12,color:"rgba(255,255,255,0.7)",marginTop:2}}>{exam.subject} {exam.grade} {exam.unit}</div>}</div>
            <button onClick={()=>{setTeacherAuth(false);setPw("");setMode("login");}} style={{fontFamily:F,fontSize:12,background:"rgba(255,255,255,0.2)",border:"none",borderRadius:8,color:C.wh,padding:"6px 12px",cursor:"pointer"}}>나가기</button>
          </div>
        </div>
        <div style={{padding:"0 16px 20px"}}>
          {/* 시험 업로드 */}
          <div style={{background:C.card,borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)",marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>📤 시험지 업로드</div>
            <div style={{background:"#f0f4ff",borderRadius:10,padding:"14px",marginBottom:10,border:"2px dashed "+C.acc+"60",opacity:docUploading?0.5:1,pointerEvents:docUploading?"none":"auto"}}>
              <div style={{fontSize:13,fontWeight:600,color:C.acc,marginBottom:6}}>📄 PDF / 이미지 (AI 자동 분석)</div>
              <div style={{fontSize:11,color:C.tx2,marginBottom:8}}>시험지 파일을 올리면 AI가 문제를 자동으로 추출합니다</div>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>{if(e.target.files[0])uploadDocument(e.target.files[0]);e.target.value="";}} style={{fontFamily:F,fontSize:13,color:C.tx2}} />
            </div>
            {docUploading&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#fff8e1",borderRadius:10,marginBottom:10}}>
              <span style={{display:"inline-block",width:18,height:18,border:"3px solid "+C.acc,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite"}} />
              <span style={{fontSize:13,color:C.tx,fontWeight:500}}>AI가 시험 문제를 분석 중입니다... (최대 2분)</span>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>}
            {docError&&<div style={{padding:"10px 14px",background:"#fdecea",borderRadius:10,marginBottom:10,fontSize:13,color:C.ng}}>{docError}</div>}
            <div style={{borderTop:"1px solid "+C.bd,paddingTop:10,opacity:docUploading?0.5:1,pointerEvents:docUploading?"none":"auto"}}>
              <div style={{fontSize:12,color:C.tx2,marginBottom:6}}>또는 JSON 파일 직접 업로드</div>
              <input type="file" accept=".json" onChange={e=>{if(e.target.files[0])uploadExam(e.target.files[0]);e.target.value="";}} style={{fontFamily:F,fontSize:12,color:C.tx2}} />
            </div>
          </div>

          {/* Gemini API 키 설정 */}
          <div style={{background:C.card,borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)",marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>🔑 Gemini API 키 설정</div>
            {apiKeySet&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"8px 12px",background:"#e8f5e9",borderRadius:8}}>
              <span style={{fontSize:13,color:C.ok,fontWeight:600}}>설정됨</span>
              <span style={{fontSize:12,color:C.tx2,fontFamily:"monospace"}}>{apiKeyMasked}</span>
            </div>}
            {!apiKeySet&&<div style={{fontSize:12,color:C.ng,marginBottom:8}}>API 키가 설정되지 않았습니다. PDF/이미지 업로드를 사용하려면 키를 입력하세요.</div>}
            <div style={{display:"flex",gap:8}}>
              <input value={apiKeyInput} onChange={e=>setApiKeyInput(e.target.value)} placeholder={apiKeySet?"새 키로 변경...":"Gemini API 키 입력"} type="password" style={{fontFamily:F,fontSize:13,padding:"8px 12px",background:C.inp,border:`2px solid ${C.bd}`,borderRadius:8,color:C.tx,flex:1}} onKeyDown={e=>{if(e.key==="Enter")saveApiKey();}} />
              <button onClick={saveApiKey} disabled={apiKeySaving||!apiKeyInput.trim()} style={{fontFamily:F,fontSize:12,fontWeight:600,border:"none",borderRadius:8,cursor:"pointer",padding:"8px 16px",background:apiKeyInput.trim()?C.acc:C.bd,color:apiKeyInput.trim()?C.wh:C.tx2,whiteSpace:"nowrap"}}>{apiKeySaving?"저장 중...":"저장"}</button>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
            {[["제출",sorted.length+"명",C.acc],["평균",avg+"점",sorted.length?C.ok:"#ccc"],["문항",allQ.length+"문항","#9b59b6"]].map(([k,v,c])=><div key={k} style={{background:C.card,borderRadius:14,padding:"14px 8px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)",textAlign:"center"}}><div style={{fontSize:11,color:C.tx2}}>{k}</div><div style={{fontSize:22,fontWeight:800,color:c,marginTop:2}}>{v}</div></div>)}
          </div>
          {sorted.length===0?<div style={{background:C.card,borderRadius:14,padding:40,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}><div style={{fontSize:32,marginBottom:8}}>📭</div><div style={{fontSize:14,color:C.tx2}}>아직 제출된 답안이 없습니다</div></div>:<>
            <div style={{background:C.card,borderRadius:14,boxShadow:"0 2px 8px rgba(0,0,0,0.04)",marginBottom:16,overflow:"hidden"}}>
              <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.bd}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:14,fontWeight:700}}>👨‍🎓 학생별 결과</span>
                <div style={{display:"flex",gap:6}}><button onClick={dlCSV} style={{fontFamily:F,fontSize:11,background:C.acc+"15",border:"none",borderRadius:6,color:C.acc,padding:"5px 10px",cursor:"pointer",fontWeight:600}}>📥 CSV</button><button onClick={resetAll} style={{fontFamily:F,fontSize:11,background:C.ng+"15",border:"none",borderRadius:6,color:C.ng,padding:"5px 10px",cursor:"pointer",fontWeight:600}}>🗑️ 초기화</button></div>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:C.inp}}><th style={{padding:"8px",textAlign:"center",color:C.tx2,fontWeight:600}}>번호</th><th style={{padding:"8px",textAlign:"left",color:C.tx2,fontWeight:600}}>이름</th>{allQ.map(q=><th key={q.id} style={{padding:"8px 3px",textAlign:"center",color:C.tx2,fontSize:10,minWidth:26}}>{q.id}</th>)}<th style={{padding:"8px",textAlign:"center",color:C.acc,fontWeight:700}}>점수</th></tr></thead>
                  <tbody>{sorted.map((r,ri)=><tr key={ri} onClick={()=>setTd(td===ri?null:ri)} style={{cursor:"pointer",borderBottom:`1px solid ${C.bd}30`}}><td style={{padding:"8px",textAlign:"center",color:C.tx2}}>{r.classNum}</td><td style={{padding:"8px",fontWeight:600}}>{r.name}</td>{allQ.map(q=><td key={q.id} style={{padding:"4px 2px",textAlign:"center",fontSize:11}}>{ico(r.results[q.id]?.st)}</td>)}<td style={{padding:"8px",textAlign:"center",fontWeight:800,fontSize:14,color:r.pct>=80?C.ok:r.pct>=60?C.pt:C.ng}}>{r.total}<span style={{fontSize:10,color:C.tx2}}>/{total}</span></td></tr>)}</tbody>
                </table>
              </div>
            </div>
            {td!==null&&sorted[td]&&<div style={{background:C.card,borderRadius:14,border:`2px solid ${C.acc}30`,padding:"14px 16px",marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
              <div style={{fontSize:14,fontWeight:700,color:C.acc,marginBottom:10}}>📋 {sorted[td].name} 상세</div>
              {allQ.map(q=>{const r=sorted[td].results[q.id];if(!r)return null;const a=sorted[td].answers[q.id];const as=Array.isArray(a)?a.filter(Boolean).join(", "):(a||"미응답");return <div key={q.id} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"6px 0",borderBottom:`1px solid ${C.bd}30`}}><span style={{fontSize:11,fontWeight:700,color:C.tx2,minWidth:24}}>{q.id}</span><span style={{fontSize:13}}>{ico(r.st)}</span><div style={{flex:1}}><div style={{fontSize:12,color:C.tx,lineHeight:1.5}}>{as}</div>{r.reason&&<div style={{fontSize:11,color:C.tx2,marginTop:1}}>💬 {r.reason}</div>}</div><span style={{fontSize:12,fontWeight:700,color:tC(r.st)}}>{r.score}/{q.pts}</span></div>;})}
            </div>}
            <div style={{background:C.card,borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>📊 문항별 정답률</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>{allQ.map(q=>{const a=acc(q.id);const cl=a>=80?C.ok:a>=50?C.pt:C.ng;return <div key={q.id} style={{background:C.inp,borderRadius:8,padding:"8px 4px",textAlign:"center"}}><div style={{fontSize:10,color:C.tx2}}>{q.id}번</div><div style={{fontSize:15,fontWeight:800,color:cl}}>{a}%</div><div style={{width:"100%",height:3,background:C.bd,borderRadius:2,marginTop:4}}><div style={{width:`${a}%`,height:"100%",background:cl,borderRadius:2}} /></div></div>;})}</div>
            </div>
          </>}
        </div>
      </div>
    );
  }
  return null;
}
