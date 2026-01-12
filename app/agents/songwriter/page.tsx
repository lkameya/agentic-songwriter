'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CreativeBrief } from '@/lib/agent/schemas/creative-brief';
import { SongStructure } from '@/lib/agent/schemas/song-structure';
import { LyricsEvaluation } from '@/lib/agent/schemas/evaluation';

interface RunResponse {
  success: boolean;
  creativeBrief: CreativeBrief | null;
  songStructure: SongStructure | null;
  evaluation: LyricsEvaluation | null;
  iterationCount: number;
  trace: unknown[];
  error?: string;
}

interface ProgressUpdate {
  phase: 'planning' | 'acting' | 'observing' | 'reflecting' | 'tool_call' | 'complete' | 'error';
  message: string;
  toolId?: string;
  iterationCount?: number;
}

interface ApprovalRequest {
  approvalId: string;
  toolId: string;
  output: SongStructure;
}

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

export default function SongwriterAgent() {
  const [lyrics, setLyrics] = useState('');
  const [emotion, setEmotion] = useState('');
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState<'en' | 'pt-BR'>('en');
  const [enableHumanInLoop, setEnableHumanInLoop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [progressHistory, setProgressHistory] = useState<ProgressUpdate[]>([]);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [songHistory, setSongHistory] = useState<SavedSong[]>([]);
  const [selectedSong, setSelectedSong] = useState<SavedSong | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);
    setProgressHistory([]);

    try {
      const response = await fetch('/api/agents/songwriter/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lyrics,
          emotion,
          genre: genre || undefined,
          language,
          enableHumanInLoop,
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
              } else if (data.type === 'approval_required') {
                setApprovalRequest({
                  approvalId: data.approvalId,
                  toolId: data.toolId,
                  output: data.output as SongStructure,
                });
                setProgress({ phase: 'observing', message: 'Waiting for your approval of generated content...' });
              } else if (data.type === 'approval_received') {
                const message = data.decision === 'approve' 
                  ? 'Content approved, continuing...' 
                  : data.decision === 'regenerate'
                  ? 'Regenerating content...'
                  : 'Content rejected, stopping...';
                setProgress({
                  phase: data.decision === 'approve' ? 'observing' : data.decision === 'reject' ? 'complete' : 'tool_call',
                  message,
                });
                setApprovalRequest(null);
              } else if (data.type === 'approval_error') {
                setError(data.error || 'Approval request failed');
                setApprovalRequest(null);
                setLoading(false);
              } else if (data.type === 'complete') {
                setResult({
                  success: true,
                  creativeBrief: data.creativeBrief,
                  songStructure: data.songStructure,
                  evaluation: data.evaluation,
                  iterationCount: data.iterationCount,
                  trace: data.trace,
                });
                setProgress({ phase: 'complete', message: 'Complete!' });
                setLoading(false);
                return;
              } else if (data.type === 'saved') {
                fetchSongHistory();
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
      setApprovalRequest(null);
    }
  };

  const handleApproval = async (decision: 'approve' | 'reject' | 'regenerate' | 'regenerate_with_feedback') => {
    if (!approvalRequest || isSubmittingApproval) return;

    setIsSubmittingApproval(true);
    const approvalId = approvalRequest.approvalId;
    const decisionToSend = decision === 'regenerate_with_feedback' ? 'regenerate' : decision;
    const feedbackToSend = decision === 'regenerate_with_feedback' ? feedback.trim() : undefined;

    try {
      const response = await fetch('/api/approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvalId,
          decision: decisionToSend,
          feedback: feedbackToSend,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send approval');
      }

      setApprovalRequest(null);
      setFeedback('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send approval');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const fetchSongHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/songs?limit=50&sortBy=createdAt&order=desc');
      const data = await response.json();
      if (data.success) {
        setSongHistory(data.songs);
      }
    } catch (err) {
      console.error('Error fetching song history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSongHistory();
  }, []);

  const handleViewSong = async (songId: string) => {
    try {
      const response = await fetch(`/api/songs/${songId}`);
      const data = await response.json();
      if (data.success) {
        setSelectedSong(data.song);
        setResult({
          success: true,
          creativeBrief: data.song.creativeBrief,
          songStructure: data.song.songStructure,
          evaluation: data.song.evaluation,
          iterationCount: data.song.iterationCount,
          trace: data.song.trace || [],
        });
        setTimeout(() => {
          document.querySelector('.results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } catch (err) {
      console.error('Error fetching song:', err);
      setError(err instanceof Error ? err.message : 'Failed to load song');
    }
  };

  const handleDeleteSong = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this song?')) return;
    try {
      const response = await fetch(`/api/songs/${songId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setSongHistory((prev) => prev.filter((song) => song.id !== songId));
        if (selectedSong?.id === songId) {
          setSelectedSong(null);
          setResult(null);
        }
      }
    } catch (err) {
      console.error('Error deleting song:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete song');
    }
  };

  const handleExportJSON = (song: SavedSong, e: React.MouseEvent) => {
    e.stopPropagation();
    const dataStr = JSON.stringify(song, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${song.songStructure.title || 'song'}-${song.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportTXT = (song: SavedSong, e: React.MouseEvent) => {
    e.stopPropagation();
    let txt = `${song.songStructure.title || 'Untitled Song'}\n`;
    txt += `${'='.repeat(50)}\n\n`;
    txt += `Input: ${song.inputEmotion}${song.inputGenre ? ` (${song.inputGenre})` : ''}\n`;
    txt += `Generated: ${new Date(song.createdAt).toLocaleDateString()}\n`;
    if (song.qualityScore !== null) {
      txt += `Quality Score: ${song.qualityScore}/10\n`;
    }
    txt += `Iterations: ${song.iterationCount}/3\n\n`;
    txt += `${'='.repeat(50)}\n\n`;
    
    song.songStructure.sections
      .sort((a, b) => a.order - b.order)
      .forEach((section) => {
        txt += `[${section.type.toUpperCase()}]\n`;
        txt += `${section.content}\n\n`;
      });
    
    const dataBlob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${song.songStructure.title || 'song'}-${song.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="container">
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Back to Dashboard
        </Link>
      </div>
      
      <h1>Songwriter Agent</h1>
      <p className="subtitle">Create lyrics and song structures from emotions and themes</p>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="lyrics">Storyline:</label>
          <textarea
            id="lyrics"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="Enter your storyline or instructions for the song..."
            rows={6}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="emotion">Emotion:</label>
          <input
            id="emotion"
            type="text"
            value={emotion}
            onChange={(e) => setEmotion(e.target.value)}
            placeholder="e.g., happy, sad, love, angry"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="genre">Genre (optional):</label>
          <select
            id="genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          >
            <option value="">None</option>
            <option value="pop">Pop</option>
            <option value="rock">Rock</option>
            <option value="ballad">Ballad</option>
            <option value="country">Country</option>
            <option value="jazz">Jazz</option>
            <option value="electronic">Electronic</option>
            <option value="hip-hop">Hip-Hop</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="language">Output Language:</label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'en' | 'pt-BR')}
            disabled={loading}
          >
            <option value="en">English</option>
            <option value="pt-BR">Português (Brasil)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enableHumanInLoop}
              onChange={(e) => setEnableHumanInLoop(e.target.checked)}
              disabled={loading}
            />
            <span>Enable Human-in-the-Loop (approve each step)</span>
          </label>
        </div>

        <button type="submit" disabled={loading || approvalRequest !== null} className="submit-button">
          <span>{loading ? 'Generating...' : 'Generate Draft'}</span>
        </button>
      </form>

      <div className="history-section">
        <button
          onClick={() => {
            setShowHistory(!showHistory);
            if (!showHistory) {
              fetchSongHistory();
            }
          }}
          className="history-toggle"
        >
          <span>{showHistory ? 'Hide' : 'Show'} History ({songHistory.length})</span>
        </button>

        {showHistory && (
          <div className="history-list">
            {loadingHistory ? (
              <p className="history-empty">Loading history...</p>
            ) : songHistory.length === 0 ? (
              <p className="history-empty">No songs in history yet. Generate your first song!</p>
            ) : (
              <ul className="history-items">
                {songHistory.map((song) => (
                  <li
                    key={song.id}
                    className={`history-item ${selectedSong?.id === song.id ? 'history-item-selected' : ''}`}
                    onClick={() => handleViewSong(song.id)}
                  >
                    <div className="history-item-header">
                      <h4 className="history-item-title">
                        {song.songStructure.title || 'Untitled Song'}
                      </h4>
                      <div className="history-item-actions">
                        <button
                          onClick={(e) => handleExportTXT(song, e)}
                          className="history-action-button"
                          title="Export as TXT"
                        >
                          📄
                        </button>
                        <button
                          onClick={(e) => handleExportJSON(song, e)}
                          className="history-action-button"
                          title="Export as JSON"
                        >
                          💾
                        </button>
                        <button
                          onClick={(e) => handleDeleteSong(song.id, e)}
                          className="history-action-button history-action-delete"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="history-item-meta">
                      <span className="history-item-emotion">{song.inputEmotion}</span>
                      {song.inputGenre && (
                        <span className="history-item-genre">• {song.inputGenre}</span>
                      )}
                      {song.qualityScore !== null && (
                        <span className="history-item-score">• {song.qualityScore.toFixed(1)}/10</span>
                      )}
                      <span className="history-item-date">
                        • {new Date(song.createdAt).toLocaleDateString()}
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

      {approvalRequest && (
        <div className="approval-box">
          <h3>🎵 Review Generated Content</h3>
          <p className="approval-message">
            {approvalRequest.toolId === 'generate-song-structure' 
              ? 'Please review the generated song structure below:'
              : 'Please review the improved song structure below:'}
          </p>
          
          <div className="approval-content">
            {approvalRequest.output && (
              <div className="approval-song-structure">
                <h4 className="song-title-preview">{approvalRequest.output.title}</h4>
                <div className="sections-preview">
                  {approvalRequest.output.sections
                    .sort((a, b) => a.order - b.order)
                    .map((section, idx) => (
                      <div key={idx} className="section-preview">
                        <div className="section-header-preview">
                          <span className="section-type-preview">{section.type.toUpperCase()}</span>
                          <span className="section-order-preview">Order: {section.order}</span>
                        </div>
                        <div className="section-content-preview">{section.content}</div>
                      </div>
                    ))}
                </div>
                <p className="section-count-preview">Total Sections: {approvalRequest.output.totalSections}</p>
              </div>
            )}
          </div>

          <div className="approval-feedback-section">
            <label htmlFor="feedback-input" className="feedback-label">
              Suggestions/Feedback (optional - for regeneration):
            </label>
            <textarea
              id="feedback-input"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="E.g., 'Make the chorus more emotional', 'Add more imagery', 'Change the tone to be more hopeful'..."
              rows={4}
              className="feedback-input"
            />
          </div>

          <div className="approval-buttons">
            <button
              onClick={() => handleApproval('approve')}
              className="approve-button"
              disabled={isSubmittingApproval}
            >
              <span>Approve</span>
            </button>
            {feedback.trim() ? (
              <button
                onClick={() => handleApproval('regenerate_with_feedback')}
                className="regenerate-with-feedback-button"
                disabled={isSubmittingApproval}
              >
                <span>Regenerate with Feedback</span>
              </button>
            ) : (
              <button
                onClick={() => handleApproval('regenerate')}
                className="regenerate-button"
                disabled={isSubmittingApproval}
              >
                <span>Regenerate</span>
              </button>
            )}
            <button
              onClick={() => handleApproval('reject')}
              className="reject-button"
              disabled={isSubmittingApproval}
            >
              <span>Reject</span>
            </button>
          </div>
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

      {result && result.success && (
        <div className="results">
          {result.creativeBrief && (
            <section className="result-section">
              <h2>Creative Brief</h2>
              <div className="brief-display">
                <p><strong>Emotion:</strong> {result.creativeBrief.emotion}</p>
                <p><strong>Mood:</strong> {result.creativeBrief.mood}</p>
                {result.creativeBrief.genre && (
                  <p><strong>Genre:</strong> {result.creativeBrief.genre}</p>
                )}
                <p><strong>Themes:</strong> {result.creativeBrief.themes.join(', ')}</p>
                {result.creativeBrief.tempo && (
                  <p><strong>Tempo:</strong> {result.creativeBrief.tempo}</p>
                )}
                {result.creativeBrief.style && (
                  <p><strong>Style:</strong> {result.creativeBrief.style}</p>
                )}
              </div>
            </section>
          )}

          {result.songStructure && (
            <section className="result-section">
              <h2>Song Structure</h2>
              <h3 className="song-title">{result.songStructure.title}</h3>
              <div className="sections">
                {result.songStructure.sections
                  .sort((a, b) => a.order - b.order)
                  .map((section, idx) => (
                    <div key={idx} className="section">
                      <div className="section-header">
                        <span className="section-type">{section.type.toUpperCase()}</span>
                        <span className="section-order">Order: {section.order}</span>
                      </div>
                      <div className="section-content">{section.content}</div>
                    </div>
                  ))}
              </div>
              <p className="section-count">Total Sections: {result.songStructure.totalSections}</p>
            </section>
          )}

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

                <p className="improvement-status">
                  <strong>Needs Improvement:</strong>{' '}
                  <span className={result.evaluation.needsImprovement ? 'status-yes' : 'status-no'}>
                    {result.evaluation.needsImprovement ? 'Yes' : 'No'}
                  </span>
                </p>
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
            <button
              onClick={() => setShowTrace(!showTrace)}
              className="trace-toggle"
            >
              <span>{showTrace ? 'Hide' : 'Show'} Trace</span>
            </button>
            {showTrace && (
              <pre className="trace-display">
                {JSON.stringify(result.trace, null, 2)}
              </pre>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
