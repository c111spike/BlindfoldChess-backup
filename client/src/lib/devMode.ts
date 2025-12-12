export const isDevelopment = import.meta.env.DEV;

export const TEST_USERS = [
  { id: 'test-admin-1', name: 'Test Admin', email: 'admin@test.com' },
  { id: 'test-player-1', name: 'Test Player 1', email: 'player1@test.local' },
  { id: 'test-player-2', name: 'Test Player 2', email: 'player2@test.local' },
  { id: 'test-player-3', name: 'Test Player 3', email: 'player3@test.local' },
  { id: 'test-player-4', name: 'Test Player 4', email: 'player4@test.local' },
] as const;

export type TestUser = typeof TEST_USERS[number];

const TEST_USER_KEY = 'simulchess_test_user_id';

export function getTestUserId(): string | null {
  if (!isDevelopment) return null;
  return localStorage.getItem(TEST_USER_KEY);
}

export function setTestUserId(userId: string | null): void {
  if (!isDevelopment) return;
  
  if (userId) {
    localStorage.setItem(TEST_USER_KEY, userId);
  } else {
    localStorage.removeItem(TEST_USER_KEY);
  }
}

export function getTestUser(): TestUser | null {
  const userId = getTestUserId();
  if (!userId) return null;
  return TEST_USERS.find(u => u.id === userId) || null;
}
