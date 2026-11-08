export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

// Mirrors the limits in the backend (config.js / zod schemas).
export const LIMITS = { notes: 8000, description: 1000, transcript: 4000 };
export const WEIGHTS = { correctness: 0.5, completeness: 0.3, fluency: 0.2 };
export const MAX_ANSWER_SECONDS = 180;
