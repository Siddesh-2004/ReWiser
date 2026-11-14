import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Loading } from '../components/ui';
import { useAuth } from '../lib/auth';

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const { token, name, email, avatar, error } = params;
  const router = useRouter();
  const { completeSignIn } = useAuth();

  useEffect(() => {
    let active = true;
    completeSignIn({ token, name, email, avatar }).then((completed) => {
      if (!active) return;
      router.replace(completed ? '/' : { pathname: '/login', params: { error: error || 'invalid_request' } });
    }).catch(() => {
      if (active) router.replace({ pathname: '/login', params: { error: 'login_failed' } });
    });

    return () => {
      active = false;
    };
  }, [completeSignIn, token, name, email, avatar, error, router]);

  return <Loading message="Finishing sign in..." />;
}