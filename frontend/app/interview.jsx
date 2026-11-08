import React, { useEffect, useRef, useState } from 'react';
import { View, Alert, Pressable } from 'react-native';
import { useRouter, useNavigation, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Screen, Header, T, Field, Button, Banner, Loading } from '../components/ui';
import { api } from '../lib/api';
import { useSpeech } from '../hooks/useSpeech';
import { colors } from '../lib/theme';
import { LIMITS, MAX_ANSWER_SECONDS } from '../lib/config';
import { pretty } from '../lib/utils';

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/*
 * phase: starting -> idle -> recording -> review -> evaluating -> idle (next question) ... -> /summary
 *                                                                   \-> error (retry)
 * Two ways in: a new session (topicId, difficulty, questionCount) or resuming one (sessionId).
 * Route params always arrive as strings.
 */
export default function Interview() {
  const router = useRouter();
  const navigation = useNavigation(); // the underlying React Navigation object, needed for 'beforeRemove'
  const params = useLocalSearchParams();
  const { topicId, topicTitle, difficulty, sessionId: resumeId } = params;
  const questionCount = params.questionCount ? Number(params.questionCount) : 0;

  const [phase, setPhase] = useState('starting');
  const [q, setQ] = useState(null); // { index, question: { text, type } }
  const [total, setTotal] = useState(questionCount);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [seconds, setSeconds] = useState(0);

  // Refs hold values that listeners/callbacks need to read at call time without going stale.
  const sessionIdRef = useRef(resumeId || null);
  const leaveOk = useRef(false);
  const retryRef = useRef(null);
  const startedRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // The recogniser tells us when it has really stopped ('end'); that is when we move to review.
  const speech = useSpeech({
    onEnd: (text) => {
      if (phaseRef.current === 'recording') {
        setTranscript(text);
        setPhase('review');
      }
    },
  });

  // ---------- server calls ----------

  function fail(e, retry) {
    retryRef.current = retry;
    setError(e.message);
    setPhase('error');
  }

  // The summary screen loads the finished session itself, so we only pass its id.
  function goToSummary() {
    leaveOk.current = true;
    router.replace({ pathname: '/summary', params: { sessionId: sessionIdRef.current, topicTitle } });
  }

  // Ask the server where the session is. Used to resume, and to recover if a submit's response got lost.
  async function syncFromServer() {
    const { session } = await api.sessions.get(sessionIdRef.current);
    if (session.status !== 'in_progress') return goToSummary();
    if (!session.current) throw new Error('No active question in this session.');
    setTotal(session.questionCount);
    setQ(session.current);
    setTranscript('');
    setPhase('idle');
  }

  async function begin() {
    setPhase('starting');
    setError(null);
    try {
      if (sessionIdRef.current) return await syncFromServer();
      const res = await api.sessions.start({ topicId, difficulty, questionCount });
      sessionIdRef.current = res.sessionId;
      setQ({ index: res.index, question: res.question });
      setPhase('idle');
    } catch (e) {
      fail(e, begin);
    }
  }

  async function submit(text) {
    setPhase('evaluating');
    setError(null);
    try {
      const res = await api.sessions.answer(sessionIdRef.current, { transcript: text });
      if (res.completed) return goToSummary();
      setQ({ index: res.index, question: res.question });
      setTranscript('');
      setPhase('idle');
    } catch (e) {
      if (e.code === 'ALREADY_ANSWERED') {
        // The first attempt probably went through but we never got the reply. Resync instead of failing.
        try {
          return await syncFromServer();
        } catch (e2) {
          return fail(e2, () => submit(text));
        }
      }
      fail(e, () => submit(text));
    }
  }

  function endSession(onDone) {
    if (!sessionIdRef.current) {
      leaveOk.current = true;
      return onDone();
    }
    api.sessions
      .end(sessionIdRef.current)
      .then(() => {
        leaveOk.current = true;
        onDone();
      })
      .catch((e) => {
        if (e.code === 'SESSION_NOT_ACTIVE') {
          leaveOk.current = true;
          onDone();
        } else {
          Alert.alert('Could not end session', e.message);
        }
      });
  }

  function confirmEnd(onDone) {
    if (!sessionIdRef.current) return endSession(onDone);
    Alert.alert('End interview?', 'Answers you have already given are saved and scored.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End session', style: 'destructive', onPress: () => endSession(onDone) },
    ]);
  }

  // After "End": show the summary, or just leave if the session never got created.
  function endAndShowSummary() {
    confirmEnd(() => {
      if (sessionIdRef.current) router.replace({ pathname: '/summary', params: { sessionId: sessionIdRef.current, topicTitle } });
      else router.back();
    });
  }

  // ---------- effects ----------

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    begin();
  }, []);

  // Intercepts every way of leaving (header X, Android back button) and asks first.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (leaveOk.current) return;
        e.preventDefault();
        if (phaseRef.current === 'evaluating') {
          Alert.alert('One moment', 'Your answer is being evaluated.');
          return;
        }
        confirmEnd(() => navigation.dispatch(e.data.action));
      }),
    [navigation]
  );

  // Recording timer, with an automatic stop at the limit.
  useEffect(() => {
    if (phase !== 'recording') return undefined;
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'recording' && seconds >= MAX_ANSWER_SECONDS) speech.stop();
  }, [seconds, phase]);

  async function startRecording() {
    setPhase('recording');
    const ok = await speech.start();
    if (!ok) setPhase('idle');
  }

  // ---------- UI ----------

  const header = (
    <View>
      <Header
        onBack={() => router.back()}
        backIcon="close"
        center={<T v="eyebrow">{q ? `Question ${q.index + 1} of ${total}` : 'Interview'}</T>}
        right={
          <Pressable onPress={endAndShowSummary} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
            <T v="label" color={colors.onSurfaceVariant}>End</T>
          </Pressable>
        }
      />
      <View style={{ height: 3, backgroundColor: colors.container }}>
        <View style={{ height: 3, backgroundColor: colors.primary, width: `${total && q ? (q.index / total) * 100 : 0}%` }} />
      </View>
    </View>
  );

  if (phase === 'starting') {
    return <Screen header={header}><Loading message={'Preparing your question...\nThis can take a little while.'} /></Screen>;
  }
  if (phase === 'evaluating') {
    return (
      <Screen header={header}>
        <Loading message={'Evaluating your answer and preparing the next question...\nThis can take up to a minute.'} />
      </Screen>
    );
  }

  const footer = (
    <View style={{ padding: 20, gap: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.outlineVariant }}>
      {phase === 'idle' ? (
        speech.available ? (
          <>
            <Pressable onPress={startRecording} style={micStyle}>
              <MaterialIcons name="mic" size={32} color={colors.onPrimary} />
            </Pressable>
            <T v="caption">Tap to start speaking</T>
            <Button title="Type instead" variant="ghost" onPress={() => setPhase('review')} />
          </>
        ) : (
          <Button title="Type your answer" icon="edit" onPress={() => setPhase('review')} style={{ alignSelf: 'stretch' }} />
        )
      ) : null}

      {phase === 'recording' ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error }} />
            <T v="label">{mmss(seconds)}</T>
            <T v="mono">/ {mmss(MAX_ANSWER_SECONDS)}</T>
          </View>
          <Pressable onPress={() => speech.stop()} style={micStyle}>
            <MaterialIcons name="stop" size={34} color={colors.onPrimary} />
          </Pressable>
          <T v="caption">Tap to finish speaking</T>
        </>
      ) : null}

      {phase === 'review' ? (
        <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
          {speech.available ? (
            <Button title="Re-record" variant="outline" onPress={() => { setTranscript(''); setPhase('idle'); }} style={{ flex: 1 }} />
          ) : null}
          <Button title="Submit answer" icon="send" disabled={!transcript.trim()} onPress={() => submit(transcript.trim())} style={{ flex: 1.4 }} />
        </View>
      ) : null}

      {phase === 'error' ? (
        <View style={{ alignSelf: 'stretch', gap: 10 }}>
          <Banner message={error} />
          <Button title="Try again" onPress={() => retryRef.current && retryRef.current()} />
          <Button title="End session" variant="ghost" onPress={endAndShowSummary} />
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen scroll header={header} footer={footer} contentStyle={{ flexGrow: 1, gap: 20 }}>
      {q ? (
        <>
          <T v="eyebrow">{pretty(q.question.type)} question</T>
          <T v="question">{q.question.text}</T>
        </>
      ) : null}

      {phase === 'recording' ? (
        <View style={{ backgroundColor: colors.lowest, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12, padding: 16, gap: 8 }}>
          <T v="eyebrow">Live transcription</T>
          <T v="body">{speech.text || 'Listening...'}</T>
        </View>
      ) : null}

      {phase === 'review' ? (
        <>
          {!speech.available ? <Banner tone="info" message="Voice input doesn't run in Expo Go (it needs native code). Type your answer here, or open the app in a development build to speak it." /> : null}
          <Banner message={speech.error} />
          <Field
            label="Your answer"
            value={transcript}
            onChangeText={setTranscript}
            multiline
            maxLength={LIMITS.transcript}
            placeholder="Type or edit your answer"
            style={{ minHeight: 180 }}
            counter={`${transcript.length} / ${LIMITS.transcript}`}
          />
          <T v="caption">Answers aren't scored until the end of the session.</T>
        </>
      ) : null}

      {phase === 'idle' ? <Banner message={speech.error} /> : null}
    </Screen>
  );
}

const micStyle = {
  width: 76,
  height: 76,
  borderRadius: 38,
  backgroundColor: colors.primaryContainer,
  alignItems: 'center',
  justifyContent: 'center',
};
