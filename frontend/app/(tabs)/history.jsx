import React, { useCallback, useState } from 'react';
import { View, FlatList } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, TabHeader, T, Card, Badge, Banner, Loading, Empty } from '../../components/ui';
import { api } from '../../lib/api';
import { scoreColor } from '../../lib/theme';
import { formatDate, pretty, statusTone } from '../../lib/utils';

export default function History() {
  const router = useRouter();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { sessions: list } = await api.sessions.list();
      setSessions(list);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function open(s) {
    if (s.status === 'in_progress') router.push({ pathname: '/interview', params: { sessionId: s._id, topicTitle: s.topicTitle } });
    else router.push(`/review/${s._id}`);
  }

  return (
    <Screen edges={['top']} contentStyle={{ padding: 0, gap: 0 }} header={<TabHeader title="History" />}>
      {sessions === null && !error ? (
        <Loading />
      ) : (
        <FlatList
          data={sessions || []}
          keyExtractor={(s) => s._id}
          contentContainerStyle={{ padding: 20, gap: 12, flexGrow: 1 }}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          ListHeaderComponent={<Banner message={error} style={{ marginBottom: 12 }} />}
          ListEmptyComponent={!error ? <Empty icon="history" title="No sessions yet" message="Finish an interview and it will show up here." /> : null}
          renderItem={({ item }) => (
            <Card onPress={() => open(item)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ gap: 6, flex: 1, paddingRight: 12 }}>
                <T v="heading" style={{ fontSize: 17 }} numberOfLines={1}>{item.topicTitle}</T>
                <T v="mono">{formatDate(item.createdAt)}</T>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Badge label={pretty(item.difficulty)} />
                  <Badge label={pretty(item.status)} tone={statusTone(item.status)} />
                </View>
              </View>
              {item.summary ? (
                <T v="score" style={{ fontSize: 28, lineHeight: 34 }} color={scoreColor(item.summary.overall)}>
                  {item.summary.overall.toFixed(1)}
                </T>
              ) : null}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
