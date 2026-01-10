import { Trace as ITrace, TraceEvent } from '@/types/agent';

/**
 * Tracing system for recording all agent, orchestrator, and tool operations.
 * Every step in the agent loop is recorded as a structured event.
 */
export class Trace implements ITrace {
  events: TraceEvent[];

  constructor() {
    this.events = [];
  }

  /**
   * Add a trace event to the trace log.
   * @param event - The trace event to add
   */
  add(event: TraceEvent): void {
    this.events.push(event);
  }

  /**
   * Get all trace events.
   * @returns Array of all trace events
   */
  getAll(): TraceEvent[] {
    return [...this.events]; // Return a copy to prevent external mutation
  }

  /**
   * Get trace events filtered by type.
   * @param type - The event type to filter by
   * @returns Array of trace events matching the type
   */
  getByType(type: TraceEvent['type']): TraceEvent[] {
    return this.events.filter(event => event.type === type);
  }

  /**
   * Clear all trace events.
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get the number of trace events.
   * @returns The count of trace events
   */
  size(): number {
    return this.events.length;
  }

  /**
   * Serialize all events to JSON.
   * @returns JSON string representation of all events
   */
  toJSON(): string {
    return JSON.stringify(this.events, null, 2);
  }
}

/**
 * Helper function to create a TraceEvent with automatically generated ID and timestamp.
 * @param options - Event configuration options
 * @returns A new TraceEvent object
 */
export function createTraceEvent(options: {
  type: TraceEvent['type'];
  agentId?: string;
  toolId?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}): TraceEvent {
  return {
    id: generateEventId(),
    timestamp: Date.now(),
    type: options.type,
    agentId: options.agentId,
    toolId: options.toolId,
    input: options.input,
    output: options.output,
    error: options.error,
    metadata: options.metadata,
  };
}

/**
 * Generate a unique event ID.
 * Uses timestamp + random string for uniqueness.
 * @returns Unique event ID string
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
