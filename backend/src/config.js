require('dotenv').config();

for (const key of ['MONGO_URI', 'JWT_SECRET', 'LLM_BASE_URL']) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var ${key}. Copy .env.example to .env and fill it in.`);
  }
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  llm: {
    baseUrl: process.env.LLM_BASE_URL.replace(/\/+$/, ''),
    model: process.env.LLM_MODEL || 'gemma4:e4b',
    numCtx: Number(process.env.LLM_NUM_CTX) || 8192,
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 120000,
  },
  limits: {
    notesChars: 8000,
    transcriptChars: 4000,
  },
  // Overall score weights (must add up to 1)
  weights: { correctness: 0.5, completeness: 0.3, fluency: 0.2 },
};
