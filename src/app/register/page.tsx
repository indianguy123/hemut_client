'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { xhrPost, XHRError } from '@/lib/xhr';
import { API } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import styles from '../login/auth.module.css';

interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    username: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    status: string;
  };
}

function getPasswordStrength(password: string): { level: number; label: string } {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Weak' };
  if (score <= 2) return { level: 2, label: 'Fair' };
  if (score <= 3) return { level: 3, label: 'Good' };
  return { level: 4, label: 'Strong' };
}

const strengthClasses = ['', 'weak', 'fair', 'good', 'strong'];

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!username.trim() || username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('Username can only contain letters, numbers, hyphens, and underscores');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { promise } = xhrPost<AuthResponse>(API.REGISTER, {
        username: username.trim(),
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      });

      const response = await promise;
      login(response.data.access_token, response.data.user);
      router.push('/chat');
    } catch (err) {
      const xhrErr = err as XHRError;
      if (xhrErr.type === 'http' && xhrErr.status === 409) {
        setError('Username or email already taken');
      } else if (xhrErr.type === 'network') {
        setError('Cannot connect to server. Please try again.');
      } else {
        const resp = xhrErr.response as Record<string, string> | undefined;
        setError(resp?.detail || 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authBackground}>
        <div className={styles.bgOrb1} />
        <div className={styles.bgOrb2} />
        <div className={styles.bgOrb3} />
      </div>

      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <div className={styles.logo}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#logo-grad2)" />
              <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="logo-grad2" x1="0" y1="0" x2="40" y2="40">
                  <stop stopColor="#5b6eea" />
                  <stop offset="1" stopColor="#7c4dff" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className={styles.authTitle}>Create an account</h1>
          <p className={styles.authSubtitle}>Join your logistics team on Hemut</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.authForm} id="register-form">
          {error && (
            <div className={styles.errorBanner} role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
              </svg>
              {error}
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label htmlFor="register-username" className={styles.label}>Username</label>
            <input
              id="register-username"
              type="text"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rajesh_dispatch"
              autoComplete="username"
              disabled={isLoading}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="register-email" className={styles.label}>Email</label>
            <input
              id="register-email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              disabled={isLoading}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="register-display-name" className={styles.label}>Display Name</label>
            <input
              id="register-display-name"
              type="text"
              className={styles.input}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Rajesh Kumar"
              disabled={isLoading}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="register-password" className={styles.label}>Password</label>
            <input
              id="register-password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              disabled={isLoading}
            />
            {password && (
              <>
                <div className={styles.passwordStrength}>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`${styles.strengthBar} ${i <= passwordStrength.level ? `${styles.active} ${styles[strengthClasses[passwordStrength.level]]}` : ''}`}
                    />
                  ))}
                </div>
                <span className={styles.strengthLabel}>{passwordStrength.label}</span>
              </>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="register-confirm-password" className={styles.label}>Confirm Password</label>
            <input
              id="register-confirm-password"
              type="password"
              className={styles.input}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              autoComplete="new-password"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading}
            id="register-submit"
          >
            {isLoading ? (
              <span className={styles.buttonSpinner} />
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p className={styles.authFooter}>
          Already have an account?{' '}
          <Link href="/login" className={styles.authLink}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
