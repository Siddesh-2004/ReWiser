// src/services/quiz.service.ts
import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '../db';
import { answers, notionItems, questions, quizzes, revisionPlans } from '../db/schemas';
import { addDays, getRound } from '../config/rounds';
import { ApiError } from '../utils/apiErrors';
import { evaluateAudio, evaluateText, generateQuestions } from './ai.service';
import { getNoteContent } from './content.service';

const QUESTIONS_PER_QUIZ = 5;

const clamp = (n: number) => Math.min(1, Math.max(0, Number(n) || 0));
const average = (nums: number[]) =>
  nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

// The quiz as the app sees it. `context` is never selected, so it can't leak.
async function getQuizView(quizId: string) {
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);

  const rows = await db
    .select({
      id: questions.id,
      position: questions.position,
      question: questions.question,
      mode: answers.mode,
      transcript: answers.transcript,
      correctnessScore: answers.correctnessScore,
      fluencyScore: answers.fluencyScore,
      feedback: answers.feedback,
    })
    .from(questions)
    .leftJoin(answers, eq(answers.questionId, questions.id))
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.position));

  return {
    quizId: quiz.id,
    round: quiz.round,
    difficulty: quiz.difficulty,
    status: quiz.status,
    questions: rows.map((r) => ({
      id: r.id,
      position: r.position,
      question: r.question,
      answer: r.mode
        ? {
            mode: r.mode,
            transcript: r.transcript,
            correctnessScore: r.correctnessScore,
            fluencyScore: r.fluencyScore,
            feedback: r.feedback,
          }
        : null,
    })),
  };
}

// Loads a quiz and its plan, only if it belongs to this student
async function loadOwnedQuiz(userId: string, quizId: string) {
  const [row] = await db
    .select({ quiz: quizzes, plan: revisionPlans })
    .from(quizzes)
    .innerJoin(revisionPlans, eq(quizzes.planId, revisionPlans.id))
    .where(and(eq(quizzes.id, quizId), eq(revisionPlans.userId, userId)))
    .limit(1);
  if (!row) throw new ApiError(404, 'Quiz not found');
  return row;
}

async function ensureQuiz(userId: string, itemId: string) {
  const [row] = await db
    .select({ plan: revisionPlans, editedAt: notionItems.lastEditedTime })
    .from(revisionPlans)
    .innerJoin(notionItems, eq(revisionPlans.itemId, notionItems.id))
    .where(
      and(
        eq(revisionPlans.userId, userId),
        eq(revisionPlans.itemId, itemId),
        eq(revisionPlans.isActive, true),
      ),
    )
    .limit(1);

  if (!row) throw new ApiError(404, 'This item is not selected for revision');
  const { plan } = row;

  // One quiz per plan and round: if it exists, resume it instead of generating again
  const [existing] = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(eq(quizzes.planId, plan.id), eq(quizzes.round, plan.currentRound)))
    .limit(1);
  if (existing) return getQuizView(existing.id);

  const { difficulty } = getRound(plan.currentRound);
  const { title, content } = await getNoteContent(userId, itemId);

  const generated = content.trim()
    ? await generateQuestions({ title, content, difficulty, count: QUESTIONS_PER_QUIZ })
    : [];
  const usable = generated.filter((q) => q.question?.trim()).slice(0, QUESTIONS_PER_QUIZ);
  if (!usable.length) throw new ApiError(422, 'Not enough content in this note to make a quiz');

  // Quiz and questions are saved together, or not at all
  const quizId = await db.transaction(async (tx) => {
    const [quiz] = await tx
      .insert(quizzes)
      .values({
        planId: plan.id,
        round: plan.currentRound,
        difficulty,
        sourceEditedTime: row.editedAt,
      })
      .returning({ id: quizzes.id });

    await tx.insert(questions).values(
      usable.map((q, i) => ({
        quizId: quiz.id,
        position: i + 1,
        question: q.question.trim(),
        context: q.context ?? '',
      })),
    );
    return quiz.id;
  });

  return getQuizView(quizId);
}

