import React, { useState, useEffect } from 'react';
import { getConfig } from '../config';
import { getUsers, setUsers } from '../hooks/useLayoutState';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { createPasswordRecord, createSecretRecord, verifySecret } from '../utils/auth';

interface PasswordResetProps {
  onClose: () => void;
  onSuccess: () => void;
}

type ResetStep = 'request' | 'verify' | 'reset' | 'success';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

interface StoredResetCodeRecord {
  codeHash: string;
  codeSalt: string;
  username: string;
  expiry: string;
}

const PasswordReset: React.FC<PasswordResetProps> = ({ onClose, onSuccess }) => {
  const config = getConfig();

  const [step, setStep] = useState<ResetStep>('request');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [resolvedUsername, setResolvedUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeGenerated, setCodeGenerated] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeExpiry, setCodeExpiry] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [userSecurityQuestion, setUserSecurityQuestion] = useState('');
  const [displayCode, setDisplayCode] = useState('');
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.MODE === 'test';

  useEffect(() => {
    if (!codeExpiry) return;

    const interval = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((codeExpiry.getTime() - Date.now()) / 1000),
      );
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setCodeGenerated(false);
        setError('Verification code has expired. Please request a new one.');
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [codeExpiry]);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const interval = window.setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [resendCooldown]);

  const generateCode = () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return String(100000 + (values[0] % 900000));
  };

  const getPasswordStrength = (password: string): PasswordStrength => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    };

    const score = Object.values(requirements).filter(Boolean).length;

    let label = '';
    let color = '';

    if (score <= 1) {
      label = 'Very Weak';
      color = 'bg-red-500';
    } else if (score === 2) {
      label = 'Weak';
      color = 'bg-orange-500';
    } else if (score === 3) {
      label = 'Fair';
      color = 'bg-yellow-500';
    } else if (score === 4) {
      label = 'Strong';
      color = 'bg-green-500';
    } else {
      label = 'Very Strong';
      color = 'bg-emerald-600';
    }

    return { score, label, color, requirements };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const handleRequestCode = async () => {
    setError('');
    setLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const users = getUsers();
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    const matchedUser = users.find(
      (u) =>
        u.username.toLowerCase() === normalizedUsername ||
        (u.email && u.email.toLowerCase() === normalizedEmail),
    ) as
      | (typeof users[number] & {
          securityQuestion?: string;
          securityAnswer?: string;
        })
      | undefined;

    if (!matchedUser) {
      setError('No account found with that username or email.');
      setLoading(false);
      return;
    }

    setResolvedUsername(matchedUser.username);

    if (matchedUser.securityQuestion) {
      setUserSecurityQuestion(matchedUser.securityQuestion);
    } else {
      setUserSecurityQuestion('');
    }

    const code = generateCode();
    setCodeGenerated(true);
    setDisplayCode(isDemoMode ? code : '');

    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    setCodeExpiry(expiry);
    setTimeRemaining(600);

    const secretRecord = await createSecretRecord(code);

    const storedRecord: StoredResetCodeRecord = {
      codeHash: secretRecord.hash,
      codeSalt: secretRecord.salt,
      username: matchedUser.username,
      expiry: expiry.toISOString(),
    };

    localStorage.setItem(
      STORAGE_KEYS.PASSWORD_RESET_CODE,
      JSON.stringify(storedRecord),
    );

    setLoading(false);
    setStep('verify');
    setResendCooldown(60);
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const code = generateCode();
    setCodeGenerated(true);
    setDisplayCode(isDemoMode ? code : '');

    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    setCodeExpiry(expiry);
    setTimeRemaining(600);

    const secretRecord = await createSecretRecord(code);

    const storedRecord: StoredResetCodeRecord = {
      codeHash: secretRecord.hash,
      codeSalt: secretRecord.salt,
      username: (resolvedUsername || username).trim(),
      expiry: expiry.toISOString(),
    };

    localStorage.setItem(
      STORAGE_KEYS.PASSWORD_RESET_CODE,
      JSON.stringify(storedRecord),
    );

    setResendCooldown(60);
    setVerificationCode('');
    setError('');
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    setError('');

    const stored = localStorage.getItem(STORAGE_KEYS.PASSWORD_RESET_CODE);
    if (!stored) {
      setError('No reset code found. Please request a new one.');
      return;
    }

    const parsed = JSON.parse(stored) as StoredResetCodeRecord;

    if (new Date(parsed.expiry) < new Date()) {
      setError('Verification code has expired. Please request a new one.');
      localStorage.removeItem(STORAGE_KEYS.PASSWORD_RESET_CODE);
      return;
    }

    const valid = await verifySecret(verificationCode, {
      hash: parsed.codeHash,
      salt: parsed.codeSalt,
    });

    if (!valid) {
      setError('Invalid verification code. Please try again.');
      return;
    }

    if (userSecurityQuestion && securityAnswer) {
      const users = getUsers();
      const effectiveUsername = (resolvedUsername || username).trim().toLowerCase();
      const matchedUser = users.find(
        (u) => u.username.toLowerCase() === effectiveUsername,
      ) as
        | (typeof users[number] & {
            securityAnswer?: string;
          })
        | undefined;

      if (
        matchedUser?.securityAnswer &&
        matchedUser.securityAnswer.toLowerCase() !== securityAnswer.toLowerCase()
      ) {
        setError('Incorrect security answer. Please try again.');
        return;
      }
    }

    setStep('reset');
  };

  const handleResetPassword = async () => {
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (passwordStrength.score < 3) {
      setError('Please choose a stronger password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const users = getUsers();
    const storedResetRaw = localStorage.getItem(STORAGE_KEYS.PASSWORD_RESET_CODE);
    const storedReset = storedResetRaw
      ? (JSON.parse(storedResetRaw) as { username?: string })
      : null;

    const effectiveUsername = (
      resolvedUsername ||
      storedReset?.username ||
      username
    )
      .trim()
      .toLowerCase();

    const userIndex = users.findIndex(
      (u) => u.username.toLowerCase() === effectiveUsername,
    );

    if (userIndex === -1) {
      setError('User not found. Please try again.');
      setLoading(false);
      return;
    }

    const passwordRecord = await createPasswordRecord(newPassword);

    (users as any[])[userIndex] = {
      ...users[userIndex],
      password: '',
      ...passwordRecord,
      sessionVersion: (((users[userIndex] as any).sessionVersion) ?? 1) + 1,
      passwordResetCompletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setUsers(users);
    localStorage.removeItem(STORAGE_KEYS.PASSWORD_RESET_CODE);

    setLoading(false);
    setStep('success');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 32px)' }}
      >
        <div
          className="p-4 text-white text-center relative"
          style={{
            background: `linear-gradient(135deg, ${
              config.primaryColor || '#4A1942'
            } 0%, ${config.primaryDark || '#3d1536'} 100%)`,
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
          <div className="text-3xl mb-2">{step === 'success' ? '✅' : '🔐'}</div>
          <h2 className="text-xl font-bold">
            {step === 'request' && 'Reset Your Password'}
            {step === 'verify' && 'Verify Your Identity'}
            {step === 'reset' && 'Create New Password'}
            {step === 'success' && 'Password Reset Complete!'}
          </h2>
          <p className="text-sm opacity-80 mt-1">
            {step === 'request' &&
              'Enter your username or email to receive a reset code'}
            {step === 'verify' && 'Enter the verification code sent to you'}
            {step === 'reset' && 'Choose a strong password to secure your account'}
            {step === 'success' && 'Your password has been successfully updated'}
          </p>
        </div>

        {step !== 'success' && (
          <div className="flex justify-center gap-2 p-3 bg-gray-50 border-b">
            {['request', 'verify', 'reset'].map((s, idx) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    step === s
                      ? 'bg-purple-600 text-white'
                      : ['request', 'verify', 'reset'].indexOf(step) > idx
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {['request', 'verify', 'reset'].indexOf(step) > idx ? '✓' : idx + 1}
                </div>
                {idx < 2 && (
                  <div
                    className={`w-8 h-1 mx-1 rounded ${
                      ['request', 'verify', 'reset'].indexOf(step) > idx
                        ? 'bg-green-500'
                        : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className="p-4 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 250px)' }}
        >
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {step === 'request' && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="password-reset-username"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    👤
                  </span>
                  <input
                    id="password-reset-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-sm text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div>
                <label
                  htmlFor="password-reset-email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    📧
                  </span>
                  <input
                    id="password-reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <strong>💡 How it works:</strong>
                <ol className="mt-1 ml-4 list-decimal space-y-1">
                  <li>Enter your username or email</li>
                  <li>Receive a 6-digit verification code</li>
                  <li>Enter the code to verify your identity</li>
                  <li>Create a new secure password</li>
                </ol>
              </div>

              <button
                onClick={handleRequestCode}
                disabled={loading || (!username && !email)}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                type="button"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Sending Code...
                  </>
                ) : (
                  <>📤 Send Verification Code</>
                )}
              </button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              {isDemoMode && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-800 font-medium mb-1">
                    <span>🔔</span>
                    <span>Demo Mode - Verification Code</span>
                  </div>
                  <div className="text-center">
                    <span className="inline-block px-4 py-2 bg-white border-2 border-amber-300 rounded-lg text-2xl font-mono font-bold tracking-widest text-amber-700">
                      {displayCode || '------'}
                    </span>
                  </div>
                  <p className="text-xs text-amber-600 mt-2 text-center">
                    Demo mode only. Production reset codes must be delivered server-side.
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="password-reset-code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Verification Code
                </label>
                <input
                  id="password-reset-code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </div>

              {userSecurityQuestion && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🔒 Security Question
                  </label>
                  <p className="text-sm text-gray-600 mb-2 italic">
                    "{userSecurityQuestion}"
                  </p>
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Your answer"
                  />
                </div>
              )}

              <div className="text-center">
                <button
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || loading}
                  className="text-sm text-purple-600 hover:text-purple-800 disabled:text-gray-400 transition-colors"
                  type="button"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : '🔄 Resend verification code'}
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('request');
                    setVerificationCode('');
                    setError('');
                  }}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  type="button"
                >
                  ← Back
                </button>
                <button
                  onClick={() => void handleVerifyCode()}
                  disabled={verificationCode.length !== 6}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors"
                  type="button"
                >
                  Verify Code →
                </button>
              </div>
            </div>
          )}

          {step === 'reset' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm flex items-center gap-2">
                <span>✅</span>
                <span>Identity verified! Now create your new password.</span>
              </div>

              <div>
                <label
                  htmlFor="password-reset-new-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    🔒
                  </span>
                  <input
                    id="password-reset-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter new password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {newPassword && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        passwordStrength.score <= 2
                          ? 'text-red-600'
                          : passwordStrength.score === 3
                            ? 'text-yellow-600'
                            : 'text-green-600'
                      }`}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className={passwordStrength.requirements.length ? 'text-green-600' : 'text-gray-400'}>
                      {passwordStrength.requirements.length ? '✓' : '○'} 8+ characters
                    </div>
                    <div className={passwordStrength.requirements.uppercase ? 'text-green-600' : 'text-gray-400'}>
                      {passwordStrength.requirements.uppercase ? '✓' : '○'} Uppercase letter
                    </div>
                    <div className={passwordStrength.requirements.lowercase ? 'text-green-600' : 'text-gray-400'}>
                      {passwordStrength.requirements.lowercase ? '✓' : '○'} Lowercase letter
                    </div>
                    <div className={passwordStrength.requirements.number ? 'text-green-600' : 'text-gray-400'}>
                      {passwordStrength.requirements.number ? '✓' : '○'} Number
                    </div>
                    <div className={passwordStrength.requirements.special ? 'text-green-600' : 'text-gray-400'}>
                      {passwordStrength.requirements.special ? '✓' : '○'} Special character
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="password-reset-confirm-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    🔒
                  </span>
                  <input
                    id="password-reset-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-10 pr-12 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-red-300 focus:border-red-500'
                        : confirmPassword && confirmPassword === newPassword
                          ? 'border-green-300 focus:border-green-500'
                          : 'border-gray-300 focus:border-purple-500'
                    }`}
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                )}
                {confirmPassword && confirmPassword === newPassword && (
                  <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('verify');
                    setNewPassword('');
                    setConfirmPassword('');
                    setError('');
                  }}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  type="button"
                >
                  ← Back
                </button>
                <button
                  onClick={() => void handleResetPassword()}
                  disabled={
                    loading ||
                    !newPassword ||
                    !confirmPassword ||
                    newPassword !== confirmPassword ||
                    passwordStrength.score < 3
                  }
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  type="button"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Updating...
                    </>
                  ) : (
                    <>🔐 Reset Password</>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="space-y-4 text-center">
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-4xl">🎉</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Password Updated!</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Your password has been successfully changed. You can now sign in with your new password.
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                <strong>🔒 Security Tips:</strong>
                <ul className="mt-1 ml-4 list-disc text-left space-y-1">
                  <li>Never share your password with anyone</li>
                  <li>Use a unique password for each account</li>
                  <li>Consider using a password manager</li>
                </ul>
              </div>
              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
                type="button"
              >
                ✓ Return to Sign In
              </button>
            </div>
          )}
        </div>

        {step !== 'success' && (
          <div className="p-3 bg-gray-50 border-t text-center text-xs text-gray-500">
            Need help? Contact{' '}
            <a
              href={`mailto:${config.supportEmail || 'weddings@sevenpathsmanor.com'}`}
              className="text-purple-600 hover:underline"
            >
              {config.supportEmail || 'weddings@sevenpathsmanor.com'}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default PasswordReset;