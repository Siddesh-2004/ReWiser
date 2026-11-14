import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen, T, Card, Badge, Button, Banner, Loading } from '../../components/ui';
import { api } from '../../lib/api';

function selectedPages(nodes, ancestors = []) {
  return nodes.flatMap((node) => {
    const page = node.type === 'page' && node.isSelectable && node.isSelected
      ? [{ id: node.id, title: node.title, location: ancestors.join(' / ') }]
      : [];
    return [...page, ...selectedPages(node.children ?? [], [...ancestors, node.title])];
  });
}

function setNodeSelection(nodes, itemId, isSelected) {
  return nodes.map((node) => (
    node.id === itemId
      ? { ...node, isSelected }
      : { ...node, children: setNodeSelection(node.children ?? [], itemId, isSelected) }
  ));
}

export default function Plans() {
  const router = useRouter();
  const [tree, setTree] = useState([]);
  const [planDetails, setPlanDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [preparingId, setPreparingId] = useState(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [treeResult, plansResult] = await Promise.all([
        api.get('/items/tree'),
        api.get('/plans'),
      ]);
      setTree(treeResult?.tree ?? []);
      setPlanDetails(Object.fromEntries((plansResult?.plans ?? []).map((plan) => [plan.itemId, plan])));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [loadPlans]),
  );

  async function removePlan(itemId) {
    setRemovingId(itemId);
    setError(null);
    try {
      await api.delete(`/plans/${itemId}`);
      setTree((current) => setNodeSelection(current, itemId, false));
      setPlanDetails((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setRemovingId(null);
    }
  }

  async function preparePlan(itemId) {
    setPreparingId(itemId);
    setError(null);
    try {
      const result = await api.put(`/plans/${itemId}`, undefined, 120000);
      setPlanDetails((current) => ({
        ...current,
        [itemId]: { ...current[itemId], ...result },
      }));
      if (!result.quizReady) {
        setError(result.preparationError ?? 'Could not prepare questions. Check the AI server and retry.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setPreparingId(null);
    }
  }

  const plans = selectedPages(tree).map((plan) => ({ ...plan, ...planDetails[plan.id] }));

  return (
    <Screen edges={['top']} contentStyle={{ padding: 0, gap: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ gap: 4 }}>
          <T v="eyebrow">Revision</T>
          <T v="title">Your plans</T>
          <T v="caption">Pages you selected for revision.</T>
        </View>

        <Button title="Refresh plans" icon="sync" loading={loading} onPress={loadPlans} />
        <Banner message={error} />
        {loading && tree.length === 0 ? (
          <Loading message="Loading your plans…" />
        ) : plans.length ? (
          plans.map((plan) => (
            <Card key={plan.id}>
              <Badge label={plan.location || 'Notion'} />
              <T v="heading">{plan.title}</T>
              <T v="mono">
                Round {plan.currentRound ?? 1} · Difficulty {plan.difficulty ?? 1} · Due {plan.dueAt ? new Date(plan.dueAt).toLocaleDateString() : 'date unavailable'}
              </T>
              <Button
                title="Start quiz"
                icon="play-arrow"
                disabled={!plan.quizReady}
                onPress={() => router.push({ pathname: '/quiz/[itemId]', params: { itemId: plan.id } })}
              />
              {!plan.quizReady ? (
                <Button
                  title="Prepare questions"
                  icon="refresh"
                  variant="outline"
                  loading={preparingId === plan.id}
                  onPress={() => preparePlan(plan.id)}
                />
              ) : null}
              <Button
                title="Remove from revision plan"
                icon="remove-circle-outline"
                variant="outline"
                loading={removingId === plan.id}
                onPress={() => removePlan(plan.id)}
              />
            </Card>
          ))
        ) : (
          <View style={{ gap: 8 }}>
            <T v="heading">No planned pages yet</T>
            <T v="caption">Browse your Notion folders on Home and add leaf pages to your revision plan.</T>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}