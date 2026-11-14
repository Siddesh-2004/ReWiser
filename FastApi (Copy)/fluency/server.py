import json
import os
import subprocess
import tempfile
from typing import List, Optional

import joblib
import numpy as np
import pandas as pd
import requests
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

from features import load_audio, extract_features

OLLAMA_URL = os.environ.get("OLLAMA_URL", "").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma4:e4b")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "tiny.en")   # try base.en for accents
API_KEY = os.environ.get("API_KEY")                          # optional shared secret
NUM_CTX = 8192
LLM_TIMEOUT = 25                 # contract: respond within 30 s
MAX_CONTENT_CHARS = 16000
MAX_AUDIO_SECONDS = 300
MAX_AUDIO_BYTES = 30 * 1024 * 1024


def check_key(x_api_key: Optional[str] = Header(None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(401, "Invalid API key")


app = FastAPI(title="Re-Wiser AI Server", dependencies=[Depends(check_key)])
fluency_model, fluency_cols = joblib.load("fluency_model.joblib")
_whisper = None


# ------------------------------------------------------------------ LLM helper
def ask_llm(system: str, user: str, schema: dict) -> dict:
    if not OLLAMA_URL:
        raise HTTPException(503, "OLLAMA_URL is not set on the AI server")
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": schema,
        "options": {"temperature": 0.2, "num_ctx": NUM_CTX},
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": user}],
    }
    try:
        r = requests.post(f"{OLLAMA_URL}/api/chat", json=payload,
                          headers={"ngrok-skip-browser-warning": "true"},
                          timeout=LLM_TIMEOUT)
        r.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(503, f"LLM unavailable: {e}")
    try:
        return json.loads(r.json()["message"]["content"])
    except (KeyError, ValueError) as e:
        raise HTTPException(500, f"LLM returned unreadable output: {e}")


# ------------------------------------------------------- /generate-questions
class GenerateRequest(BaseModel):
    title: str
    content: str
    difficulty: int = Field(..., ge=1, le=3)
    count: int = Field(..., ge=1, le=10)


class Question(BaseModel):
    question: str
    context: str
    difficulty: int


class GenerateResponse(BaseModel):
    questions: List[Question]


DIFFICULTY_STYLE = {
    1: ("Recall and explain: what it is, what it does, why it exists. "
        "Stay close to what the notes say."),
    2: ("Compare and distinguish: differences, trade-offs, when to use which. "
        "May go slightly beyond the notes but stay inside the topic."),
    3: ("Apply: realistic scenarios, debugging, design decisions. "
        "May go beyond the notes but stay inside the topic."),
}

GEN_SCHEMA = {
    "type": "object",
    "properties": {"questions": {"type": "array", "items": {
        "type": "object",
        "properties": {"question": {"type": "string"}, "context": {"type": "string"}},
        "required": ["question", "context"]}}},
    "required": ["questions"],
}

GEN_SYSTEM = """You write spoken quiz questions for a student revising their notes.
The student hears ONE question at a time, answers out loud, and has no access to the notes.

Rules for each "question":
- Self-contained. Never say "in the passage", "as mentioned", "this note" or "the code shown".
- Name the topic, e.g. "In React, what does ..." and not "What does it control?".
- One idea per question. No multi-part questions.
- Short enough to say aloud: one or two sentences.
- Answerable by speaking. Do not ask for code to be written or for long lists.
- No duplicates. Cover different parts of the notes where possible.

Rules for each "context" (used later by an evaluator who never sees the notes):
- 2 to 4 sentences stating the key facts a correct answer should contain.
- Self-contained and accurate. Use your own knowledge of the topic, informed by the notes,
  and CORRECT the notes if they are wrong.
- Do not repeat the question and do not address the student.

The notes only tell you which topics to cover; they are not a source of truth.
If the notes are too short or have no teachable content, return fewer questions or an empty list.
Never invent filler questions. Reply with JSON only."""


@app.post("/generate-questions", response_model=GenerateResponse)
def generate_questions(req: GenerateRequest):
    content = req.content.strip()
    if len(content) < 40:                       # nothing teachable: normal success
        return GenerateResponse(questions=[])

    user = (f"Note title: {req.title}\n"
            f"Difficulty {req.difficulty}: {DIFFICULTY_STYLE[req.difficulty]}\n"
            f"Maximum number of questions: {req.count}\n\n"
            f"Notes:\n{content[:MAX_CONTENT_CHARS]}")
    items = ask_llm(GEN_SYSTEM, user, GEN_SCHEMA).get("questions", [])

    out, seen = [], set()
    for q in items:
        text = str(q.get("question", "")).strip()
        ctx = str(q.get("context", "")).strip()
        key = text.lower()
        if not text or not ctx or key in seen:
            continue
        seen.add(key)
        out.append(Question(question=text, context=ctx, difficulty=req.difficulty))
        if len(out) >= req.count:
            break
    return GenerateResponse(questions=out)


# ------------------------------------------------------- shared grading
GRADE_SCHEMA = {
    "type": "object",
    "properties": {"correctnessScore": {"type": "number"},
                   "feedback": {"type": "string"}},
    "required": ["correctnessScore", "feedback"],
}

GRADE_SYSTEM = """You grade a student's answer to a quiz question.
You get the question, a reference "context" and the student's answer.

Score correctnessScore from 0.0 to 1.0:
0.9-1.0 correct and complete | 0.7-0.9 mostly correct, minor gaps |
0.4-0.7 partly correct, important gaps or a mix of right and wrong |
0.1-0.4 mostly wrong with a hint of correct understanding | 0.0 wrong, empty or off-topic.

How to judge:
- Use the context as a reference but judge by MEANING. Different wording, examples or extra
  correct detail are fine. If the student is correct and the context is incomplete or wrong,
  trust correct knowledge over the context.
- The answer may be spoken: ignore grammar, filler words and small mishearings of technical
  terms when the meaning is clearly right. Do not comment on fluency.
- If the difficulty is higher, be somewhat stricter about depth.
- feedback: 2 to 4 sentences, written to the student ("you"): what was right, what was missing
  or wrong, and the correct idea if they missed it. Explain in your own words and never quote
  the context verbatim as "the answer".
Reply with JSON only."""


def grade(question: str, context: str, answer: str, difficulty: int):
    if not answer.strip():
        return 0.0, "We could not find an answer. Try answering again."
    user = (f"Difficulty: {difficulty}\n\nQuestion: {question}\n\n"
            f"Reference context: {context[:MAX_CONTENT_CHARS]}\n\n"
            f"Student answer: {answer}")
    g = ask_llm(GRADE_SYSTEM, user, GRADE_SCHEMA)
    try:
        score = float(g["correctnessScore"])
        feedback = str(g["feedback"]).strip()
    except (KeyError, TypeError, ValueError):
        raise HTTPException(500, "LLM returned an invalid grade")
    return round(min(1.0, max(0.0, score)), 2), feedback


# ------------------------------------------------------- /evaluate/text
class TextEvalRequest(BaseModel):
    question: str
    context: str
    answer: str
    difficulty: int = Field(1, ge=1, le=3)


class TextEvalResponse(BaseModel):
    correctnessScore: float
    feedback: str


@app.post("/evaluate/text", response_model=TextEvalResponse)
def evaluate_text(req: TextEvalRequest):
    score, feedback = grade(req.question, req.context, req.answer, req.difficulty)
    return TextEvalResponse(correctnessScore=score, feedback=feedback)


# ------------------------------------------------------- /evaluate/audio
def get_whisper():
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        try:
            _whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8",
                                    local_files_only=True)
        except Exception:
            _whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    return _whisper


