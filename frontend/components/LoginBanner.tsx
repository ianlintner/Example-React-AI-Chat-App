import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';

interface SessionSnapshot {
  tier: 'anonymous' | 'authenticated';
  authenticated: boolean;
  loginUrl: string | null;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

/**
 * LoginBanner — shows "Sign in for smarter agents" CTA for anon callers.
 * Fetches /api/auth/me which always returns 200 with a session snapshot.
 * Hides itself when the caller is authenticated.
 */
export function LoginBanner() {
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/auth/me`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        setSession({
          tier: data.tier ?? 'anonymous',
          authenticated: Boolean(data.authenticated),
          loginUrl: data.loginUrl ?? '/oauth2/start',
        });
      })
      .catch(() => {
        /* network error — stay hidden */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!session || session.authenticated || dismissed) return null;

  const href = session.loginUrl ?? '/oauth2/start';
  const fullHref = href.startsWith('http') ? href : `${API_URL}${href}`;

  const handlePress = () => {
    if (Platform.OS === 'web') {
      window.location.href = fullHref;
    } else {
      Linking.openURL(fullHref);
    }
  };

  return (
    <View style={styles.banner} accessibilityRole='alert'>
      <Text style={styles.text}>
        You’re chatting as a guest on the free-tier model.{' '}
        <Text style={styles.link} onPress={handlePress}>
          Sign in
        </Text>{' '}
        for smarter agents and higher limits.
      </Text>
      <Pressable
        onPress={() => setDismissed(true)}
        accessibilityLabel='Dismiss sign-in banner'
        style={styles.dismiss}
      >
        <Text style={styles.dismissText}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#1a2a20',
    borderBottomWidth: 1,
    borderBottomColor: '#2a3a2e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    color: '#e8f0e8',
    fontSize: 13,
    flex: 1,
  },
  link: {
    color: '#4a9a6a',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  dismiss: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dismissText: {
    color: '#9cb2a0',
    fontSize: 20,
    lineHeight: 20,
  },
});
