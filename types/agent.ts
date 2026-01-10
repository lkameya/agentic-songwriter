import { z } from 'zod';

// Agent interface (RULE-BASED - pure decision-maker, NO LLM calls)
export interface Agent {
  id: string;
  name: string;
  goal: string;
  tools: Tool[];
  execute(state: StateStore, trace: Trace): Promise<AgentStep>; // Rule-based logic: decides which tools to call based on goal and state
}

// Tool interface
export interface Tool {
  id: string;
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  execute(input: unknown): Promise<unknown>;
}

// Orchestrator interface (MODEL-AGNOSTIC - all methods use rule-based logic, NO LLM calls)
export interface Orchestrator {
  maxSteps: number;
  maxToolCalls: number;
  allowedTools: string[];
  stateStore: StateStore;
  trace: Trace;
  humanInTheLoop?: (step: AgentStep) => Promise<boolean>;
  
  run(agent: Agent, initialInput: unknown): Promise<OrchestratorResult>;
  plan(agent: Agent, state: StateStore): Promise<Plan>; // Rule-based: analyzes agent goal and state to determine next action
  act(agent: Agent, plan: Plan): Promise<Action>; // Rule-based: executes tool calls from plan
  observe(action: Action): Promise<Observation>; // Rule-based: captures tool output from state
  reflect(state: StateStore, observation: Observation): Promise<Reflection>; // Rule-based: evaluates if goal achieved using state/observation
}

// StateStore interface
export interface StateStore {
  artifacts: Map<string, unknown>;
  metadata: Record<string, unknown>;
  
  get(key: string): unknown | undefined;
  set(key: string, value: unknown): void;
  getAll(): Record<string, unknown>;
  clear(): void;
}

// TraceEvent interface
export interface TraceEvent {
  id: string;
  timestamp: number;
  type: 'plan' | 'act' | 'observe' | 'reflect' | 'tool_call' | 'agent_step';
  agentId?: string;
  toolId?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Trace interface
export interface Trace {
  events: TraceEvent[];
  add(event: TraceEvent): void;
  getAll(): TraceEvent[];
  getByType(type: TraceEvent['type']): TraceEvent[];
}

// Supporting types
export interface AgentStep {
  agentId: string;
  plan: Plan;
  actions: Action[];
  observations: Observation[];
  reflection?: Reflection;
}

export interface Plan {
  steps: string[];
  reasoning: string;
}

export interface Action {
  type: 'tool_call';
  toolId: string;
  input: unknown;
}

export interface Observation {
  actionId: string;
  output: unknown;
  success: boolean;
  error?: string;
}

export interface Reflection {
  shouldContinue: boolean;
  reasoning: string;
  nextStep?: string;
}

export interface OrchestratorResult {
  success: boolean;
  finalState: Record<string, unknown>;
  trace: TraceEvent[];
  error?: string;
}
