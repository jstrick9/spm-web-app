import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getConfig } from '../config';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { isUserLocked } from '../utils/auth';
import { getUsers } from '../hooks/useLayoutState';
import PasswordReset from './PasswordReset';
import Logo from './Logo';
import { shouldUseSupabaseAuth } from '../services/backend/AuthBackend';

export interface LoginScreenProps {
  onContinueAsGuest?: () => void;
}

export function LoginScreen({ onContinueAsGuest }: LoginScreenProps) {
  const { login, continueAsGuest } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  // Lockout countdown displayed to the user (seconds remaining).
  // Driven by the persisted User.lockedUntil field rather than a local counter
  // so that a page-refresh cannot reset the lockout (B-07 fix).
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const config = getConfig();
  const usingSupabaseAuth = shouldUseSupabaseAuth();
  const hasLocalAccounts = getUsers().length > 0;
  const showNoLocalAccountsHint = !usingSupabaseAuth && !hasLocalAccounts;

  // ─── On mount: pre-fill remembered username & check persisted lockout ─────
  useEffect(() => {
    const timer = setTimeout(() => {
      const active = document.activeElement;
      if (!active || active === document.body) {
        usernameInputRef.current?.focus();
      }
    }, 50);

    const savedUsername = localStorage.getItem(STORAGE_KEYS.REMEMBERED_USER);
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
      // Check if this user is already locked in the persisted store
      syncLockoutFromStore(savedUsername);
    }

    return () => clearTimeout(timer);
  }, []);

  // ─── Tick the lockout countdown every second ──────────────────────────────
  useEffect(() => {
    if (lockoutSecondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setLockoutSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [lockoutSecondsLeft]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  /**
   * Read the persisted User record for `uname` and, if it is currently locked,
   * seed the countdown with the remaining seconds.
   */
  function syncLockoutFromStore(uname: string) {
    try {
      const users = getUsers();
      const found = users.find(
        (u) => u.username.toLowerCase() === uname.trim().toLowerCase(),
      );
      if (found && isUserLocked(found as any)) {
        const msLeft = new Date((found as any).lockedUntil!).getTime() - Date.now();
        setLockoutSecondsLeft(Math.max(1, Math.ceil(msLeft / 1000)));
      }
    } catch {
      // storage unavailable — ignore
    }
  }

  const isLockedOut = lockoutSecondsLeft > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    // When user changes the username field, re-check persisted lockout for
    // the new name so the countdown appears immediately if they're locked.
    if (lockoutSecondsLeft <= 0) {
      syncLockoutFromStore(e.target.value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (showNoLocalAccountsHint) {
      setError(
        'No local accounts are configured for this production build. Enable Supabase auth or provision users before signing in.',
      );
      return;
    }

    // Re-sync just before submit in case another tab updated the store
    syncLockoutFromStore(username);
    if (isLockedOut) return;

    setError('');
    setIsLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 250));

    const success = await login(username, password);

    if (success) {
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEYS.REMEMBERED_USER, username);
      } else {
        localStorage.removeItem(STORAGE_KEYS.REMEMBERED_USER);
      }
      setLockoutSecondsLeft(0);
    } else {
      // The AuthContext.login() call already persisted the failed-login state
      // (via recordFailedLogin → setUsers). Re-read to get the up-to-date
      // lockedUntil value and drive the countdown from it.
      try {
        const users = getUsers();
        const found = users.find(
          (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
        );
        if (found && isUserLocked(found as any)) {
          const msLeft = new Date((found as any).lockedUntil!).getTime() - Date.now();
          const sLeft = Math.max(1, Math.ceil(msLeft / 1000));
          setLockoutSecondsLeft(sLeft);
          setError(`Too many failed attempts. Please wait ${sLeft} seconds.`);
        } else if (found && (found as any).failedLoginCount >= 3) {
          const remaining = 5 - ((found as any).failedLoginCount ?? 0);
          setError(
            `Invalid credentials. ${Math.max(0, remaining)} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`,
          );
        } else {
          setError('Invalid username or password.');
        }
      } catch {
        setError('Invalid username or password.');
      }
    }

    setIsLoading(false);
  };

  const handleGuestAccess = () => {
    if (onContinueAsGuest) {
      onContinueAsGuest();
    } else {
      continueAsGuest();
    }
  };

  const handleOpenGuestPortal = () => {
    window.location.hash = '#/guest-portal';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f5f7] to-[#efe7ee] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-[#4A1942] px-6 py-8 text-white text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo url={config.logoUrl} size="lg" />
          </div>
          <h1 className="text-2xl font-semibold">
            {config.venueName || 'Seven Paths Manor'}
          </h1>
          <p className="mt-2 text-sm text-white/85">
            {config.tagline || 'Where Your Love Story Unfolds'}
          </p>
          <p className="mt-1 text-xs text-white/70">
            Wedding Layout Planner
            {config.location ? ` • ${config.location}` : ''}
          </p>
        </div>

        <div className="px-6 py-6">
          <div className="mb-5 space-y-3">
            <div className={`rounded-xl border px-4 py-3 text-sm ${
              usingSupabaseAuth
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : showNoLocalAccountsHint
                  ? 'border-blue-200 bg-blue-50 text-blue-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}>
              <p className="font-semibold">
                {usingSupabaseAuth
                  ? 'Secure venue sign-in is enabled.'
                  : showNoLocalAccountsHint
                    ? 'Production access requires backend setup.'
                    : 'Local workspace sign-in is active.'}
              </p>
              <p className="mt-1 text-xs opacity-90">
                {usingSupabaseAuth
                  ? 'Venue teams and couples should sign in here to access protected planning tools.'
                  : showNoLocalAccountsHint
                    ? 'Use Supabase auth for real production access, or provision accounts before publishing this workspace.'
                    : 'Best for demos, QA, and local planning workshops.'}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">Choose your entry point</p>
              <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
                <li>• <strong>Venue teams & couples:</strong> sign in to manage layouts, guests, vendors, and timelines.</li>
                <li>• <strong>Planner guests:</strong> continue as a guest to review the workspace without full admin controls.</li>
                <li>• <strong>Wedding guests:</strong> use the Guest Portal for RSVP, schedule, lodging, and directions.</li>
              </ul>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Username
              </label>
              <input
                ref={usernameInputRef}
                id="login-username"
                value={username}
                onChange={handleUsernameChange}
                onKeyDown={handleKeyDown}
                placeholder="Enter username"
                autoComplete="username"
                disabled={isLockedOut}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1942]/20 focus:border-[#4A1942] disabled:bg-gray-100"
                required
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  disabled={isLockedOut}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1942]/20 focus:border-[#4A1942] disabled:bg-gray-100"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 px-3 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {capsLockOn && (
                <p className="mt-1 text-xs text-amber-700">⚠ Caps Lock is on</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Remember me
              </label>

              <button
                type="button"
                onClick={() => setShowPasswordReset(true)}
                disabled={showNoLocalAccountsHint}
                className="text-sm text-[#4A1942] hover:underline disabled:text-gray-400 disabled:no-underline"
              >
                Forgot password?
              </button>
            </div>

            {error && !isLockedOut && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {showNoLocalAccountsHint && !error && (
              <div
                role="status"
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700"
              >
                Local demo accounts are disabled in production bundles. Configure Supabase auth to sign in securely.
              </div>
            )}

            {isLockedOut && (
              <div
                role="alert"
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
              >
                <p className="font-medium">Account temporarily locked</p>
                <p className="text-xs mt-0.5">
                  Too many failed attempts. Retry in{' '}
                  <span className="font-semibold tabular-nums">
                    {lockoutSecondsLeft}s
                  </span>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isLockedOut || showNoLocalAccountsHint}
              className="w-full rounded-lg bg-[#4A1942] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#5b2352] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs uppercase tracking-wide text-gray-400">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGuestAccess}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="block text-sm font-semibold text-gray-800">Continue as Planner Guest</span>
              <span className="mt-1 block text-xs text-gray-500">
                Review the planning workspace without a full account sign-in.
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenGuestPortal}
              className="w-full rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 text-left hover:bg-indigo-100 transition-colors"
            >
              <span className="block text-sm font-semibold text-indigo-800">💍 Open Wedding Guest Portal</span>
              <span className="mt-1 block text-xs text-indigo-700/80">
                RSVP, view the event schedule, check lodging, and get directions.
              </span>
            </button>
          </div>

          <div className="mt-3 text-xs text-gray-500 text-center">
            <p>
              Wedding guests should use the Guest Portal for RSVP, schedule,
              lodging, and directions.
            </p>
          </div>

          <div className="mt-6 text-center text-xs text-gray-500 space-y-1">
            <p>
              © {new Date().getFullYear()} {config.venueName || 'Seven Paths Manor'}
            </p>
            {config.supportEmail && <p>{config.supportEmail}</p>}
            {config.websiteUrl && <p>{config.websiteUrl}</p>}
          </div>
        </div>
      </div>

      {showPasswordReset && (
        <PasswordReset
          onClose={() => setShowPasswordReset(false)}
          onSuccess={() => {
            setShowPasswordReset(false);
            setError('');
          }}
        />
      )}
    </div>
  );
}
