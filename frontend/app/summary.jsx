import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Screen, Header, T, Card, Badge, ScoreBar, Button, Banner, Empty, Loading } from '../components/ui';
import { api } from '../lib/api';
import { scoreColor } from '../lib/theme';
import { WEIGHTS } from '../lib/config';
import { tierFor } from '../lib/utils';

export default function Summary() {
  const router = useRouter();
  const { sessionId, topicTitle } = useLocalSearchParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);

  // The finished session (completed or ended early) carries its own summary.
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

  const header = <Header title="Session feedback" />;
  const toTopics = <Button title="Back to topics" variant="outline" onPress={() => router.dismissAll()} />;

  if (!session) return <Screen header={header}>{error ? <><Banner message={error} />{toTopics}</> : <Loading />}</Screen>;

  const summary = session.summary;
  if (!summary) {
    return (
      <Screen header={header}>
        <Empty icon="mic-off" title="No answers recorded" message="The session ended before any question was answered, so there is nothing to score." action={toTopics} />
      </Screen>
    );
  }

  return (
    <Screen scroll header={header}>
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 4 }}>
        <T v="eyebrow">{session.status === 'completed' ? 'Assessment completed' : 'Session ended early'}</T>
        <T v="title" style={{ textAlign: 'center' }}>{topicTitle || session.topicTitle}</T>
        <Badge label={`${summary.answeredCount} of ${session.questionCount} answered`} />
      </View>

      <Card style={{ alignItems: 'center' }}>
        <T v="eyebrow">Overall</T>
        <View style={{ width: 132, height: 132, borderRadius: 66, borderWidth: 6, borderColor: scoreColor(summary.overall), alignItems: 'center', justifyContent: 'center', marginVertical: 6 }}>
          <T v="score">{summary.overall.toFixed(1)}</T>
          <T v="mono">/ 10</T>
        </View>
        <Badge label={tierFor(summary.overall)} tone={summary.overall >= 7 ? 'green' : summary.overall >= 5 ? 'amber' : 'red'} />
      </Card>

      <Card style={{ gap: 16 }}>
        <T v="eyebrow">Score breakdown</T>
        <ScoreBar label="Correctness" weight={WEIGHTS.correctness} value={summary.correctness} />
        <ScoreBar label="Completeness" weight={WEIGHTS.completeness} value={summary.completeness} />
        <ScoreBar label="Fluency" weight={WEIGHTS.fluency} value={summary.fluency} />
      </Card>

      {summary.missingConcepts && summary.missingConcepts.length ? (
        <Card>
          <T v="eyebrow">Concepts to revise</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {summary.missingConcepts.map((c) => (
              <Badge key={c} label={c} />
            ))}
          </View>
        </Card>
      ) : null}

      <Button title="Review answers" icon="arrow-forward" onPress={() => router.push(`/review/${sessionId}`)} />
      {toTopics}
    </Screen>
  );
}
