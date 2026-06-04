import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({
  getConfig: () => ({
    venueName: 'Seven Paths Manor',
  }),
}));

let mockUsers: any[] = [];

vi.mock('../hooks/useLayoutState', () => ({
  getUsers: () => mockUsers,
  setUsers: (users: any[]) => {
    mockUsers = users;
  },
}));

import PasswordReset from './PasswordReset';
import { STORAGE_KEYS } from '../constants/storageKeys';

describe('PasswordReset email flow', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUsers = [
      {
        id: 'u1',
        username: 'jane',
        email: 'jane@example.com',
        password: 'old-password',
        role: 'basic',
        name: 'Jane Doe',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];
  });

  it(
    'can complete reset flow when started from email address',
    async () => {
      const user = userEvent.setup();

      render(
        <PasswordReset
          onClose={() => undefined}
          onSuccess={() => undefined}
        />,
      );

      await user.type(
        screen.getByLabelText(/email address/i),
        'jane@example.com',
      );

      await user.click(
        screen.getByRole('button', { name: /send verification code/i }),
      );

      await waitFor(
        () => {
          expect(localStorage.getItem(STORAGE_KEYS.PASSWORD_RESET_CODE)).toBeTruthy();
        },
        { timeout: 4000 },
      );

      const stored = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.PASSWORD_RESET_CODE) || 'null',
      );

      expect(stored.username).toBe('jane');
      expect(stored.codeHash).toBeTruthy();
      expect(stored.codeSalt).toBeTruthy();

      await screen.findByText(/demo mode - verification code/i);
	  // Get the displayed code
	  const codeElement = await screen.findByText(/^\d{6}$/);
	  const code = codeElement.textContent || '';

      await user.type(screen.getByLabelText(/verification code/i), code);
      await user.click(screen.getByRole('button', { name: /verify code/i }));

      const newPasswordInput = await screen.findByLabelText(/^new password$/i);
      const confirmPasswordInput = await screen.findByLabelText(/confirm password/i);

      await user.type(newPasswordInput, 'NewPassword123!');
      await user.type(confirmPasswordInput, 'NewPassword123!');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(
        () => {
          expect(localStorage.getItem(STORAGE_KEYS.PASSWORD_RESET_CODE)).toBeNull();
        },
        { timeout: 4000 },
      );

      expect(mockUsers[0].passwordHash).toBeTruthy();
      expect(mockUsers[0].password).toBe('');
    },
    15000,
  );
});