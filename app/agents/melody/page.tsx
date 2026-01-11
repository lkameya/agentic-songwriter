'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MelodyStructure } from '@/lib/agent/schemas/melody';
import { MelodyEvaluation } from '@/lib/agent/schemas/melody-evaluation';
import { SongStructure } from '@/lib/agent/schemas/song-structure';
import { MelodyPlayer } from '@/app/components/melody-player';

interface ProgressUpdate {
  phase: 'planning' | 'acting' | 'observing' | 'reflecting' | 'tool_call' | 'complete' | 'error';
  message: string;
  toolId?: string;
  iterationCount?: number;
}

interface SavedSong {
  id: string;
  title: string | null;
  songStructure: SongStructure;
}

interface SavedMelody {
  id: string;
  songId: string;
  midiStructure: MelodyStructure;
  tempo: number;
  key: string;
  timeSignature: string;
  qualityScore: number | null;
  iterationCount: number;
  createdAt: string;
}

export default function MelodyAgent() {
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [songs, setSongs] = useState<SavedSong[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [tempo, setTempo] = useState<number>(120);
  const [key, setKey] = useState<string>('');
  const [timeSignature, setTimeSignature] = useState<string>('4/4');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    melodyStructure: MelodyStructure | null;
    evaluation: MelodyEvaluation | null;
    iterationCount: number;
  } | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [progressHistory, setProgressHistory] = useState<ProgressUpdate[]>([]);
  const [melodyHistory, setMelodyHistory] = useState<SavedMelody[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch songs for dropdown
  useEffect(() => {
    const fetchSongs = async () => {
      setLoadingSongs(true);
      try {
        const response = await fetch('/api/songs?limit=100&sortBy=createdAt&order=desc');
        const data = await response.json();
        if (data.success) {
          setSongs(data.songs);
        }
      } catch (err) {
        console.error('Error fetching songs:', err);
      } finally {
        setLoadingSongs(false);
      }
    };
    fetchSongs();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSongId) {
      setError('Please select a song');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);
    setProgressHistory([]);

    try {
      const response = await fetch('/api/agents/melody/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          songId: selectedSongId,
          tempo,
          ...(key && { key }),
          ...(timeSignature && { timeSignature }),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start generation');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                const update: ProgressUpdate = {
                  phase: data.phase,
                  message: data.message,
                  toolId: data.toolId,
                  iterationCount: data.iterationCount,
                };
                setProgress(update);
                setProgressHistory((prev) => [...prev, update]);
              } else if (data.type === 'complete') {
                setResult({
                  melodyStructure: data.melodyStructure,
                  evaluation: data.evaluation,
                  iterationCount: data.iterationCount,
                });
                setProgress({ phase: 'complete', message: 'Complete!' });
                setLoading(false);
                return;
              } else if (data.type === 'saved') {
                fetchMelodyHistory();
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Unknown error');
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setLoading(false);
      setProgress({ phase: 'error', message: 'Error occurred' });
    }
  };

  const fetchMelodyHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/melodies?limit=50&sortBy=createdAt&order=desc${selectedSongId ? `&songId=${selectedSongId}` : ''}`);
      const data = await response.json();
      if (data.success) {
        setMelodyHistory(data.melodies);
      }
    } catch (err) {
      console.error('Error fetching melody history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedSongId) {
      fetchMelodyHistory();
    }
  }, [selectedSongId]);

  const handleDeleteMelody = async (melodyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this melody?')) return;
    try {
      const response = await fetch(`/api/melodies/${melodyId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setMelodyHistory((prev) => prev.filter((m) => m.id !== melodyId));
        if (result && result.melodyStructure) {
          // Clear result if deleted melody was the current one
          const currentMelody = melodyHistory.find(m => m.id === melodyId);
          if (currentMelody) {
            setResult(null);
          }
        }
      }
    } catch (err) {
      console.error('Error deleting melody:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete melody');
    }
  };

  const handleViewMelody = async (melodyId: string) => {
    try {
      const response = await fetch(`/api/melodies/${melodyId}`);
      const data = await response.json();
      if (data.success) {
        setResult({
          melodyStructure: data.melody.midiStructure,
          evaluation: null, // Evaluation not stored separately
          iterationCount: data.melody.iterationCount,
        });
        setTimeout(() => {
          document.querySelector('.results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } catch (err) {
      console.error('Error fetching melody:', err);
      setError(err instanceof Error ? err.message : 'Failed to load melody');
    }
  };

  return (
    <main className="container">
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Back to Dashboard
        </Link>
      </div>
      
      <h1>Melody Agent</h1>
      <p className="subtitle">Generate MIDI melodies that match your lyrics</p>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="song">Select Song:</label>
          <select
            id="song"
            value={selectedSongId}
            onChange={(e) => setSelectedSongId(e.target.value)}
            required
            disabled={loading || loadingSongs}
          >
            <option value="">-- Select a song --</option>
            {songs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.songStructure.title || 'Untitled Song'} ({song.id.substring(0, 8)}...)
              </option>
            ))}
          </select>
          {loadingSongs && <p className="form-hint">Loading songs...</p>}
        </div>

        <div className="form-group">
          <label htmlFor="tempo">Tempo (BPM):</label>
          <input
            id="tempo"
            type="number"
            min="40"
            max="200"
            value={tempo}
            onChange={(e) => setTempo(parseInt(e.target.value) || 120)}
            disabled={loading}
          />
          <p className="form-hint">Beats per minute (40-200)</p>
        </div>

        <div className="form-group">
          <label htmlFor="key">Key (optional):</label>
          <input
            id="key"
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g., C major, A minor"
            disabled={loading}
          />
          <p className="form-hint">Musical key (leave empty for auto-detection)</p>
        </div>

        <div className="form-group">
          <label htmlFor="timeSignature">Time Signature:</label>
          <select
            id="timeSignature"
            value={timeSignature}
            onChange={(e) => setTimeSignature(e.target.value)}
            disabled={loading}
          >
            <option value="4/4">4/4</option>
            <option value="3/4">3/4</option>
            <option value="2/4">2/4</option>
            <option value="6/8">6/8</option>
          </select>
        </div>

        <button type="submit" disabled={loading || !selectedSongId} className="submit-button">
          <span>{loading ? 'Generating...' : 'Generate Melody'}</span>
        </button>
      </form>

      <div className="history-section">
        <button
          onClick={() => {
            setShowHistory(!showHistory);
            if (!showHistory && selectedSongId) {
              fetchMelodyHistory();
            }
          }}
          className="history-toggle"
          disabled={!selectedSongId}
        >
          <span>{showHistory ? 'Hide' : 'Show'} History ({melodyHistory.length})</span>
        </button>

        {showHistory && selectedSongId && (
          <div className="history-list">
            {loadingHistory ? (
              <p className="history-empty">Loading history...</p>
            ) : melodyHistory.length === 0 ? (
              <p className="history-empty">No melodies for this song yet. Generate your first melody!</p>
            ) : (
              <ul className="history-items">
                {melodyHistory.map((melody) => (
                  <li
                    key={melody.id}
                    className="history-item"
                    onClick={() => handleViewMelody(melody.id)}
                  >
                    <div className="history-item-header">
                      <h4 className="history-item-title">
                        Melody ({melody.tempo} BPM, {melody.key}, {melody.timeSignature})
                      </h4>
                      <div className="history-item-actions">
                        <button
                          onClick={(e) => handleDeleteMelody(melody.id, e)}
                          className="history-action-button history-action-delete"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="history-item-meta">
                      {melody.qualityScore !== null && (
                        <span className="history-item-score">• {melody.qualityScore.toFixed(1)}/10</span>
                      )}
                      <span className="history-item-date">
                        • {new Date(melody.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="error-box">
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="loading-box">
          <div className="progress-container">
            {progress && (
              <div className="current-step">
                <div className={`step-icon step-icon-${progress.phase}`}>
                  {progress.phase === 'planning' && '📋'}
                  {progress.phase === 'acting' && '⚙️'}
                  {progress.phase === 'observing' && '👁️'}
                  {progress.phase === 'reflecting' && '🤔'}
                  {progress.phase === 'tool_call' && '🔧'}
                  {progress.phase === 'complete' && '✅'}
                  {progress.phase === 'error' && '❌'}
                </div>
                <div className="step-content">
                  <h3 className="step-phase">
                    {progress.phase === 'planning' && 'Planning'}
                    {progress.phase === 'acting' && 'Acting'}
                    {progress.phase === 'observing' && 'Observing'}
                    {progress.phase === 'reflecting' && 'Reflecting'}
                    {progress.phase === 'tool_call' && 'Tool Execution'}
                    {progress.phase === 'complete' && 'Complete'}
                    {progress.phase === 'error' && 'Error'}
                  </h3>
                  <p className="step-message">{progress.message}</p>
                  {progress.iterationCount !== undefined && (
                    <p className="step-iteration">Iteration {progress.iterationCount}</p>
                  )}
                </div>
              </div>
            )}
            
            {progressHistory.length > 0 && (
              <div className="progress-history">
                <h4>Progress History:</h4>
                <ul className="progress-steps">
                  {progressHistory.slice(-5).map((step, idx) => (
                    <li key={idx} className={`progress-step progress-step-${step.phase}`}>
                      <span className="progress-marker">✓</span>
                      <span className="progress-text">{step.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {result && result.melodyStructure && (
        <div className="results">
          <section className="result-section">
            <h2>Melody Structure</h2>
            <div className="melody-info">
              <p><strong>Tempo:</strong> {result.melodyStructure.tempo} BPM</p>
              <p><strong>Key:</strong> {result.melodyStructure.key}</p>
              <p><strong>Time Signature:</strong> {result.melodyStructure.timeSignature}</p>
              <p><strong>Total Beats:</strong> {result.melodyStructure.totalBeats}</p>
              <p><strong>Tracks:</strong> {result.melodyStructure.tracks.length}</p>
            </div>

            {result.melodyStructure.tracks.map((track, idx) => (
              <div key={idx} className="track-info" style={{ marginTop: '1.5rem' }}>
                <h4>{track.name}{track.instrument ? ` (${track.instrument})` : ''}</h4>
                <p>Notes: {track.notes.length}</p>
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>View Notes</summary>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {track.notes.slice(0, 20).map((note, noteIdx) => (
                      <div key={noteIdx}>
                        Note {note.note}, velocity {note.velocity}, start {note.startTime.toFixed(2)}, duration {note.duration.toFixed(2)}
                      </div>
                    ))}
                    {track.notes.length > 20 && <div>... and {track.notes.length - 20} more notes</div>}
                  </div>
                </details>
              </div>
            ))}
          </section>

          {result.evaluation && (
            <section className="result-section">
              <h2>Evaluation</h2>
              <div className="evaluation-display">
                <div className="quality-score">
                  <span className="score-label">Quality Score:</span>
                  <span className={`score-value score-${Math.floor(result.evaluation.quality)}`}>
                    {result.evaluation.quality}/10
                  </span>
                </div>

                {result.evaluation.strengths.length > 0 && (
                  <div className="evaluation-list">
                    <h4>Strengths:</h4>
                    <ul>
                      {result.evaluation.strengths.map((strength, idx) => (
                        <li key={idx}>{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.evaluation.weaknesses.length > 0 && (
                  <div className="evaluation-list">
                    <h4>Weaknesses:</h4>
                    <ul>
                      {result.evaluation.weaknesses.map((weakness, idx) => (
                        <li key={idx}>{weakness}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.evaluation.suggestions.length > 0 && (
                  <div className="evaluation-list">
                    <h4>Suggestions:</h4>
                    <ul>
                      {result.evaluation.suggestions.map((suggestion, idx) => (
                        <li key={idx}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="result-section">
            <h2>Iteration Info</h2>
            <p className="iteration-count">
              <strong>Improvement Iterations:</strong> {result.iterationCount} / 3
            </p>
          </section>

          <section className="result-section">
            <h2>Audio Playback</h2>
            <MelodyPlayer melody={result.melodyStructure} />
          </section>
        </div>
      )}
    </main>
  );
}
