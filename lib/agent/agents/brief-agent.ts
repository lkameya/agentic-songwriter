import { Agent } from '@/lib/agent/core/agent';
import { AgentStep, Action, StateStore, Trace } from '@/types/agent';
import { Tool } from '@/lib/agent/core/tool';
import { CreativeBrief, CreativeBriefSchema } from '@/lib/agent/schemas/creative-brief';
import { SongStructure } from '@/lib/agent/schemas/song-structure';
import { LyricsEvaluation } from '@/lib/agent/schemas/evaluation';

/**
 * BriefAgent - Rule-based agent that creates song drafts from lyrics and emotion.
 * Uses deterministic logic to decide which tools to call.
 * NO LLM calls - all decisions are rule-based.
 */
export class BriefAgent extends Agent {
  id = 'brief-agent';
  name = 'BriefAgent';
  goal = 'Create an improved song draft from lyrics, emotion, and optional genre through iterative improvement';
  
  tools: Tool[];
  private maxIterations = 3;

  constructor(tools: Tool[]) {
    super();
    this.tools = tools;
  }

  /**
   * Create CreativeBrief deterministically from raw inputs.
   * Uses rule-based mappings (no LLM).
   */
  private createCreativeBriefDeterministically(inputs: {
    lyrics: string;
    emotion: string;
    genre?: string;
  }): CreativeBrief {
    // Rule-based mapping from emotion to mood
    const emotionToMood: Record<string, string> = {
      'sad': 'melancholic',
      'sadness': 'melancholic',
      'happy': 'upbeat',
      'happiness': 'upbeat',
      'joy': 'upbeat',
      'joyful': 'upbeat',
      'angry': 'intense',
      'anger': 'intense',
      'rage': 'intense',
      'love': 'romantic',
      'loving': 'romantic',
      'romantic': 'romantic',
      'anxious': 'tension',
      'anxiety': 'tension',
      'nervous': 'tension',
      'calm': 'peaceful',
      'peaceful': 'peaceful',
      'serene': 'peaceful',
      'excited': 'energetic',
      'excitement': 'energetic',
      'energetic': 'energetic',
    };

    // Rule-based mapping from emotion to themes
    const emotionToThemes: Record<string, string[]> = {
      'sad': ['loss', 'nostalgia', 'longing', 'sorrow'],
      'sadness': ['loss', 'nostalgia', 'longing', 'sorrow'],
      'happy': ['celebration', 'joy', 'optimism', 'gratitude'],
      'happiness': ['celebration', 'joy', 'optimism', 'gratitude'],
      'joy': ['celebration', 'joy', 'optimism', 'gratitude'],
      'joyful': ['celebration', 'joy', 'optimism', 'gratitude'],
      'angry': ['conflict', 'frustration', 'defiance', 'struggle'],
      'anger': ['conflict', 'frustration', 'defiance', 'struggle'],
      'rage': ['conflict', 'frustration', 'defiance', 'struggle'],
      'love': ['romance', 'connection', 'devotion', 'affection'],
      'loving': ['romance', 'connection', 'devotion', 'affection'],
      'romantic': ['romance', 'connection', 'devotion', 'affection'],
      'anxious': ['uncertainty', 'worry', 'anticipation', 'tension'],
      'anxiety': ['uncertainty', 'worry', 'anticipation', 'tension'],
      'nervous': ['uncertainty', 'worry', 'anticipation', 'tension'],
      'calm': ['peace', 'tranquility', 'acceptance', 'mindfulness'],
      'peaceful': ['peace', 'tranquility', 'acceptance', 'mindfulness'],
      'serene': ['peace', 'tranquility', 'acceptance', 'mindfulness'],
      'excited': ['anticipation', 'adventure', 'possibility', 'enthusiasm'],
      'excitement': ['anticipation', 'adventure', 'possibility', 'enthusiasm'],
      'energetic': ['anticipation', 'adventure', 'possibility', 'enthusiasm'],
    };

    // Rule-based tempo mapping from genre/emotion
    const getTempo = (genre?: string, emotion?: string): 'slow' | 'moderate' | 'fast' | undefined => {
      if (genre) {
        if (['ballad', 'slow', 'ambient'].includes(genre.toLowerCase())) return 'slow';
        if (['rock', 'metal', 'punk', 'electronic', 'dance'].includes(genre.toLowerCase())) return 'fast';
      }
      if (emotion) {
        const lowerEmotion = emotion.toLowerCase();
        if (['sad', 'calm', 'peaceful', 'melancholic'].includes(lowerEmotion)) return 'slow';
        if (['excited', 'energetic', 'angry', 'rage'].includes(lowerEmotion)) return 'fast';
      }
      return 'moderate';
    };

    const emotionLower = inputs.emotion.toLowerCase();
    const mood = emotionToMood[emotionLower] || 'neutral';
    const themes = emotionToThemes[emotionLower] || ['general'];
    const tempo = getTempo(inputs.genre, inputs.emotion);

    return {
      lyrics: inputs.lyrics.trim(),
      emotion: inputs.emotion,
      genre: inputs.genre,
      mood,
      themes,
      tempo,
      style: inputs.genre || undefined,
    };
  }

