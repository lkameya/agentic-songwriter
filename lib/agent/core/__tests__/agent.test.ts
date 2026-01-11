import { Agent } from '../agent';
import { Tool } from '../tool';
import { StateStore } from '../state-store';
import { Trace } from '../trace';
import { AgentStep } from '@/types/agent';
import { z } from 'zod';

// Create concrete implementations for testing
class TestTool extends Tool {
  id = 'test-tool';
  name = 'TestTool';
  description = 'A test tool';
  inputSchema = z.object({ value: z.string() });
  outputSchema = z.object({ result: z.string() });

  protected async executeInternal(): Promise<unknown> {
    return { result: 'test' };
  }
}

class TestAgent extends Agent {
  id = 'test-agent';
  name = 'TestAgent';
  goal = 'Test goal';
  tools: Tool[] = [new TestTool()];

  async execute(state: StateStore, trace: Trace): Promise<AgentStep> {
    return {
      agentId: this.id,
      plan: { steps: [], reasoning: 'test' },
      actions: [],
      observations: [],
    };
  }
}

describe('Agent', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent();
  });

  describe('findTool', () => {
    it('should find tool by id', () => {
      // Access protected method via bracket notation for testing
      const tool = (agent as any).findTool('test-tool');
      
      expect(tool).toBeDefined();
      expect(tool?.id).toBe('test-tool');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = (agent as any).findTool('non-existent');
      expect(tool).toBeUndefined();
    });

    it('should find tool when agent has multiple tools', () => {
      class MultiToolAgent extends Agent {
        id = 'multi-tool-agent';
        name = 'MultiToolAgent';
        goal = 'Test';
        tools: Tool[] = [
          new TestTool(),
          new (class extends Tool {
            id = 'tool-2';
            name = 'Tool2';
            description = 'Tool 2';
            inputSchema = z.object({});
            outputSchema = z.object({});
            protected async executeInternal(): Promise<unknown> { return {}; }
          })(),
        ];
        async execute(): Promise<AgentStep> {
          return { agentId: this.id, plan: { steps: [], reasoning: '' }, actions: [], observations: [] };
        }
      }

      const multiAgent = new MultiToolAgent();
      const tool1 = (multiAgent as any).findTool('test-tool');
      const tool2 = (multiAgent as any).findTool('tool-2');
      const tool3 = (multiAgent as any).findTool('non-existent');

      expect(tool1?.id).toBe('test-tool');
      expect(tool2?.id).toBe('tool-2');
      expect(tool3).toBeUndefined();
    });
  });

  describe('properties', () => {
    it('should have correct id, name, and goal', () => {
      expect(agent.id).toBe('test-agent');
      expect(agent.name).toBe('TestAgent');
      expect(agent.goal).toBe('Test goal');
    });

    it('should have tools array', () => {
      expect(agent.tools).toBeDefined();
      expect(Array.isArray(agent.tools)).toBe(true);
      expect(agent.tools.length).toBe(1);
      expect(agent.tools[0].id).toBe('test-tool');
    });
  });

  describe('execute', () => {
    it('should return an AgentStep', async () => {
      const stateStore = new StateStore();
      const trace = new Trace();
      
      const step = await agent.execute(stateStore, trace);
      
      expect(step).toBeDefined();
      expect(step.agentId).toBe('test-agent');
      expect(step.plan).toBeDefined();
      expect(step.actions).toBeDefined();
      expect(step.observations).toBeDefined();
    });
  });
});
