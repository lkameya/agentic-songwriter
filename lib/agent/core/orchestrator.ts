import {
  Orchestrator as IOrchestrator,
  Agent,
  Plan,
  Action,
  Observation,
  Reflection,
  AgentStep,
  OrchestratorResult,
  StateStore,
  Trace,
} from '@/types/agent';
import { createTraceEvent } from '@/lib/agent/core/trace';
import { SongStructure } from '@/lib/agent/schemas/song-structure';
import { LyricsEvaluation } from '@/lib/agent/schemas/evaluation';

/**
 * Orchestrator - Model-agnostic control loop that manages the agent execution.
 * Implements plan → act → observe → reflect cycle with iteration support.
 * All methods are RULE-BASED (NO LLM calls).
 */
export class Orchestrator implements IOrchestrator {
  maxSteps: number;
  maxToolCalls: number;
  allowedTools: string[];
  stateStore: StateStore;
  trace: Trace;
  humanInTheLoop?: (toolId: string, output: unknown) => Promise<{
    decision: 'approve' | 'reject' | 'regenerate';
    feedback?: string;
  }>;
  onProgress?: (update: {
    phase: 'planning' | 'acting' | 'observing' | 'reflecting' | 'tool_call' | 'complete' | 'error';
    message: string;
    toolId?: string;
    iterationCount?: number;
  }) => void;
  private maxIterations: number;
  private currentSteps: number = 0;
  private currentToolCalls: number = 0;
  private currentActionId: string = '';
  private currentAgentStep: AgentStep | null = null;
  private currentAgent: Agent | null = null;
  private currentExecutedAction: Action | null = null;

  constructor(config: {
    maxSteps: number;
    maxToolCalls: number;
    allowedTools: string[];
    stateStore: StateStore;
    trace: Trace;
    maxIterations?: number;
    humanInTheLoop?: (toolId: string, output: unknown) => Promise<{
      decision: 'approve' | 'reject' | 'regenerate';
      feedback?: string;
    }>;
    onProgress?: (update: {
      phase: 'planning' | 'acting' | 'observing' | 'reflecting' | 'tool_call' | 'complete' | 'error';
      message: string;
      toolId?: string;
      iterationCount?: number;
    }) => void;
  }) {
    this.maxSteps = config.maxSteps;
    this.maxToolCalls = config.maxToolCalls;
    this.allowedTools = config.allowedTools;
    this.stateStore = config.stateStore;
    this.trace = config.trace;
    this.humanInTheLoop = config.humanInTheLoop;
    this.onProgress = config.onProgress;
    this.maxIterations = config.maxIterations ?? 3;
  }

