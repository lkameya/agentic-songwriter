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

interface ProgressUpdate {
  phase: 'planning' | 'acting' | 'observing' | 'reflecting' | 'tool_call' | 'complete' | 'error';
  message: string;
  toolId?: string;
  iterationCount?: number;
}

interface ApprovalRequest {
  approvalId: string;
  toolId: string;
  output: SongStructure; // The generated content
}

export default function Home() {
  const [lyrics, setLyrics] = useState('');
  const [emotion, setEmotion] = useState('');
  const [genre, setGenre] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);
    setProgressHistory([]);

    try {
      const response = await fetch('/api/run/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lyrics,
          emotion,
          genre: genre || undefined,
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
                console.log('[Client] Received approval_required event:', { approvalId: data.approvalId, toolId: data.toolId });
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
    if (!approvalRequest) {
      console.error('No approval request to handle');
      return;
    }

    if (isSubmittingApproval) {
      console.warn('Approval already being submitted, ignoring duplicate click');
      return;
    }

    setIsSubmittingApproval(true);
    const approvalId = approvalRequest.approvalId;
    const decisionToSend = decision === 'regenerate_with_feedback' ? 'regenerate' : decision;
    const feedbackToSend = decision === 'regenerate_with_feedback' ? feedback.trim() : undefined;
    
    console.log('[Client] Preparing to send approval decision:', { 
      approvalId, 
      decision: decisionToSend, 
      hasFeedback: !!feedbackToSend,
      feedbackLength: feedbackToSend?.length || 0,
      currentApprovalRequest: approvalRequest ? { approvalId: approvalRequest.approvalId, toolId: approvalRequest.toolId } : null
    });

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
        console.error('[Client] Approval response error:', data);
        throw new Error(data.error || 'Failed to send approval');
      }

      console.log('[Client] Approval sent successfully:', data);
      setApprovalRequest(null);
      setFeedback(''); // Clear feedback after sending
    } catch (err) {
      console.error('[Client] Error sending approval:', err);
      setError(err instanceof Error ? err.message : 'Failed to send approval');
      // Don't clear approvalRequest on error - let user try again
    } finally {
      setIsSubmittingApproval(false);
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
          <p className="form-hint">
            When enabled, the agent will pause before each action and wait for your approval to continue.
          </p>
        </div>

        <button type="submit" disabled={loading || approvalRequest !== null} className="submit-button">
          {loading ? 'Generating...' : 'Generate Draft'}
        </button>
      </form>

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
              ✓ Approve & Continue
            </button>
            {feedback.trim() ? (
              <button
                onClick={() => handleApproval('regenerate_with_feedback')}
                className="regenerate-with-feedback-button"
                disabled={isSubmittingApproval}
              >
                🔄 Regenerate with Feedback
              </button>
            ) : (
              <button
                onClick={() => handleApproval('regenerate')}
                className="regenerate-button"
                disabled={isSubmittingApproval}
              >
                🔄 Regenerate
              </button>
            )}
            <button
              onClick={() => handleApproval('reject')}
              className="reject-button"
              disabled={isSubmittingApproval}
            >
              ✗ Reject & Stop
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
