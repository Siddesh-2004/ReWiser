import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Screen, Header, T, Card, Badge, Banner, Loading } from '../../components/ui';
import { api } from '../../lib/api';
import { colors, scoreColor } from '../../lib/theme';
import { pretty } from '../../lib/utils';

function Score({ label, value }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <T v="heading" color={scoreColor(value)}>{value}</T>
      <T v="mono">{label}</T>
    </View>
  );
}

function TurnCard({ turn, number, startOpen }) {
  const [open, setOpen] = useState(startOpen);
  const ev = turn.evaluation;
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T v="eyebrow">Question {number}</T>
          <Badge label={pretty(turn.question.type)} />
        </View>
        <T v="heading" style={{ fontSize: 18 }}>{turn.question.text}</T>
      </View>

      <View style={{ gap: 4 }}>
        <T v="eyebrow">Your answer</T>
        <T v="body">{turn.transcript}</T>
      </View>

      {ev.lowConfidenceTranscript ? <Banner tone="info" message="The transcript looked unclear, so some feedback may be less reliable." /> : null}

      <View style={{ flexDirection: 'row', backgroundColor: colors.low, borderRadius: 8, paddingVertical: 10 }}>
        <Score label="Correct" value={ev.correctness} />
        <Score label="Complete" value={ev.completeness} />
        <Score label="Fluency" value={ev.fluency} />
        <Score label="Overall" value={ev.overall} />
      </View>

      <T v="body">{ev.feedback}</T>

      {ev.missingConcepts && ev.missingConcepts.length ? (
        <View style={{ gap: 6 }}>
          <T v="eyebrow">Missing concepts</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {ev.missingConcepts.map((c) => <Badge key={c} label={c} />)}
          </View>
        </View>
      ) : null}

      {ev.incorrectStatements && ev.incorrectStatements.length ? (
        <View style={{ gap: 6, backgroundColor: colors.errorContainer, borderRadius: 8, padding: 12 }}>
          <T v="eyebrow" color={colors.onErrorContainer}>Incorrect statements</T>
          {ev.incorrectStatements.map((s, i) => (
            <T key={i} v="caption" color={colors.onErrorContainer}>• {s}</T>
          ))}
        </View>
      ) : null}

      <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T v="eyebrow">Ideal answer</T>
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color={colors.onSurfaceVariant} />
      </Pressable>
      {open ? <T v="body">{ev.idealAnswer}</T> : null}
    </Card>
  );
}

export default function Review() {
  const router = useRouter();
  const { id: sessionId } = useLocalSearchParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { session: s } = await api.sessions.get(sessionId);
        setSession(s);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [sessionId]);

  const header = <Header title="Review" onBack={() => router.back()} />;
  if (!session) return <Screen header={header}>{error ? <Banner message={error} /> : <Loading />}</Screen>;

  // Only turns that were actually answered and scored are worth showing.
  const turns = (session.turns || []).filter((t) => t.answered && t.evaluation);

  return (
    <Screen scroll header={header}>
      <View style={{ gap: 6 }}>
        <T v="title">{session.topicTitle}</T>
        {session.summary ? <T v="caption">Overall {session.summary.overall.toFixed(1)} / 10 · {session.summary.answeredCount} answered</T> : <T v="caption">No answered questions.</T>}
      </View>
      {turns.map((t, i) => <TurnCard key={t.index} turn={t} number={i + 1} startOpen={i === 0} />)}
    </Screen>
  );
}
