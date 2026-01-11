import { Agent } from '@/lib/agent/core/agent';
import { AgentStep, StateStore, Trace } from '@/types/agent';
import { Tool } from '@/lib/agent/core/tool';
import { SongStructure } from '@/lib/agent/schemas/song-structure';
import { MelodyStructure } from '@/lib/agent/schemas/melody';
import { MelodyEvaluation } from '@/lib/agent/schemas/melody-evaluation';

/**
 * MelodyAgent - Rule-based agent that generates MIDI melodies from song lyrics.
 * Uses deterministic logic to decide which tools to call.
 * NO LLM calls - all decisions are rule-based.
 */
export class MelodyAgent extends Agent {
  id = 'melody-agent';
  name = 'MelodyAgent';
  goal = 'Generate a MIDI melody that matches lyrics rhythm, emotion, and mood through iterative improvement';
  
  tools: Tool[];
  private maxIterations = 3;

  constructor(tools: Tool[]) {
    super();
    this.tools = tools;
  }

  /**
   * Execute the agent's decision logic.
   * Rule-based decision tree with iteration support.
   */
  async execute(state: StateStore, trace: Trace): Promise<AgentStep> {
    const songStructure = state.get('songStructure') as SongStructure | undefined;
    const melodyStructure = state.get('melodyStructure') as MelodyStructure | undefined;
    const evaluation = state.get('evaluation') as MelodyEvaluation | undefined;
    const iterationCount = (state.get('iterationCount') as number) || 0;
    const emotion = state.get('emotion') as string | undefined;
    const mood = state.get('mood') as string | undefined;
    const tempo = state.get('tempo') as number | undefined;
    const key = state.get('key') as string | undefined;
    const timeSignature = state.get('timeSignature') as string | undefined;

    // Decision Tree (rule-based, no LLM):

    // Step 1: Generate initial melody if not exists
    if (!melodyStructure && songStructure) {
      const generateTool = this.findTool('generate-melody');
      if (!generateTool) {
        throw new Error('GenerateMelody tool not found');
      }

      if (!emotion || !mood) {
        throw new Error('Emotion and mood are required for melody generation');
      }

      return {
        agentId: this.id,
        plan: {
          steps: ['GenerateMelody'],
          reasoning: 'Initial melody generation needed from song structure'
        },
        actions: [{
          type: 'tool_call' as const,
          toolId: 'generate-melody',
          input: {
            songStructure,
            emotion,
            mood,
            ...(tempo && { tempo }),
            ...(key && { key }),
            ...(timeSignature && { timeSignature }),
          }
        }],
        observations: [],
      };
    }
    
    // Step 2: Evaluate if melody exists but not evaluated
    if (melodyStructure && !evaluation && songStructure) {
      const evaluateTool = this.findTool('evaluate-melody');
      if (!evaluateTool) {
        throw new Error('EvaluateMelody tool not found');
      }

      return {
        agentId: this.id,
        plan: {
          steps: ['EvaluateMelody'],
          reasoning: 'Melody generated, need to evaluate quality before deciding on improvements'
        },
        actions: [{
          type: 'tool_call' as const,
          toolId: 'evaluate-melody',
          input: { melodyStructure, songStructure }
        }],
        observations: [],
      };
    }
    
    // Step 3: Improve if evaluation shows needs improvement and under max iterations
    if (evaluation && melodyStructure && songStructure) {
      if (evaluation.needsImprovement && iterationCount < this.maxIterations) {
        // Increment iteration count
        const nextIterationCount = iterationCount + 1;
        state.set('iterationCount', nextIterationCount);

        const improveTool = this.findTool('improve-melody');
        if (!improveTool) {
          throw new Error('ImproveMelody tool not found');
        }
        
        return {
          agentId: this.id,
          plan: {
            steps: ['ImproveMelody'],
            reasoning: `Quality ${evaluation.quality}/10 needs improvement. Attempting improvement (iteration ${nextIterationCount}/${this.maxIterations})`
          },
          actions: [{
            type: 'tool_call' as const,
            toolId: 'improve-melody',
            input: { 
              melodyStructure, 
              evaluation,
              songStructure
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
      : 'Melody structure generated';

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
