# Re-Wiser AI Server: API Contract

This document defines the HTTP API of the **FastAPI AI server** for Re-Wiser. It is written for the person (and coding agents) building that server. Read it fully before writing code: it explains what the product is, why each endpoint exists, and what every field means.

## 1. What Re-Wiser is

Students (mostly developers and CS students) keep notes in Notion and never look at them again, so they forget. Re-Wiser lets a student pick notes to revise, then quizzes them on those notes **by voice** at growing intervals (spaced repetition), with rising difficulty.

Round 1 asks easy recall questions. Later rounds ask harder ones. The student answers out loud (or types), and the AI server tells them how correct and how fluent the answer was.

## 2. Who does what

| Part | Responsibility |
|---|---|
| Mobile app (Expo, React Native) | Shows questions, records the student's voice, shows scores and feedback |
| Main backend (Node, Express, Postgres) | Login, Notion sync, scheduling, **stores all data**, calls this server |
| **AI server (this project, FastAPI)** | Generates questions and evaluates answers. Nothing else |

The app never talks to this server. Only the main backend does.

## 3. Design principles (please follow these)

1. **Stateless.** No database, no sessions, no memory between calls. Every request contains everything needed to answer it. The main backend owns all storage and all ids.
2. **No ids in this API.** This server does not create, return or expect any id. The main backend tracks questions by its own ids and by position.
3. **The notes are a topic guide, not a source of truth.** The student's notes tell us *what topics to cover*. Correctness is judged using the model's own knowledge. Notes may contain mistakes or be incomplete.
4. **Questions are spoken aloud.** The student hears or reads one question at a time with no access to their notes. See section 5.
5. **Scores are separate numbers.** Fluency and correctness are never combined into one score.

## 4. Flow

```
Student opens a due note
        |
        v
Backend fetches note text from Notion
        |
        v
Backend --POST /generate-questions--> AI server
Backend <-- questions (+ context each) --
Backend saves question, context, difficulty in its own DB
        |
        v
App shows question 1, student answers (voice or text)
        |
        v
Backend --POST /evaluate/audio  (or /evaluate/text)--> AI server
   sends: question + context (+ difficulty) + audio or answer
Backend <-- scores + feedback --
Backend saves the result, app shows it
```

## 5. Endpoint 1: `POST /generate-questions`

Turns a note into a set of quiz questions. Called once per quiz, when the student opens it.

### Request (JSON)

| Field | Type | Required | Meaning |
|---|---|---|---|
| `title` | string | yes | The note's title. Gives the topic area (for example "React useEffect" or "Postgres indexes"). Can be `"Untitled"` |
| `content` | string | yes | The note's text, flattened to plain text. Headings and bullets are kept as lines. Can be long. Never contains images or files |
| `difficulty` | integer, 1 to 3 | yes | How hard the questions should be. See the table below |
| `count` | integer, 1 to 10 | yes | The **maximum** number of questions wanted |

### Difficulty levels

| Value | Style | Example (topic: React `useEffect`) |
|---|---|---|
| 1 | **Recall and explain.** What is it, what does it do, why does it exist | "What does the dependency array in useEffect control?" |
| 2 | **Compare and distinguish.** Differences, trade-offs, when to use which | "How does useEffect differ from useLayoutEffect, and when would you pick each?" |
| 3 | **Apply.** Scenarios, debugging, design decisions | "A component re-fetches data in an infinite loop. What are the likely causes in its useEffect, and how do you fix them?" |

Higher difficulties **may go beyond what is written in the note**, but must stay inside the note's topic. Difficulty 1 should stay close to the note.

### Response (JSON, HTTP 200)

```json
{
  "questions": [
    {
      "question": "What does the dependency array in useEffect control?",
      "context": "The dependency array tells React when to re-run the effect. The effect runs after the first render and again only when a listed value changes. An empty array means it runs once on mount. Omitting the array means it runs after every render.",
      "difficulty": 1
    }
  ]
}
```

| Field | Type | Meaning |
|---|---|---|
| `questions` | array | Ordered list. The order is the order the student will be asked. May be **shorter than `count`**, or **empty** |
| `questions[].question` | string | The question text, shown and read to the student. See rules below |
| `questions[].context` | string | A short reference for the evaluator. **Never shown to the student.** See rules below |
| `questions[].difficulty` | integer, 1 to 3 | The difficulty of this question. Normally equals the requested `difficulty` |

### Rules for `question`

- **Self-contained.** It is spoken aloud and the student has no text in front of them. Never write "in the passage above", "as mentioned", "this note", or "the code shown".
- **Names its topic.** Say "In React, what does..." rather than "What does it control?".
- **One idea per question.** No multi-part questions ("What is X, and how does Y relate, and why Z?").
- **Short enough to say out loud** (ideally one or two sentences).
- **Answerable by speaking.** Do not ask for code to be written or for long lists.
- **No duplicates**, and cover different parts of the note where possible.

### Rules for `context`

The `context` is what the **evaluator** will later use to judge the student's answer, since the evaluator will never see the note.

- 2 to 4 sentences stating the key facts a correct answer should contain.
- Self-contained and accurate. Write it from the model's knowledge of the topic, informed by the note, and **correct the note if it is wrong**.
- It is guidance, not a script. The evaluator must accept correct answers that are phrased differently or go beyond it.
- Do not include the question text again, and do not address the student.

### When there is not enough content

If the note is too short, empty, or has no teachable content, return fewer questions, or `{ "questions": [] }`. Do **not** invent filler questions. The main backend will tell the student there is not enough content. This is a normal success response, not an error.

## 6. Endpoint 2: `POST /evaluate/text`

Judges a **typed** answer.

### Request (JSON)

