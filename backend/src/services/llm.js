const { llm } = require('../config');
const { HttpError } = require('../errors');

// Calls Gemma (served by Ollama on Colab through ngrok). Returns the raw JSON string
// the model produced; validation happens in interview.js.
async function chatJson({ system, user, schema }) {
  const body = {
    model: llm.model,
    stream: false,
    format: schema,
    options: { temperature: 0.1, num_ctx: llm.numCtx },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };

  let res;
  try {
    res = await fetch(`${llm.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(llm.timeoutMs),
    });
  } catch (err) {
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    throw new HttpError(
      502,
      timedOut ? 'LLM_TIMEOUT' : 'LLM_UNREACHABLE',
      timedOut
        ? 'The model took too long to respond'
        : 'Cannot reach the model. Is the Colab notebook running and LLM_BASE_URL up to date?'
    );
  }

  if (!res.ok) {
    throw new HttpError(502, 'LLM_ERROR', `Model server returned status ${res.status}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new HttpError(502, 'LLM_ERROR', 'Model server returned a non-JSON response');
  }

  const content = data && data.message && data.message.content;
  if (!content) {
    throw new HttpError(502, 'LLM_ERROR', 'Model server returned an empty response');
  }
  return content;
}

module.exports = { chatJson };
