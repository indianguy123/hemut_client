'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { xhrPost, XHRError } from '@/lib/xhr';
import { API } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import styles from './auth.module.css';

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

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);

    try {
      const { promise } = xhrPost<AuthResponse>(API.LOGIN, {
        username: username.trim(),
        password,
      });

      const response = await promise;
      login(response.data.access_token, response.data.user);
      router.push('/chat');
    } catch (err) {
      const xhrErr = err as XHRError;
      if (xhrErr.type === 'http' && xhrErr.status === 401) {
        setError('Invalid username or password');
      } else if (xhrErr.type === 'network') {
        setError('Cannot connect to server. Please try again.');
      } else {
        const resp = xhrErr.response as Record<string, string> | undefined;
        setError(resp?.detail || 'Login failed. Please try again.');
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
            <svg width="48" height="48" viewBox="0 0 40 40" fill="none">
              <path d="M14 24L20 8L22 8L18 20L26 20L20 36L18 36L22 24L14 24Z" fill="#FFD33B" />
            </svg>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 600, color: 'white', marginLeft: '8px' }}>Hemut</span>
          </div>
          <h1 className={styles.authTitle}>Welcome back</h1>
          <p className={styles.authSubtitle}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.authForm} id="login-form">
          {error && (
            <div className={styles.errorBanner} role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
              </svg>
              {error}
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label htmlFor="login-username" className={styles.label}>Username</label>
            <input
              id="login-username"
              type="text"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              disabled={isLoading}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="login-password" className={styles.label}>Password</label>
            <input
              id="login-password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading}
            id="login-submit"
          >
            {isLoading ? (
              <span className={styles.buttonSpinner} />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className={styles.authFooter}>
          Don&apos;t have an account?{' '}
          <Link href="/register" className={styles.authLink}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