| Field | Type | Required | Meaning |
|---|---|---|---|
| `question` | string | yes | The exact question that was asked |
| `context` | string | yes | The `context` string returned earlier by `/generate-questions` for this question, passed back unchanged |
| `answer` | string | yes | The student's typed answer. May be empty or very short |
| `difficulty` | integer, 1 to 3 | no | The question's difficulty. If given, feedback may be stricter for harder questions. Default 1 |

### Response (JSON, HTTP 200)

```json
{
  "correctnessScore": 0.75,
  "feedback": "Good: you correctly said the effect re-runs when a dependency changes. Missing: an empty array runs it only once, on mount."
}
```

| Field | Type | Meaning |
|---|---|---|
| `correctnessScore` | float, 0.0 to 1.0 | How correct and complete the answer is. See guide below |
| `feedback` | string | Short, direct feedback for the student (2 to 4 sentences): what was right, what was missing or wrong, and the correct idea if they missed it. Written to the student ("you"). No fluency comments here |

## 7. Endpoint 3: `POST /evaluate/audio`

Judges a **spoken** answer. The student's voice is evaluated for both correctness and fluency.

### Request (`multipart/form-data`)

| Field | Type | Required | Meaning |
|---|---|---|---|
| `audio` | file | yes | The student's recorded answer |
| `question` | string (form field) | yes | The exact question that was asked |
| `context` | string (form field) | yes | The stored `context` for this question, passed back unchanged |
| `difficulty` | integer (form field) | no | Same as in `/evaluate/text` |

Audio notes:

- The app records on a phone, so expect compressed speech, usually `m4a` (AAC). Please also accept `mp3`, `wav`, `webm`, `ogg`. **Confirm the formats your pipeline supports and tell the main-backend developer.**
- Typical length is 10 to 90 seconds. Reject anything over 5 minutes with HTTP 413.
- The audio is sent raw because the fluency model needs the real signal (pace, pauses, hesitation), not just a transcript.
- **Do not store the audio.** Process it and discard it.

### Response (JSON, HTTP 200)

```json
{
  "transcript": "The dependency array tells React when to run the effect again, so it only re-runs if one of those values changes.",
  "fluencyScore": 0.82,
  "correctnessScore": 0.7,
  "feedback": "You explained re-running on changes clearly. You did not mention that an empty array runs the effect once on mount."
}
```

| Field | Type | Meaning |
|---|---|---|
| `transcript` | string | Speech-to-text of what the student said. The backend saves it and shows it in the app. Empty string if no speech was detected |
| `fluencyScore` | float, 0.0 to 1.0 | How smoothly the student spoke: pace, pauses, hesitations, filler words. **Independent of correctness.** A correct but halting answer scores high on correctness and low on fluency |
| `correctnessScore` | float, 0.0 to 1.0 | Same meaning as in `/evaluate/text`, judged on the transcript |
| `feedback` | string | Same as `/evaluate/text`. Content feedback only. Fluency is shown to the student as its own number, so do not repeat it here unless something specific stands out |

If no speech is detected, return `transcript: ""`, `correctnessScore: 0.0`, and a `feedback` such as "We could not hear an answer. Try recording again." Still HTTP 200.

## 8. Scoring guide (`correctnessScore`)

Both evaluate endpoints should aim for the same calibration:

| Range | Meaning |
|---|---|
| 0.9 to 1.0 | Correct and complete |
| 0.7 to 0.9 | Mostly correct, minor gaps |
| 0.4 to 0.7 | Partly correct, important gaps or a mix of right and wrong |
| 0.1 to 0.4 | Mostly wrong, with a hint of correct understanding |
| 0.0 | Wrong, empty, or off-topic |

How to judge:

- Use `context` as the reference, but judge by **meaning**. Different wording, examples, or extra correct detail are fine.
- If the student is correct and `context` is incomplete or wrong, trust correct knowledge over `context`.
- Spoken answers are informal and may have transcription errors. Do not penalise grammar, filler words, or small mishearings of technical terms when the meaning is clearly right. Fluency is scored separately.
- Never reveal or quote `context` verbatim as "the answer". Explain in your own words in `feedback`.

## 9. Errors and limits

- Use standard HTTP status codes: `422` for an invalid request, `413` for audio that is too large or long, `500` for internal failures, `503` if a model is temporarily unavailable.
- Error bodies can use FastAPI's default `{ "detail": ... }` shape. The main backend treats any non-200 as a failure and will retry or show a generic error.
- A successful but empty result (no questions, no speech) is **200**, not an error.
- **Respond within 30 seconds.** The app waits for the backend, which waits for you. If generation can take longer, tell the main-backend developer.
- Keep the server **stateless and safe to retry**: calling the same endpoint twice with the same input must not cause side effects.

## 9b. Authentication

Not defined for v1 (local development). Before deployment, add a shared secret header (for example `X-API-Key`) checked on every endpoint. To be agreed.

## 10. Quick reference

| Endpoint | Request | Response |
|---|---|---|
| `POST /generate-questions` | `title`, `content`, `difficulty`, `count` | `questions: [{ question, context, difficulty }]` |
| `POST /evaluate/text` | `question`, `context`, `answer`, `difficulty?` | `correctnessScore`, `feedback` |
| `POST /evaluate/audio` | `audio` (file), `question`, `context`, `difficulty?` | `transcript`, `fluencyScore`, `correctnessScore`, `feedback` |

## 11. Open items for the AI-server developer to confirm

1. Which audio formats your speech and fluency pipeline accepts.
2. Typical response times for each endpoint (so timeouts can be set).
3. Maximum `content` length you can handle in one call. Very large notes may later be split into sections by the main backend.
4. How `fluencyScore` is computed (which signals), so the app can describe it honestly to students.
