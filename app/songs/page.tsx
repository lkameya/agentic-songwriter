'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { SongStructure } from '@/lib/agent/schemas/song-structure';
import { CreativeBrief } from '@/lib/agent/schemas/creative-brief';
import { LyricsEvaluation } from '@/lib/agent/schemas/evaluation';

interface SavedSong {
  id: string;
  title: string | null;
  inputLyrics: string;
  inputEmotion: string;
  inputGenre: string | null;
  creativeBrief: CreativeBrief | null;
  songStructure: SongStructure;
  evaluation: LyricsEvaluation | null;
  trace: unknown[] | null;
  iterationCount: number;
  qualityScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export default function SongsPage() {
  const { data: session, status } = useSession();
  const [songs, setSongs] = useState<SavedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSongs();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  const fetchSongs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/songs?limit=100&sortBy=createdAt&order=desc');
      const data = await response.json();
      if (data.success) {
        setSongs(data.songs);
      } else {
        setError(data.error || 'Failed to fetch songs');
      }
    } catch (err) {
      console.error('Error fetching songs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch songs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (songId: string) => {
    if (!confirm('Are you sure you want to delete this song?')) return;
    
    setDeletingId(songId);
    try {
      const response = await fetch(`/api/songs/${songId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setSongs((prev) => prev.filter((song) => song.id !== songId));
      } else {
        setError(data.error || 'Failed to delete song');
      }
    } catch (err) {
      console.error('Error deleting song:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete song');
    } finally {
      setDeletingId(null);
    }
  };

  if (status === 'loading') {
    return (
      <main className="container">
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <main className="container">
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '3rem 0' }}>
          <h1>Your Songs</h1>
          <p className="subtitle" style={{ marginBottom: '3rem' }}>
            Sign in to view and manage your saved songs
          </p>
          <button
            onClick={() => signIn('google')}
            className="submit-button"
            style={{ marginBottom: '1rem' }}
          >
            <span>Sign In with Google</span>
          </button>
          <Link href="/" style={{ display: 'block', marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1>Your Songs</h1>
          <p className="subtitle">Browse and manage your saved songs</p>
        </div>
        <Link href="/" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textDecoration: 'underline' }}>
          ← Back to Dashboard
        </Link>
      </div>

      {error && (
        <div className="error-box" style={{ marginBottom: '2rem' }}>
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <p>Loading songs...</p>
        </div>
      ) : songs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            No songs yet. Generate your first song using the Songwriter Agent!
          </p>
          <Link href="/agents/songwriter" className="submit-button" style={{ display: 'inline-block' }}>
            <span>Go to Songwriter Agent →</span>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {songs.map((song) => (
            <div
              key={song.id}
              style={{
                padding: '1.5rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 500 }}>
                    {song.title || 'Untitled Song'}
                  </h2>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <span>Emotion: {song.inputEmotion}</span>
                    {song.inputGenre && <span>Genre: {song.inputGenre}</span>}
                    {song.qualityScore !== null && (
                      <span>Quality: {song.qualityScore.toFixed(1)}/10</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                    Created: {new Date(song.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link
                    href={`/agents/melody?songId=${song.id}`}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.75rem',
                      fontFamily: 'Space Grotesk, sans-serif',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      textDecoration: 'none',
                      display: 'inline-block',
                    }}
                  >
                    Generate Melody
                  </Link>
                  <button
                    onClick={() => handleDelete(song.id)}
                    disabled={deletingId === song.id}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'transparent',
                      border: '1px solid var(--border-secondary)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontFamily: 'Space Grotesk, sans-serif',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      cursor: deletingId === song.id ? 'not-allowed' : 'pointer',
                      opacity: deletingId === song.id ? 0.5 : 1,
                    }}
                  >
                    {deletingId === song.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
              {song.inputLyrics && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-secondary)' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    {song.inputLyrics.substring(0, 200)}
                    {song.inputLyrics.length > 200 && '...'}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
