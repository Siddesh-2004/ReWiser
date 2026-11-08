import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Header, Field, Button, Banner, Loading } from './ui';
import { api } from '../lib/api';
import { LIMITS } from '../lib/config';

// Shared by app/topic/new.jsx (no topicId) and app/topic/[id]/edit.jsx (topicId from the URL).
export default function TopicForm({ topicId }) {
  const router = useRouter();
  const [form, setForm] = useState({ title: '', category: '', description: '', notes: '' });
  const [loading, setLoading] = useState(!!topicId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!topicId) return;
    (async () => {
      try {
        const { topic } = await api.topics.get(topicId);
        setForm({ title: topic.title, category: topic.category || '', description: topic.description || '', notes: topic.notes || '' });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [topicId]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    if (!form.title.trim()) return setError('Give the topic a title.');
    setSaving(true);
    setError(null);
    // The API rejects an empty category, so only send it when filled in.
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      notes: form.notes,
      ...(form.category.trim() ? { category: form.category.trim() } : {}),
    };
    try {
      if (topicId) await api.topics.update(topicId, body);
      else await api.topics.create(body);
      router.back();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete topic?', 'Finished sessions are kept, but in-progress ones can no longer be continued.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.topics.remove(topicId);
            router.dismissAll(); // back to the tabs; the detail screen below would show a deleted topic
          } catch (e) {
            setError(e.message);
          }
        },
      },
    ]);
  }

  return (
    <Screen scroll header={<Header title={topicId ? 'Edit topic' : 'New topic'} onBack={() => router.back()} />}>
      {loading ? (
        <Loading />
      ) : (
        <>
          <Banner message={error} />
          <Field label="Title" value={form.title} onChangeText={set('title')} placeholder="e.g. Distributed caching" maxLength={200} />
          <Field label="Category" value={form.category} onChangeText={set('category')} placeholder="e.g. System Design (default: General)" maxLength={100} />
          <Field label="Description" value={form.description} onChangeText={set('description')} multiline maxLength={LIMITS.description} placeholder="What does this topic cover?" counter={`${form.description.length} / ${LIMITS.description}`} />
          <Field
            label="Reference notes"
            value={form.notes}
            onChangeText={set('notes')}
            multiline
            maxLength={LIMITS.notes}
            placeholder="Paste your study notes. Questions are drawn from these and answers are judged against them."
            style={{ minHeight: 220 }}
            counter={`${form.notes.length} / ${LIMITS.notes}`}
          />
          <Button title="Save topic" onPress={save} loading={saving} />
          {topicId ? <Button title="Delete topic" variant="danger" onPress={confirmDelete} /> : null}
        </>
      )}
    </Screen>
  );
}