export function prepareQuiz(userId: string, itemId: string) {
  return ensureQuiz(userId, itemId);
}

export function startQuiz(userId: string, itemId: string) {
  return ensureQuiz(userId, itemId);
}

export async function getQuiz(userId: string, quizId: string) {
  await loadOwnedQuiz(userId, quizId);
  return getQuizView(quizId);
}

type AnswerInput = { text: string } | { audio: { buffer: Buffer; mimeType: string } };

export async function submitAnswer(userId: string, questionId: string, input: AnswerInput) {
  const [row] = await db
    .select({ question: questions, quiz: quizzes })
    .from(questions)
    .innerJoin(quizzes, eq(questions.quizId, quizzes.id))
    .innerJoin(revisionPlans, eq(quizzes.planId, revisionPlans.id))
    .where(and(eq(questions.id, questionId), eq(revisionPlans.userId, userId)))
    .limit(1);

  if (!row) throw new ApiError(404, 'Question not found');
  if (row.quiz.status === 'completed') throw new ApiError(409, 'This quiz is already completed');

  const [already] = await db
    .select({ id: answers.id })
    .from(answers)
    .where(eq(answers.questionId, questionId))
    .limit(1);
  if (already) throw new ApiError(409, 'This question is already answered');

  const base = {
    question: row.question.question,
    context: row.question.context,
    difficulty: row.quiz.difficulty,
  };

  // The slow part (10-16s): ask the AI server to judge the answer
  const result =
    'audio' in input
      ? await evaluateAudio({ ...base, audio: input.audio.buffer, mimeType: input.audio.mimeType }).then(
          (r) => ({
            mode: 'audio' as const,
            transcript: r.transcript,
            correctnessScore: clamp(r.correctnessScore),
            fluencyScore: clamp(r.fluencyScore),
            feedback: r.feedback,
          }),
        )
      : await evaluateText({ ...base, answer: input.text }).then((r) => ({
          mode: 'text' as const,
          transcript: input.text,
          correctnessScore: clamp(r.correctnessScore),
          fluencyScore: null,
          feedback: r.feedback,
        }));

  await db.insert(answers).values({ questionId, ...result });

  if (row.quiz.status === 'pending') {
    await db
      .update(quizzes)
      .set({ status: 'in_progress' })
      .where(and(eq(quizzes.id, row.quiz.id), eq(quizzes.status, 'pending')));
  }

  return result;
}

export async function completeQuiz(userId: string, quizId: string) {
  const { quiz, plan } = await loadOwnedQuiz(userId, quizId);

  const rows = await db
    .select({ correctness: answers.correctnessScore, fluency: answers.fluencyScore })
    .from(questions)
    .leftJoin(answers, eq(answers.questionId, questions.id))
    .where(eq(questions.quizId, quizId));

  if (quiz.status !== 'completed') {
    if (rows.some((r) => r.correctness === null)) {
      throw new ApiError(400, 'Answer every question before finishing');
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      // The guard makes this safe to call twice: only the first call advances the round
      const done = await tx
        .update(quizzes)
        .set({ status: 'completed', completedAt: now })
        .where(and(eq(quizzes.id, quizId), ne(quizzes.status, 'completed')))
        .returning({ id: quizzes.id });
      if (!done.length) return;

      const nextRound = plan.currentRound + 1;
      await tx
        .update(revisionPlans)
        .set({
          currentRound: nextRound,
          dueAt: addDays(now, getRound(nextRound).afterDays),
          updatedAt: now,
        })
        .where(eq(revisionPlans.id, plan.id));
    });
  }

  const [updated] = await db
    .select({ currentRound: revisionPlans.currentRound, dueAt: revisionPlans.dueAt })
    .from(revisionPlans)
    .where(eq(revisionPlans.id, plan.id))
    .limit(1);

  return {
    status: 'completed' as const,
    nextRound: updated.currentRound,
    nextDueAt: updated.dueAt,
    averageCorrectness: average(rows.map((r) => r.correctness).filter((n): n is number => n !== null)),
    averageFluency: average(rows.map((r) => r.fluency).filter((n): n is number => n !== null)),
  };
}