  /**
   * Main run method that executes the orchestrator loop.
   */
  async run(agent: Agent, initialInput: unknown): Promise<OrchestratorResult> {
    try {
      // Reset counters
      this.currentSteps = 0;
      this.currentToolCalls = 0;

      // Store initial input
      this.stateStore.set('initialInput', initialInput);
      this.onProgress?.({ phase: 'planning', message: 'Initializing agent...' });

      // Main loop: plan → act → observe → reflect
      while (this.currentSteps < this.maxSteps) {
        this.currentSteps++;

        // PLAN: Get agent's decision
        this.onProgress?.({ 
          phase: 'planning', 
          message: `Step ${this.currentSteps}: Planning next action...` 
        });
        this.currentAgent = agent;
        const plan = await this.plan(agent, this.stateStore);
        const agentStep = this.currentAgentStep!; // Set by plan()

        // If no actions, agent is done
        if (agentStep.actions.length === 0) {
          this.trace.add(
            createTraceEvent({
              type: 'agent_step',
              agentId: agent.id,
              metadata: { reason: agentStep.plan.reasoning },
            })
          );
          break;
        }

        // ACT: Execute each action (tool call)
        this.onProgress?.({ 
          phase: 'acting', 
          message: `Executing ${agentStep.actions.length} action(s)...` 
        });
        const observations: Observation[] = [];
        for (const action of agentStep.actions) {
          // Check guardrails
          if (this.currentToolCalls >= this.maxToolCalls) {
            this.onProgress?.({ 
              phase: 'error', 
              message: `Max tool calls (${this.maxToolCalls}) exceeded` 
            });
            return {
              success: false,
              finalState: this.stateStore.getAll(),
              trace: this.trace.getAll(),
              error: `Max tool calls (${this.maxToolCalls}) exceeded`,
            };
          }

          if (!this.allowedTools.includes(action.toolId)) {
            observations.push({
              actionId: action.toolId,
              output: null,
              success: false,
              error: `Tool ${action.toolId} not in allowed tools list`,
            });
            continue;
          }

          try {
            // Execute action: find tool and execute it
            const tool = agent.tools.find(t => t.id === action.toolId);
            if (!tool) {
              throw new Error(`Tool ${action.toolId} not found`);
            }

            // Get friendly tool name
            const toolNames: Record<string, string> = {
              'generate-song-structure': 'Generating Song Structure',
              'evaluate-lyrics': 'Evaluating Lyrics Quality',
              'improve-lyrics': 'Improving Lyrics',
            };
            const toolDisplayName = toolNames[action.toolId] || action.toolId;
            const iterationCount = (this.stateStore.get('iterationCount') as number) || 0;

            // Record tool call start
            this.onProgress?.({ 
              phase: 'tool_call', 
              message: `Running: ${toolDisplayName}...`,
              toolId: action.toolId,
              iterationCount,
            });

            this.trace.add(
              createTraceEvent({
                type: 'tool_call',
                toolId: action.toolId,
                input: action.input,
              })
            );

            // Execute the tool
            let output = await tool.execute(action.input);

            // Human-in-the-loop: Approve the output (for tools that generate content)
            if (this.humanInTheLoop && (action.toolId === 'generate-song-structure' || action.toolId === 'improve-lyrics')) {
              this.onProgress?.({ 
                phase: 'observing', 
                message: `Waiting for approval of generated content...` 
              });
              
              const approvalResult = await this.humanInTheLoop(action.toolId, output);
              
              if (approvalResult.decision === 'reject') {
                this.trace.add(
                  createTraceEvent({
                    type: 'tool_call',
                    toolId: action.toolId,
                    input: action.input,
                    output: output,
                    metadata: { humanRejected: true },
                  })
                );
                return {
                  success: false,
                  finalState: this.stateStore.getAll(),
                  trace: this.trace.getAll(),
                  error: 'Content generation rejected by human-in-the-loop',
                };
              } else if (approvalResult.decision === 'regenerate') {
                // Retry the tool execution with feedback if provided
                this.onProgress?.({ 
                  phase: 'tool_call', 
                  message: approvalResult.feedback 
                    ? `Regenerating with your feedback: ${toolDisplayName}...`
                    : `Regenerating: ${toolDisplayName}...`,
                  toolId: action.toolId,
                });
                
                // Prepare input with feedback if regenerating
                let toolInput = action.input;
                if (approvalResult.feedback) {
                  if (action.toolId === 'improve-lyrics') {
                    toolInput = {
                      ...(action.input as Record<string, unknown>),
                      userFeedback: approvalResult.feedback,
                    };
                  } else if (action.toolId === 'generate-song-structure') {
                    // Pass feedback directly to generate-song-structure tool
                    // Ensure we preserve all CreativeBrief fields
                    const briefInput = action.input as Record<string, unknown>;
                    toolInput = {
                      lyrics: briefInput.lyrics,
                      emotion: briefInput.emotion,
                      mood: briefInput.mood,
                      themes: briefInput.themes,
                      ...(briefInput.genre ? { genre: briefInput.genre } : {}),
                      ...(briefInput.tempo ? { tempo: briefInput.tempo } : {}),
                      ...(briefInput.style ? { style: briefInput.style } : {}),
                      userFeedback: approvalResult.feedback,
                    };
                  }
                }
                
                output = await tool.execute(toolInput);
                
                // Clear feedback after use
                if (action.toolId === 'generate-song-structure') {
                  this.stateStore.set('userFeedback', undefined);
                }
                
                // After regeneration, if human-in-the-loop is enabled, ask for approval again
                // But first, check if we should continue (we already have the regenerated output)
                // For now, we'll approve regenerated content automatically to avoid double approval
                // If the user wants to approve regenerated content, they can enable human-in-the-loop
                // and it will be called again in the next tool execution
                
                this.onProgress?.({ 
                  phase: 'observing', 
                  message: `Regeneration completed: ${toolDisplayName}` 
                });
              } else {
                // approve - continue with current output
                this.onProgress?.({ 
                  phase: 'observing', 
                  message: `Content approved: ${toolDisplayName}` 
                });
              }
            }

            // Record successful tool call
            this.trace.add(
              createTraceEvent({
                type: 'tool_call',
                toolId: action.toolId,
                input: action.input,
                output: output,
              })
            );

            // Store output in state based on tool type (rule-based)
            this.storeToolOutput(action.toolId, output);

            // Store the executed action for act() method
            this.currentExecutedAction = action;

            // Call act() for interface compliance (takes plan, returns action)
            // Note: Tool already executed above, act() just returns the stored action
            const executedAction = await this.act(agent, plan);
            
            // Observe the result
            this.onProgress?.({ 
              phase: 'observing', 
              message: `Capturing output from ${toolDisplayName}...` 
            });
            const observation = await this.observe(executedAction);
            observations.push(observation);
            this.currentToolCalls++;
            
            this.onProgress?.({ 
              phase: 'observing', 
              message: `Completed: ${toolDisplayName}` 
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.trace.add(
              createTraceEvent({
                type: 'tool_call',
                toolId: action.toolId,
                input: action.input,
                error: errorMessage,
              })
            );
            observations.push({
              actionId: action.toolId,
              output: null,
              success: false,
              error: errorMessage,
            });
          }
        }

        // OBSERVE: Already done in act(), but we capture observations
        agentStep.observations = observations;

        // REFLECT: Decide if we should continue
        const iterationCount = (this.stateStore.get('iterationCount') as number) || 0;
        this.onProgress?.({ 
          phase: 'reflecting', 
          message: `Evaluating progress... ${iterationCount > 0 ? `(Iteration ${iterationCount}/${this.maxIterations})` : ''}`,
          iterationCount,
        });
        const lastObservation = observations[observations.length - 1];
        const reflection = await this.reflect(this.stateStore, lastObservation);

        agentStep.reflection = reflection;
        
        if (!reflection.shouldContinue) {
          this.onProgress?.({ 
            phase: 'reflecting', 
            message: `Goal achieved: ${reflection.reasoning}` 
          });
        } else {
          this.onProgress?.({ 
            phase: 'reflecting', 
            message: `Continuing: ${reflection.reasoning}` 
          });
        }

        // Record agent step in trace
        this.trace.add(
          createTraceEvent({
            type: 'agent_step',
            agentId: agent.id,
            input: { plan: agentStep.plan, actions: agentStep.actions },
            output: { observations, reflection },
          })
        );

        // Stop if reflection says so
        if (!reflection.shouldContinue) {
          break;
        }
      }

      // Return result
      this.onProgress?.({ phase: 'complete', message: 'Song generation completed!' });
      return {
        success: true,
        finalState: this.stateStore.getAll(),
        trace: this.trace.getAll(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.onProgress?.({ phase: 'error', message: `Error: ${errorMessage}` });
      this.trace.add(
        createTraceEvent({
          type: 'agent_step',
          error: errorMessage,
        })
      );
      return {
        success: false,
        finalState: this.stateStore.getAll(),
        trace: this.trace.getAll(),
        error: errorMessage,
      };
    }
  }

  /**
   * PLAN: Rule-based - asks agent to decide what to do next.
   */
  async plan(agent: Agent, state: StateStore): Promise<Plan> {
    const agentStep = await agent.execute(state, this.trace);
    this.currentAgentStep = agentStep; // Store for use in run()

    this.trace.add(
      createTraceEvent({
        type: 'plan',
        agentId: agent.id,
        input: { state: state.getAll() },
        output: { plan: agentStep.plan },
        metadata: { steps: agentStep.plan.steps },
      })
    );

    return agentStep.plan;
  }

  /**
   * ACT: Rule-based - returns the action that was executed.
   * Note: Tool execution happens in run() loop before calling this method.
   * This method satisfies the interface contract by returning the executed action.
   */
  async act(agent: Agent, plan: Plan): Promise<Action> {
    // Return the currently executed action (stored during tool execution in run())
    if (!this.currentExecutedAction) {
      throw new Error('No action was executed');
    }
    
    return this.currentExecutedAction;
  }

  /**
   * OBSERVE: Rule-based - captures tool output from state.
   */
  async observe(action: Action): Promise<Observation> {
    // Get output from state (already stored by act())
    const output = this.stateStore.get(this.getStateKeyForTool(action.toolId));
    
    this.trace.add(
      createTraceEvent({
        type: 'observe',
        toolId: action.toolId,
        output: output,
      })
    );
    
    return {
      actionId: action.toolId,
      output: output || null,
      success: output !== undefined && output !== null,
    };
  }

  /**
   * REFLECT: Rule-based - evaluates if goal is achieved with iteration awareness.
   */
  async reflect(state: StateStore, observation: Observation): Promise<Reflection> {
    const songStructure = state.get('songStructure') as SongStructure | undefined;
    const evaluation = state.get('evaluation') as LyricsEvaluation | undefined;
    const iterationCount = (state.get('iterationCount') as number) || 0;

    // Rule-based reflection with iteration awareness:

    // If we have a song but no evaluation, need to evaluate
    if (songStructure && !evaluation) {
      this.trace.add(
        createTraceEvent({
          type: 'reflect',
          output: { shouldContinue: true, nextStep: 'evaluate' },
        })
      );
      return {
        shouldContinue: true,
        reasoning: 'Song generated, need to evaluate quality',
        nextStep: 'evaluate',
      };
    }

    // If evaluated and needs improvement, and under max iterations
    if (evaluation && songStructure) {
      const evaluationResult = evaluation as LyricsEvaluation;
      
      if (evaluationResult.needsImprovement && iterationCount < this.maxIterations) {
        this.trace.add(
          createTraceEvent({
            type: 'reflect',
            output: {
              shouldContinue: true,
              nextStep: 'improve',
              quality: evaluationResult.quality,
              iterationCount: iterationCount + 1,
            },
          })
        );
        return {
          shouldContinue: true,
          reasoning: `Quality ${evaluationResult.quality}/10, attempting improvement (iteration ${iterationCount + 1}/${this.maxIterations})`,
          nextStep: 'improve',
        };
      }

      // If quality is acceptable (8.5+), stop
      if (!evaluationResult.needsImprovement || evaluationResult.quality >= 8.5) {
        this.trace.add(
          createTraceEvent({
            type: 'reflect',
            output: {
              shouldContinue: false,
              reason: 'quality_acceptable',
              quality: evaluationResult.quality,
            },
          })
        );
        return {
          shouldContinue: false,
          reasoning: `Quality ${evaluationResult.quality}/10 is acceptable`,
        };
      }
    }

    // Goal achieved or max iterations reached
    if (iterationCount >= this.maxIterations) {
      this.trace.add(
        createTraceEvent({
          type: 'reflect',
          output: {
            shouldContinue: false,
            reason: 'max_iterations',
            iterationCount,
          },
        })
      );
      return {
        shouldContinue: false,
        reasoning: `Max iterations (${this.maxIterations}) reached`,
      };
    }

    // Default: continue if song structure exists
    if (songStructure) {
      return {
        shouldContinue: false,
        reasoning: 'Song structure generated',
      };
    }

    // Default: continue for initial generation
    this.trace.add(
      createTraceEvent({
        type: 'reflect',
        output: { shouldContinue: true, reason: 'initial_generation' },
      })
    );
    return {
      shouldContinue: true,
      reasoning: 'Initial generation needed',
    };
  }

  /**
   * Store tool output in state based on tool type (rule-based mapping).
   */
  private storeToolOutput(toolId: string, output: unknown): void {
    // Rule-based: determine which state key to use based on tool ID
    if (toolId === 'generate-song-structure') {
      this.stateStore.set('songStructure', output);
    } else if (toolId === 'evaluate-lyrics') {
      this.stateStore.set('evaluation', output);
    } else if (toolId === 'improve-lyrics') {
      // Improved song replaces the old one
      this.stateStore.set('songStructure', output);
      // Clear evaluation so it gets re-evaluated
      this.stateStore.set('evaluation', undefined);
    } else if (toolId === 'generate-melody') {
      this.stateStore.set('melodyStructure', output);
    } else if (toolId === 'evaluate-melody') {
      this.stateStore.set('evaluation', output);
    } else if (toolId === 'improve-melody') {
      // Improved melody replaces the old one
      this.stateStore.set('melodyStructure', output);
      // Clear evaluation so it gets re-evaluated
      this.stateStore.set('evaluation', undefined);
    }
  }

  /**
   * Get state key for a tool (reverse mapping for observe).
   */
  private getStateKeyForTool(toolId: string): string {
    if (toolId === 'generate-song-structure' || toolId === 'improve-lyrics') {
      return 'songStructure';
    } else if (toolId === 'evaluate-lyrics') {
      return 'evaluation';
    } else if (toolId === 'generate-melody' || toolId === 'improve-melody') {
      return 'melodyStructure';
    } else if (toolId === 'evaluate-melody') {
      return 'evaluation';
    }
    return toolId;
  }
}
