// src/services/ai.service.ts
// The only file that talks to the FastAPI server
import { requireEnv } from '../lib/env';
import { ApiError } from '../utils/apiErrors';

export type GeneratedQuestion = { question: string; context: string; difficulty: number };
export type TextEvaluation = { correctnessScore: number; feedback: string };
export type AudioEvaluation = TextEvaluation & { transcript: string; fluencyScore: number };

const TIMEOUT_MS = 90_000;

async function call<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${requireEnv('AI_SERVER_URL')}${path}`, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(502, 'AI server is unreachable');
  }
  if (!res.ok) throw new ApiError(502, `AI server failed (${res.status})`);
  return (await res.json()) as T;
}

function postJson<T>(path: string, body: unknown) {
  return call<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function generateQuestions(input: {
  title: string;
  content: string;
  difficulty: number;
  count: number;
}): Promise<GeneratedQuestion[]> {
  const data = await postJson<{ questions: GeneratedQuestion[] }>('/generate-questions', input);
  return data.questions;
}

export function evaluateText(input: {
  question: string;
  context: string;
  answer: string;
  difficulty: number;
}) {
  return postJson<TextEvaluation>('/evaluate/text', input);
}

export function evaluateAudio(input: {
  audio: Buffer;
  mimeType: string;
  question: string;
  context: string;
  difficulty: number;
}) {
  // multipart/form-data: the audio goes as a file, the rest as plain fields
  const form = new FormData();
  form.append('audio', new Blob([new Uint8Array(input.audio)], { type: input.mimeType }), 'answer');
  form.append('question', input.question);
  form.append('context', input.context);
  form.append('difficulty', String(input.difficulty));
  return call<AudioEvaluation>('/evaluate/audio', { method: 'POST', body: form });
}