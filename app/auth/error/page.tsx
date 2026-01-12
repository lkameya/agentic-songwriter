'use client';

import { useSearchParams, useRouter } from 'next/navigation';

export default function AuthError() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get('error');

  return (
    <main className="container">
      <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
        <h1>Authentication Error</h1>
        <p className="subtitle" style={{ marginBottom: '3rem' }}>
          Something went wrong during authentication
        </p>

        <div style={{
          padding: '1.5rem',
          marginBottom: '2rem',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-primary)',
          color: 'var(--text-secondary)',
          textAlign: 'left',
        }}>
          <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
            Error: {error || 'Unknown error'}
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
            {error === 'OAuthSignin' && 'Error occurred while signing in with OAuth provider. Please try again.'}
            {error === 'OAuthCallback' && 'Error occurred in OAuth callback. Please try again.'}
            {error === 'OAuthCreateAccount' && 'Error occurred while creating OAuth account. Please try again.'}
            {error === 'EmailCreateAccount' && 'Error occurred while creating email account. Please try again.'}
            {error === 'Callback' && 'Error occurred in callback. Please try again.'}
            {error === 'OAuthAccountNotLinked' && 'This account is not linked. Please sign in with the account you originally used.'}
            {error === 'EmailSignin' && 'Error occurred while signing in with email. Please check your credentials.'}
            {error === 'CredentialsSignin' && 'Invalid credentials. Please check your email and password.'}
            {error === 'SessionRequired' && 'You must be signed in to access this page.'}
            {!['OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount', 'EmailCreateAccount', 'Callback', 'OAuthAccountNotLinked', 'EmailSignin', 'CredentialsSignin', 'SessionRequired'].includes(error || '') && 'An unexpected error occurred. Please try again.'}
          </p>
        </div>

        <button
          onClick={() => router.push('/auth/signin')}
          className="submit-button"
          style={{ marginBottom: '1rem' }}
        >
          <span>Try Again</span>
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
          Go Home
        </button>
      </div>
    </main>
  );
}