def decode_audio(data: bytes, filename: str):
    """wav/flac/ogg directly; m4a/mp3/webm through ffmpeg. Temp files are deleted."""
    suffix = os.path.splitext(filename or "")[1] or ".wav"
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, "in" + suffix)
        with open(src, "wb") as f:
            f.write(data)
        try:
            return load_audio(src)
        except Exception:
            pass
        dst = os.path.join(d, "out.wav")
        try:
            r = subprocess.run(["ffmpeg", "-y", "-i", src, "-ar", "16000", "-ac", "1", dst],
                               capture_output=True, timeout=60)
        except FileNotFoundError:
            raise HTTPException(500, "ffmpeg is not installed on the AI server")
        except subprocess.TimeoutExpired:
            raise HTTPException(500, "Audio decoding timed out")
        if r.returncode != 0:
            raise HTTPException(422, "Could not decode the audio file")
        return load_audio(dst)


def fluency_score(feats: dict, text: str) -> float:
    words = len(text.split())
    feats = dict(feats)
    feats["wps"] = words / feats["duration"]
    feats["run_words"] = words / feats["n_segments"]
    X = pd.DataFrame([[feats[c] for c in fluency_cols]], columns=fluency_cols)
    pred = float(fluency_model.predict(X)[0])          # training labels span about 5-10
    return round(float(np.clip((pred - 5) / 5, 0.0, 1.0)), 2)


class AudioEvalResponse(BaseModel):
    transcript: str
    fluencyScore: float
    correctnessScore: float
    feedback: str


@app.post("/evaluate/audio", response_model=AudioEvalResponse)
def evaluate_audio(
    audio: UploadFile = File(...),
    question: str = Form(...),
    context: str = Form(...),
    difficulty: int = Form(1, ge=1, le=3),
):
    data = audio.file.read()
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Audio file too large")
    wav = decode_audio(data, audio.filename)
    if len(wav) / 16000 > MAX_AUDIO_SECONDS:
        raise HTTPException(413, "Audio longer than 5 minutes")

    no_speech = AudioEvalResponse(
        transcript="", fluencyScore=0.0, correctnessScore=0.0,
        feedback="We could not hear an answer. Try recording again.")

    feats = extract_features(wav)                      # VAD first: skip Whisper on silence
    if feats is None:
        return no_speech
    segments, _ = get_whisper().transcribe(wav.numpy(), language="en")
    text = " ".join(s.text.strip() for s in segments).strip()
    if not text:
        return no_speech

    score, feedback = grade(question, context, text, difficulty)
    return AudioEvalResponse(transcript=text, fluencyScore=fluency_score(feats, text),
                             correctnessScore=score, feedback=feedback)


@app.get("/health")
def health():
    return {"ok": True, "llm_configured": bool(OLLAMA_URL), "model": OLLAMA_MODEL}
