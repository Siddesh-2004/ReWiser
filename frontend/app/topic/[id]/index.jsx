import React, { useCallback, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Screen, Header, IconButton, T, Card, Badge, Button, Banner, Loading } from '../../../components/ui';
import { api } from '../../../lib/api';
import { colors, scoreColor } from '../../../lib/theme';
import { formatDate, pretty, statusTone } from '../../../lib/utils';

const DIFFICULTIES = ['easy', 'medium', 'hard'];

export default function TopicDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [topic, setTopic] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount] = useState(5);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setError(null);
          const [t, s] = await Promise.all([api.topics.get(id), api.sessions.list(id)]);
          setTopic(t.topic);
          setSessions(s.sessions);
        } catch (e) {
          setError(e.message);
        }
      })();
    }, [id])
  );

  function openSession(s) {
    if (s.status === 'in_progress') router.push({ pathname: '/interview', params: { sessionId: s._id, topicTitle: s.topicTitle } });
    else router.push(`/review/${s._id}`);
  }

  const header = (
    <Header
      title="Topic"
      onBack={() => router.back()}
      right={<IconButton name="edit" onPress={() => router.push(`/topic/${id}/edit`)} />}
    />
  );

  if (!topic) {
    return <Screen header={header}>{error ? <Banner message={error} /> : <Loading />}</Screen>;
  }

  return (
    <Screen scroll header={header}>
      <Banner message={error} />
      <View style={{ gap: 8 }}>
        <Badge label={topic.category} />
        <T v="title">{topic.title}</T>
        {topic.description ? <T v="caption">{topic.description}</T> : null}
        {topic.notes ? <T v="mono" numberOfLines={3} style={{ marginTop: 4 }}>{topic.notes}</T> : <T v="caption">No reference notes yet. Add some for better questions.</T>}
      </View>

      <Card>
        <T v="eyebrow">Interview setup</T>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {DIFFICULTIES.map((d) => (
            <Pressable
              key={d}
              onPress={() => setDifficulty(d)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: difficulty === d ? colors.primary : colors.outlineVariant, backgroundColor: difficulty === d ? colors.primary : colors.low }}
            >
              <T v="label" color={difficulty === d ? colors.onPrimary : colors.onSurface}>{pretty(d)}</T>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T v="label">Questions</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <IconButton name="remove" onPress={() => setCount((c) => Math.max(1, c - 1))} />
            <T v="heading" style={{ minWidth: 28, textAlign: 'center' }}>{count}</T>
            <IconButton name="add" onPress={() => setCount((c) => Math.min(10, c + 1))} />
          </View>
        </View>
        <Button
          title="Start interview"
          icon="mic"
          onPress={() =>
            // Route params are always strings, so the interview screen converts questionCount back to a number.
            router.push({ pathname: '/interview', params: { topicId: id, topicTitle: topic.title, difficulty, questionCount: String(count) } })
          }
        />
      </Card>

      <View style={{ gap: 10 }}>
        <T v="eyebrow">Past sessions</T>
        {sessions.length === 0 ? <T v="caption">No sessions yet.</T> : null}
        {sessions.map((s) => (
          <Card key={s._id} onPress={() => openSession(s)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ gap: 6 }}>
              <T v="label">{formatDate(s.createdAt)}</T>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Badge label={pretty(s.difficulty)} />
                <Badge label={pretty(s.status)} tone={statusTone(s.status)} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {s.summary ? <T v="heading" color={scoreColor(s.summary.overall)}>{s.summary.overall.toFixed(1)}</T> : null}
              <MaterialIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
