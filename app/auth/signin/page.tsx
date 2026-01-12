'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SignIn() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');

  return (
    <main className="container">
      <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
        <h1>Sign in</h1>
        <p className="subtitle" style={{ marginBottom: '3rem' }}>
          Access your saved songs and generate more drafts
        </p>

        {error && (
          <div style={{
            padding: '1rem',
            marginBottom: '2rem',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-secondary)',
          }}>
            {error === 'OAuthSignin' && 'Error signing in with OAuth provider'}
            {error === 'OAuthCallback' && 'Error in OAuth callback'}
            {error === 'OAuthCreateAccount' && 'Error creating OAuth account'}
            {error === 'EmailCreateAccount' && 'Error creating email account'}
            {error === 'Callback' && 'Error in callback'}
            {error === 'OAuthAccountNotLinked' && 'Account not linked'}
            {error === 'EmailSignin' && 'Error signing in with email'}
            {error === 'CredentialsSignin' && 'Invalid credentials'}
            {error === 'SessionRequired' && 'Session required'}
            {!['OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount', 'EmailCreateAccount', 'Callback', 'OAuthAccountNotLinked', 'EmailSignin', 'CredentialsSignin', 'SessionRequired'].includes(error) && 'An error occurred'}
          </div>
        )}

        <button
          onClick={() => signIn('google', { callbackUrl })}
          className="submit-button"
          style={{ marginBottom: '1.5rem' }}
        >
          <span>Sign in with Google</span>
        </button>

        <button
          onClick={() => router.push('/')}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-secondary)',
            color: 'var(--text-secondary)',
            padding: '1rem 2rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontFamily: 'Space Grotesk, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-primary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-secondary)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          Cancel
        </button>

        <p style={{
          marginTop: '2rem',
          fontSize: '0.8125rem',
          color: 'var(--text-tertiary)',
          lineHeight: '1.6',
        }}>
          By signing in, you can save up to 10 songs and generate 5 drafts per day.
          <br />
          Guest users can generate 5 drafts per day but cannot save songs.
        </p>
      </div>
    </main>
  );
}
