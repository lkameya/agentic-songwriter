'use client';

import { useState } from 'react';
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

export default function Home() {
  const [lyrics, setLyrics] = useState('');
  const [emotion, setEmotion] = useState('');
  const [genre, setGenre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [showTrace, setShowTrace] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lyrics,
          emotion,
          genre: genre || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate song');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <h1>Agentic Songwriter</h1>
      <p className="subtitle">Create song drafts with AI agents</p>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="lyrics">Lyrics (base):</label>
          <textarea
            id="lyrics"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="Enter your base lyrics here..."
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

        <button type="submit" disabled={loading} className="submit-button">
          {loading ? 'Generating...' : 'Generate Draft'}
        </button>
      </form>

      {error && (
        <div className="error-box">
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="loading-box">
          <p>Generating song draft... This may take a moment.</p>
          <p className="loading-hint">The agent is creating, evaluating, and improving your song.</p>
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
              {showTrace ? 'Hide' : 'Show'} Trace (JSON)
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
