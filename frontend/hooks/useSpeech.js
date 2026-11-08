import { useEffect, useRef, useState } from 'react';

// expo-speech-recognition needs native code, so it does not exist inside Expo Go.
// Requiring it in a try/catch lets the app still run there (with typed answers).
let Speech = null;
try {
  Speech = require('expo-speech-recognition');
} catch {}

export function useSpeech({ onEnd } = {}) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const finals = useRef(''); // finished segments
  const latest = useRef(''); // finals + the segment currently being spoken
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const module_ = Speech && Speech.ExpoSpeechRecognitionModule;

  useEffect(() => {
    if (!module_) return undefined;
    const subs = [
      module_.addListener('result', (e) => {
        const t = (e.results && e.results[0] && e.results[0].transcript) || '';
        if (e.isFinal) {
          finals.current = `${finals.current} ${t}`.trim();
          latest.current = finals.current;
        } else {
          latest.current = `${finals.current} ${t}`.trim();
        }
        setText(latest.current);
      }),
      module_.addListener('error', (e) => setError(e.message || e.error || 'Speech recognition failed')),
      // 'end' fires after stop(), after an error, or if the OS cuts us off: one place to leave "recording".
      module_.addListener('end', () => onEndRef.current && onEndRef.current(latest.current)),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      try {
        module_.abort();
      } catch {}
    };
  }, [module_]);

  async function start() {
    finals.current = '';
    latest.current = '';
    setText('');
    setError(null);
    const perm = await module_.requestPermissionsAsync();
    if (!perm.granted) {
      setError('Microphone / speech recognition permission was denied.');
      return false;
    }
    module_.start({ lang: 'en-US', interimResults: true, continuous: true });
    return true;
  }

  return { available: !!module_, text, error, start, stop: () => module_ && module_.stop() };
}
