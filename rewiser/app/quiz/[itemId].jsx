import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Screen, Header, T, Card, Badge, Button, Banner, Loading, Field, Chip } from '../../components/ui';
import { api } from '../../lib/api';

export default function Quiz() {
  const { itemId } = useLocalSearchParams();
  const router = useRouter();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [quiz, setQuiz] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState('audio');
  const [recordingUri, setRecordingUri] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [answerResult, setAnswerResult] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.post('/quizzes', { itemId: String(itemId) }, 120000)
      .then((result) => {
        if (!active) return;
        setQuiz(result);
        const firstUnanswered = result.questions.findIndex((question) => !question.answer);
        setCurrentIndex(firstUnanswered < 0 ? 0 : firstUnanswered);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (recorder.isRecording) recorder.stop();
    };
  }, [itemId, recorder]);

  const question = quiz?.questions?.[currentIndex];
  const answeredCount = quiz?.questions?.filter((item) => item.answer).length ?? 0;
  const remainingQuestions = quiz?.questions?.some((item) => !item.answer) ?? false;

  async function beginRecording() {
    setError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone access was not granted. Switch to text to answer instead.');
        setMode('text');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      setRecordingUri(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      setError(e.message || 'Could not start recording. You can answer by text instead.');
      setMode('text');
    }
  }

  async function endRecording() {
    setError(null);
    try {
      await recorder.stop();
      setRecordingUri(recorder.uri);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch (e) {
      setError(e.message || 'Could not finish the recording. Try again or answer by text.');
    }
  }

  async function submitAnswer() {
    if (!question) return;
    setSaving(true);
    setError(null);
    try {
      let result;
      if (mode === 'audio') {
        if (!recordingUri) {
          setError('Record an answer first, or switch to text.');
          return;
        }
        const form = new FormData();
        if (Platform.OS === 'web') {
          const audioResponse = await fetch(recordingUri);
          const audioBlob = await audioResponse.blob();
          if (!audioBlob.size) throw new Error('The recording is empty. Record your answer again.');
          const extension = audioBlob.type.includes('webm') ? 'webm' : 'ogg';
          form.append('audio', audioBlob, `answer.${extension}`);
        } else {
          form.append('audio', {
            uri: recordingUri,
            name: 'answer.m4a',
            type: 'audio/mp4',
          });
        }
        form.append('question', question.question);
        result = await api.postMultipart(
          `/quizzes/questions/${question.id}/answer`,
          form,
          120000,
        );
      } else {
        if (!answerText.trim()) {
          setError('Type an answer before submitting.');
          return;
        }
        result = await api.post(
          `/quizzes/questions/${question.id}/answer`,
          { answer: answerText.trim() },
          120000,
        );
      }
      setAnswerResult(result);
      setQuiz((current) => ({
        ...current,
        questions: current.questions.map((item) => (
          item.id === question.id ? { ...item, answer: result } : item
        )),
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function continueQuiz() {
    const nextIndex = quiz.questions.findIndex((item) => !item.answer);
    if (nextIndex >= 0) setCurrentIndex(nextIndex);
    setAnswerResult(null);
    setAnswerText('');
    setRecordingUri(null);
  }

  async function finishQuiz() {
    setSaving(true);
    setError(null);
    try {
      const result = await api.post(`/quizzes/${quiz.quizId}/complete`, {}, 120000);
      setCompletion(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top']} contentStyle={{ padding: 0, gap: 0 }}>
      <Header title="Revision quiz" onBack={() => router.back()} />
      {loading ? (
        <Loading message="Loading your prepared questions…" />
      ) : completion ? (
        <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }}>
          <Badge label="Round complete" tone="green" />
          <T v="title">Good work.</T>
          <Card>
            <T v="label">Correctness</T>
            <T v="heading">{completion.averageCorrectness == null ? '—' : `${Math.round(completion.averageCorrectness * 100)}%`}</T>
            <T v="label">Fluency</T>
            <T v="heading">{completion.averageFluency == null ? 'Text answers only' : `${Math.round(completion.averageFluency * 100)}%`}</T>
            <T v="caption">Next review: {new Date(completion.nextDueAt).toLocaleDateString()}</T>
          </Card>
          <Button title="Back to revision plans" icon="arrow-back" onPress={() => router.replace('/plans')} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Banner message={error} />
          {!quiz ? (
            <View style={{ gap: 10 }}>
              <T v="heading">Could not load this quiz</T>
              <Button title="Back to plans" icon="arrow-back" variant="outline" onPress={() => router.back()} />
            </View>
          ) : answerResult ? (
            <>
              <T v="eyebrow">Question {currentIndex + 1} of {quiz.questions.length}</T>
              <Card>
                <Badge label="Answer evaluated" tone="green" />
                <T v="heading">{Math.round(answerResult.correctnessScore * 100)}% correct</T>
                {answerResult.fluencyScore != null ? (
                  <T v="label">Fluency: {Math.round(answerResult.fluencyScore * 100)}%</T>
                ) : null}
                {answerResult.transcript ? <T v="caption">“{answerResult.transcript}”</T> : null}
                <T v="body">{answerResult.feedback}</T>
              </Card>
              {remainingQuestions ? (
                <Button title="Next question" icon="arrow-forward" onPress={continueQuiz} />
              ) : (
                <Button title="Finish quiz" icon="check" loading={saving} onPress={finishQuiz} />
              )}
            </>
          ) : question ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T v="eyebrow">Question {currentIndex + 1} of {quiz.questions.length}</T>
                <T v="mono">{answeredCount} answered</T>
              </View>
              <Card style={{ padding: 22 }}>
                <Badge label={`Round ${quiz.round} · Difficulty ${quiz.difficulty}`} />
                <T v="heading" style={{ fontSize: 24, lineHeight: 32 }}>{question.question}</T>
              </Card>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Chip label="Voice" active={mode === 'audio'} onPress={() => setMode('audio')} />
                <Chip label="Text" active={mode === 'text'} onPress={() => setMode('text')} />
              </View>
              {mode === 'audio' ? (
                <View style={{ gap: 10 }}>
                  <Button
                    title={recorderState.isRecording ? 'Stop recording' : recordingUri ? 'Record again' : 'Start recording'}
                    icon={recorderState.isRecording ? 'stop' : 'mic'}
                    variant={recorderState.isRecording ? 'danger' : 'outline'}
                    onPress={recorderState.isRecording ? endRecording : beginRecording}
                  />
                  {recordingUri ? <T v="caption">Recording ready to submit.</T> : null}
                  <Button title="Send recording" icon="send" loading={saving} disabled={recorderState.isRecording || !recordingUri} onPress={submitAnswer} />
                  <T v="caption" style={{ textAlign: 'center' }}>Audio is sent for transcription and fluency scoring.</T>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <Field
                    label="Your answer"
                    multiline
                    value={answerText}
                    onChangeText={setAnswerText}
                    placeholder="Explain it in your own words…"
                  />
                  <Button title="Send answer" icon="send" loading={saving} onPress={submitAnswer} />
                </View>
              )}
            </>
          ) : (
            <View style={{ gap: 12 }}>
              <T v="heading">All questions answered</T>
              <Button title="Finish quiz" icon="check" loading={saving} onPress={finishQuiz} />
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}