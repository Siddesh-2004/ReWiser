import { useRef, useState } from "react";

const API = "/api";

async function call(path, options) {
  const res = await fetch(API + path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

export default function App() {
  // ---- notes (left)
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [count, setCount] = useState(3);
  const [questions, setQuestions] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  // ---- interview (right)
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState("text");
  const [answer, setAnswer] = useState("");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const recorder = useRef(null);

  const q = questions[index];
  const finished = questions.length > 0 && index >= questions.length;

  const loadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setContent(await file.text());
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  const generate = async () => {
    setGenerating(true);
    setGenError("");
    try {
      const data = await call("/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, difficulty, count }),
      });
      if (!data.questions.length) throw new Error("Notes too short to generate questions.");
      setQuestions(data.questions);
      resetAnswer();
      setIndex(0);
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const resetAnswer = () => {
    setAnswer("");
    setAudioBlob(null);
    setResult(null);
    setError("");
  };

  const toggleRecord = async () => {
    if (recording) {
      recorder.current.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setAudioBlob(new Blob(chunks, { type: rec.mimeType }));
        setRecording(false);
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setError("Microphone access denied.");
    }
  };

  const submit = async () => {
    setEvaluating(true);
    setError("");
    try {
      if (mode === "text") {
        setResult(
          await call("/evaluate/text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: q.question,
              context: q.context,
              answer,
              difficulty: q.difficulty,
            }),
          })
        );
      } else {
        const form = new FormData();
        form.append("audio", audioBlob, "answer.webm");
        form.append("question", q.question);
        form.append("context", q.context);
        form.append("difficulty", q.difficulty);
        setResult(await call("/evaluate/audio", { method: "POST", body: form }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setEvaluating(false);
    }
  };

  const next = () => {
    resetAnswer();
    setIndex(index + 1);
  };

  const canSubmit = mode === "text" ? answer.trim() : audioBlob;

  return (
    <div className="app">
      {/* LEFT: notes */}
      <section className="panel">
        <h2>Notes</h2>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          placeholder="Paste your notes or upload a file"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <input type="file" accept=".txt,.md" onChange={loadFile} />
        <div className="row">
          <label>
            Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(+e.target.value)}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label>
            Questions
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Math.min(10, Math.max(1, +e.target.value || 1)))}
            />
          </label>
        </div>
        <button onClick={generate} disabled={generating || !title.trim() || !content.trim()}>
          {generating ? "Generating..." : "Start Interview"}
        </button>
        {genError && <p className="error">{genError}</p>}
      </section>

      {/* RIGHT: interview */}
      <section className="panel">
        <h2>Interview</h2>
        {!questions.length && <p className="muted">Upload notes and start the interview.</p>}

        {finished && <p className="question">Interview complete.</p>}

        {q && (
          <>
            <p className="muted">
              Question {index + 1} / {questions.length}
            </p>
            <p className="question">{q.question}</p>

            {!result && (
              <>
                <div className="row tabs">
                  <button className={mode === "text" ? "" : "ghost"} onClick={() => setMode("text")}>
                    Text
                  </button>
                  <button className={mode === "voice" ? "" : "ghost"} onClick={() => setMode("voice")}>
                    Voice
                  </button>
                </div>

                {mode === "text" ? (
                  <textarea
                    placeholder="Type your answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                ) : (
                  <div className="voice">
                    <button className={recording ? "rec" : "ghost"} onClick={toggleRecord}>
                      {recording ? "Stop" : audioBlob ? "Record again" : "Record"}
                    </button>
                    {audioBlob && !recording && <audio controls src={URL.createObjectURL(audioBlob)} />}
                  </div>
                )}

                <button onClick={submit} disabled={evaluating || recording || !canSubmit}>
                  {evaluating ? "Evaluating..." : "Submit"}
                </button>
              </>
            )}

            {result && (
              <div className="result">
                {result.transcript !== undefined && (
                  <p>
                    <span className="muted">Transcript</span>
                    <br />
                    {result.transcript || "-"}
                  </p>
                )}
                <p className="scores">
                  Correctness: {Math.round(result.correctnessScore * 100)}%
                  {result.fluencyScore !== undefined &&
                    ` · Fluency: ${Math.round(result.fluencyScore * 100)}%`}
                </p>
                <p>{result.feedback}</p>
                <button onClick={next}>{index + 1 < questions.length ? "Next" : "Finish"}</button>
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </>
        )}
      </section>
    </div>
  );
}
