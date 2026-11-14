import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Screen, T, Card, Badge, Button, Banner, Loading, IconButton } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';

function countSelectablePages(node) {
  return (node.isSelectable ? 1 : 0) + (node.children ?? []).reduce(
    (total, child) => total + countSelectablePages(child),
    0,
  );
}

function getFolderContents(tree, path) {
  let contents = tree;
  let folder = null;

  for (const id of path) {
    folder = contents.find((node) => node.id === id) ?? null;
    if (!folder) return { folder: null, contents: [] };
    contents = folder.children ?? [];
  }

  return { folder, contents };
}

export default function Home() {
  const [tree, setTree] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [syncPopup, setSyncPopup] = useState(null);
  const [updatingTopics, setUpdatingTopics] = useState({});
  const [path, setPath] = useState([]);
  const [syncModalVisible, setSyncModalVisible] = useState(true);
  const hasLoadedTree = useRef(false);

  async function loadTree() {
    setError(null);
    try {
      const result = await api.get('/items/tree');
      setTree(result?.tree ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      hasLoadedTree.current = true;
    }
  }

  async function syncItems() {
    setSyncing(true);
    setError(null);
    setSyncModalVisible(false);
    setSyncPopup({ status: 'loading', message: 'Syncing your Notion workspace' });

    let syncError = null;
    try {
      const result = await api.post('/items/sync', undefined, 120000);
      setSyncPopup({ status: 'success', message: `${result.total} Notion items synced` });
    } catch (e) {
      syncError = e.message;
    }

    try {
      const result = await api.get('/items/tree');
      setTree(result?.tree ?? []);
      if (syncError) {
        setSyncPopup({ status: 'error', message: `Sync failed. Showing saved pages.` });
        setError(syncError);
      }
    } catch (e) {
      const message = syncError ? `${syncError}. ${e.message}` : e.message;
      setSyncPopup({ status: 'error', message: 'Could not load Notion pages' });
      setError(message);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadTree();
  }, []);

  useEffect(() => {
    if (!syncPopup || syncPopup.status === 'loading') return undefined;
    const timer = setTimeout(() => setSyncPopup(null), 3200);
    return () => clearTimeout(timer);
  }, [syncPopup]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedTree.current) return;
      let active = true;
      api.get('/items/tree')
        .then((result) => {
          if (active) setTree(result?.tree ?? []);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  async function toggleTopic(topic) {
    setError(null);
    setUpdatingTopics((current) => ({ ...current, [topic.id]: true }));

    const wasSelected = Boolean(topic.isSelected);

    try {
      const result = wasSelected
        ? await api.delete(`/plans/${topic.id}`)
        : await api.put(`/plans/${topic.id}`, undefined, 120000);

      setTree((current) => {
        const updateSelection = (nodes) => nodes.map((node) => (
          node.id === topic.id
            ? { ...node, isSelected: result.isSelected }
            : { ...node, children: updateSelection(node.children ?? []) }
        ));
        return updateSelection(current);
      });

      if (!wasSelected && !result.quizReady) {
        setError(`Added to revision plan, but questions are not ready: ${result.preparationError ?? 'preparation failed'}`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdatingTopics((current) => ({ ...current, [topic.id]: false }));
    }
  }

  const { folder, contents } = getFolderContents(tree, path);
  const pageTitle = folder?.title ?? 'Your Notion Workspace';

  return (
    <Screen edges={['top']} contentStyle={{ padding: 0, gap: 0 }}>
      {syncPopup ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 10, left: 16, right: 16, zIndex: 5, alignItems: 'center' }}>
          <View style={{ minHeight: 44, maxWidth: 360, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(214, 213, 209, 0.9)', backgroundColor: 'rgba(255,255,255,0.96)', elevation: 8, shadowColor: '#1a1c1a', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } }}>
            {syncPopup.status === 'loading' ? (
              <ActivityIndicator size="small" color="#566153" />
            ) : (
              <MaterialIcons name={syncPopup.status === 'success' ? 'cloud-done' : 'cloud-off'} size={18} color={syncPopup.status === 'success' ? '#3d6b45' : '#ba1a1a'} />
            )}
            <T v="caption" numberOfLines={1}>{syncPopup.message}</T>
          </View>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 36, gap: 24 }}>
        <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 4, gap: 4 }}>
          <T v="heading" style={{ fontSize: 26, lineHeight: 32, fontFamily: 'Newsreader_500Medium', textAlign: 'center' }}>
            Pick Your Notes
          </T>
          <T v="caption" style={{ fontSize: 13, textAlign: 'center' }}>
            Select pages and databases to revise
          </T>
        </View>

        <Banner message={error} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {path.length ? (
            <IconButton name="arrow-back" onPress={() => setPath((current) => current.slice(0, -1))} />
          ) : null}
          <T v="eyebrow" style={{ flex: 1, color: '#999791', letterSpacing: 1.8 }}>
            {pageTitle}
          </T>
          {!path.length ? (
            <IconButton
              name="sync"
              accessibilityLabel="Sync Notion workspace"
              disabled={syncing}
              onPress={() => setSyncModalVisible(true)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0efeb' }}
            />
          ) : null}
        </View>
        {syncing && tree.length === 0 ? (
          <Loading message="Syncing your Notion workspace…" />
        ) : contents.length ? (
          contents.map((node) => {
            const isFolder = !node.isSelectable;
            return (
              <Card
                key={node.id}
                onPress={isFolder ? () => setPath((current) => [...current, node.id]) : undefined}
                style={{ padding: 20, borderRadius: 16, borderColor: 'rgba(214, 213, 209, 0.72)', gap: 0, shadowColor: '#000000', shadowOpacity: 0.025, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Badge label={isFolder ? (node.type === 'database' ? 'Database' : 'Folder') : node.isSelected ? 'In revision plan' : 'Page'} />
                    <T v="heading" style={{ fontSize: 22, lineHeight: 29, marginTop: 8 }}>{node.title}</T>
                    <T v="mono" style={{ marginTop: 4, color: '#999791' }}>
                      {isFolder
                        ? `${countSelectablePages(node)} selectable ${countSelectablePages(node) === 1 ? 'page' : 'pages'}`
                        : node.isSelected ? 'Selected for revision' : 'Selectable page'}
                    </T>
                  </View>
                  {isFolder ? (
                    <MaterialIcons name="chevron-right" size={20} color="#999791" style={{ marginTop: 10 }} />
                  ) : null}
                </View>
                {!isFolder ? (
                  <Button
                    title={node.isSelected ? 'Remove from revision plan' : 'Add to revision plan'}
                    icon={node.isSelected ? 'check-box' : 'add'}
                    variant={node.isSelected ? 'outline' : 'primary'}
                    loading={Boolean(updatingTopics[node.id])}
                    onPress={() => toggleTopic(node)}
                    style={{ marginTop: 16 }}
                  />
                ) : null}
              </Card>
            );
          })
        ) : (
          <View style={{ gap: 8 }}>
            <T v="heading">{folder ? 'No pages in this folder' : 'No shared Notion pages yet'}</T>
            <T v="caption">{folder ? 'Go back or sync Notion to check for new pages.' : 'Share pages with the Re-Wiser integration in Notion, then sync again.'}</T>
          </View>
        )}
      </ScrollView>
      <Modal
        visible={syncModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSyncModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.40)' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close sync dialog"
            onPress={() => setSyncModalVisible(false)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View style={{ width: '100%', maxWidth: 320, alignItems: 'center', padding: 24, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(214, 213, 209, 0.72)', backgroundColor: '#ffffff', elevation: 24, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } }}>
            <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#e9e8e5', backgroundColor: '#f4f3f0', marginBottom: 16 }}>
              <MaterialIcons name="sync" size={28} color="#1a1c1a" />
            </View>
            <T v="label" style={{ fontSize: 17, lineHeight: 23, textAlign: 'center', marginBottom: 8 }}>
              Sync with Notion?
            </T>
            <T v="caption" style={{ textAlign: 'center', lineHeight: 20, marginBottom: 22, paddingHorizontal: 4 }}>
              Sync your latest pages and databases from your Notion workspace?
            </T>
            <View style={{ width: '100%', gap: 8 }}>
              <Button
                title={syncing ? 'Syncing…' : 'Yes, Sync'}
                icon={syncing ? undefined : 'sync'}
                loading={syncing}
                disabled={syncing}
                onPress={syncItems}
                style={{ borderRadius: 12 }}
              />
              <Button
                title="No, Cancel"
                variant="ghost"
                disabled={syncing}
                onPress={() => setSyncModalVisible(false)}
                style={{ minHeight: 44, borderRadius: 12 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
