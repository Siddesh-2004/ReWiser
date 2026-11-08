import React, { useCallback, useMemo, useState } from 'react';
import { View, FlatList, ScrollView, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Screen, TabHeader, T, Card, Chip, Badge, Field, Banner, Loading, Empty } from '../../components/ui';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';
import { timeAgo } from '../../lib/utils';

export default function Topics() {
  const router = useRouter();
  const [topics, setTopics] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const load = useCallback(async () => {
    try {
      setError(null);
      const { topics: list } = await api.topics.list();
      setTopics(list);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // Runs every time the tab gains focus, so it refreshes after creating/editing a topic.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const categories = useMemo(() => ['All', ...new Set((topics || []).map((t) => t.category))], [topics]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (topics || []).filter(
      (t) =>
        (category === 'All' || t.category === category) &&
        (!q || t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
    );
  }, [topics, query, category]);

  const listHeader = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <Field value={query} onChangeText={setQuery} placeholder="Search topics..." autoCapitalize="none" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {categories.map((c) => (
          <Chip key={c} label={c === 'All' ? 'All topics' : c} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>
      <Banner message={error} />
    </View>
  );

  return (
    <Screen edges={['top']} contentStyle={{ padding: 0, gap: 0 }} header={<TabHeader title="Topics" />}>
      {topics === null && !error ? (
        <Loading />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(t) => t._id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 12, flexGrow: 1 }}
          ListHeaderComponent={listHeader}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !error ? (
              <Empty
                icon="search-off"
                title={topics && topics.length ? 'No matches' : 'No topics yet'}
                message={topics && topics.length ? 'Try another search or category.' : 'Add a topic with some notes, then practise it out loud.'}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/topic/${item._id}`)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Badge label={item.category} />
                <T v="mono">{timeAgo(item.updatedAt)}</T>
              </View>
              <T v="heading">{item.title}</T>
              {item.description ? <T v="caption" numberOfLines={2}>{item.description}</T> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <T v="label" style={{ fontSize: 13 }}>Start drill</T>
                <MaterialIcons name="arrow-forward" size={14} color={colors.onSurface} />
              </View>
            </Card>
          )}
        />
      )}

      <Pressable
        onPress={() => router.push('/topic/new')}
        style={{ position: 'absolute', right: 20, bottom: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
      >
        <MaterialIcons name="add" size={26} color={colors.onPrimary} />
      </Pressable>
    </Screen>
  );
}
