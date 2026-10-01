import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface Session {
  email: string;
  token: string;
}

const SESSION_KEY = 'cacaoapp.session';

export async function saveSession(session: Session): Promise<void> {
  const value = JSON.stringify(session);
  if (Platform.OS === 'web') {
    localStorage.setItem(SESSION_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, value);
}

export async function loadSession(): Promise<Session | null> {
  const value = Platform.OS === 'web'
    ? localStorage.getItem(SESSION_KEY)
    : await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) return null;

  try {
    const session = JSON.parse(value) as Partial<Session>;
    return typeof session.email === 'string' && typeof session.token === 'string'
      ? { email: session.email, token: session.token }
      : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