  /**
   * Execute the agent's decision logic.
   * Rule-based decision tree with iteration support.
   */
  async execute(state: StateStore, trace: Trace): Promise<AgentStep> {
    const initialInput = state.get('initialInput') as { lyrics: string; emotion: string; genre?: string } | undefined;
    const songStructure = state.get('songStructure') as SongStructure | undefined;
    const evaluation = state.get('evaluation') as LyricsEvaluation | undefined;
    const iterationCount = (state.get('iterationCount') as number) || 0;

    // Decision Tree (rule-based, no LLM):

    // Step 1: Generate initial song if not exists
    if (!songStructure && initialInput) {
      const brief = this.createCreativeBriefDeterministically(initialInput);
      
      // Validate brief
      const validatedBrief = CreativeBriefSchema.parse(brief);
      
      // Store in state
      state.set('creativeBrief', validatedBrief);
      
      const generateTool = this.findTool('generate-song-structure');
      if (!generateTool) {
        throw new Error('GenerateSongStructure tool not found');
      }

      return {
        agentId: this.id,
        plan: {
          steps: ['GenerateSongStructure'],
          reasoning: 'Initial song generation needed from creative brief'
        },
        actions: [{
          type: 'tool_call' as const,
          toolId: 'generate-song-structure',
          input: validatedBrief
        }],
        observations: [],
      };
    }
    
    // Step 2: Evaluate if song exists but not evaluated
    if (songStructure && !evaluation) {
      const evaluateTool = this.findTool('evaluate-lyrics');
      if (!evaluateTool) {
        throw new Error('EvaluateLyrics tool not found');
      }

      return {
        agentId: this.id,
        plan: {
          steps: ['EvaluateLyrics'],
          reasoning: 'Song generated, need to evaluate quality before deciding on improvements'
        },
        actions: [{
          type: 'tool_call' as const,
          toolId: 'evaluate-lyrics',
          input: { songStructure }
        }],
        observations: [],
      };
    }
    
    // Step 3: Improve if evaluation shows needs improvement and under max iterations
    if (evaluation && songStructure) {
      if (evaluation.needsImprovement && iterationCount < this.maxIterations) {
        // Increment iteration count
        const nextIterationCount = iterationCount + 1;
        state.set('iterationCount', nextIterationCount);

        const improveTool = this.findTool('improve-lyrics');
        if (!improveTool) {
          throw new Error('ImproveLyrics tool not found');
        }

        // Check if there's user feedback from human-in-the-loop
        const userFeedback = state.get('userFeedback') as string | undefined;
        
        return {
          agentId: this.id,
          plan: {
            steps: ['ImproveLyrics'],
            reasoning: `Quality ${evaluation.quality}/10 needs improvement. Attempting improvement (iteration ${nextIterationCount}/${this.maxIterations})${userFeedback ? ' with user feedback' : ''}`
          },
          actions: [{
            type: 'tool_call' as const,
            toolId: 'improve-lyrics',
            input: { 
              songStructure, 
              evaluation,
              ...(userFeedback && { userFeedback })
            }
          }],
          observations: [],
        };
      }
    }
    
    // Step 4: Done (quality acceptable or max iterations reached)
    const doneReason = evaluation
      ? iterationCount >= this.maxIterations
        ? 'Max iterations reached'
        : `Quality ${evaluation.quality}/10 is acceptable`
      : 'Song structure generated';

    return {
      agentId: this.id,
      plan: {
        steps: [],
        reasoning: doneReason
      },
      actions: [],
      observations: [],
    };
  }
}
