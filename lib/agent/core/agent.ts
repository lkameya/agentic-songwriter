import { Agent as IAgent, AgentStep, StateStore, Trace } from '@/types/agent';
import { Tool } from '@/lib/agent/core/tool';

/**
 * Base abstract class for all agents.
 * Agents are rule-based decision-makers that decide which tools to call.
 */
export abstract class Agent implements IAgent {
  abstract id: string;
  abstract name: string;
  abstract goal: string;
  abstract tools: Tool[];

  /**
   * Execute the agent's decision logic.
   * Agents use rule-based logic to decide which tools to call based on state.
   * @param state - The current state store
   * @param trace - The trace log for recording operations
   * @returns An AgentStep with plan, actions, and observations
   */
  abstract execute(state: StateStore, trace: Trace): Promise<AgentStep>;

  /**
   * Find a tool by ID.
   * @param toolId - The tool ID to find
   * @returns The tool if found, undefined otherwise
   */
  protected findTool(toolId: string): Tool | undefined {
    return this.tools.find(tool => tool.id === toolId);
  }
}
