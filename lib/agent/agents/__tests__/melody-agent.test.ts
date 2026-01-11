import { MelodyAgent } from '../melody-agent';
import { GenerateMelodyTool } from '../../tools/generate-melody';
import { EvaluateMelodyTool } from '../../tools/evaluate-melody';
import { ImproveMelodyTool } from '../../tools/improve-melody';
import { StateStore } from '../../core/state-store';
import { Trace } from '../../core/trace';
import { createMockSongStructure, createMockMelodyStructure } from '@/__tests__/utils/test-helpers';
import { MelodyEvaluation } from '../../schemas/melody-evaluation';

describe('MelodyAgent', () => {
  let agent: MelodyAgent;
  let stateStore: StateStore;
  let trace: Trace;

  beforeEach(() => {
    // Use mock mode for tools
    process.env.USE_MOCK_LLM = 'true';
    
    const generateTool = new GenerateMelodyTool();
    const evaluateTool = new EvaluateMelodyTool();
    const improveTool = new ImproveMelodyTool();
    
    agent = new MelodyAgent([generateTool, evaluateTool, improveTool]);
    stateStore = new StateStore();
    trace = new Trace();
  });

  describe('execute', () => {
    it('should generate initial melody when song structure exists', async () => {
      const mockSongStructure = createMockSongStructure();
      stateStore.set('songStructure', mockSongStructure);
      stateStore.set('emotion', 'happy');
      stateStore.set('mood', 'energetic');

      const step = await agent.execute(stateStore, trace);

      expect(step.agentId).toBe('melody-agent');
      expect(step.actions).toHaveLength(1);
      expect(step.actions[0].type).toBe('tool_call');
      expect(step.actions[0].toolId).toBe('generate-melody');
      expect(step.plan.steps).toContain('GenerateMelody');
    });

    it('should throw error when emotion or mood is missing', async () => {
      const mockSongStructure = createMockSongStructure();
      stateStore.set('songStructure', mockSongStructure);
      // Missing emotion and mood

      await expect(agent.execute(stateStore, trace)).rejects.toThrow('Emotion and mood are required');
    });

    it('should evaluate melody when melody exists but not evaluated', async () => {
      const mockSongStructure = createMockSongStructure();
      const mockMelody = createMockMelodyStructure();

      stateStore.set('songStructure', mockSongStructure);
      stateStore.set('melodyStructure', mockMelody);
      stateStore.set('emotion', 'happy');
      stateStore.set('mood', 'energetic');

      const step = await agent.execute(stateStore, trace);

      expect(step.actions).toHaveLength(1);
      expect(step.actions[0].toolId).toBe('evaluate-melody');
      expect(step.plan.steps).toContain('EvaluateMelody');
    });

    it('should improve melody when evaluation indicates need and within iteration limit', async () => {
      const mockSongStructure = createMockSongStructure();
      const mockMelody = createMockMelodyStructure();
      const mockEvaluation: MelodyEvaluation = {
        quality: 7.0,
        strengths: ['Good'],
        weaknesses: ['Needs work'],
        suggestions: ['Improve'],
        needsImprovement: true,
      };

      stateStore.set('songStructure', mockSongStructure);
      stateStore.set('melodyStructure', mockMelody);
      stateStore.set('evaluation', mockEvaluation);
      stateStore.set('iterationCount', 1);
      stateStore.set('emotion', 'happy');
      stateStore.set('mood', 'energetic');

      const step = await agent.execute(stateStore, trace);

      expect(step.actions).toHaveLength(1);
      expect(step.actions[0].toolId).toBe('improve-melody');
      expect(step.plan.steps).toContain('ImproveMelody');
    });

    it('should stop when evaluation does not need improvement', async () => {
      const mockSongStructure = createMockSongStructure();
      const mockMelody = createMockMelodyStructure();
      const mockEvaluation: MelodyEvaluation = {
        quality: 9.0,
        strengths: ['Excellent'],
        weaknesses: [],
        suggestions: [],
        needsImprovement: false,
      };

      stateStore.set('songStructure', mockSongStructure);
      stateStore.set('melodyStructure', mockMelody);
      stateStore.set('evaluation', mockEvaluation);
      stateStore.set('emotion', 'happy');
      stateStore.set('mood', 'energetic');

      const step = await agent.execute(stateStore, trace);

      expect(step.actions).toHaveLength(0);
      expect(step.plan.reasoning).toContain('acceptable');
    });

    it('should stop when max iterations reached', async () => {
      const mockSongStructure = createMockSongStructure();
      const mockMelody = createMockMelodyStructure();
      const mockEvaluation: MelodyEvaluation = {
        quality: 7.0,
        strengths: ['Good'],
        weaknesses: ['Needs work'],
        suggestions: ['Improve'],
        needsImprovement: true,
      };

      stateStore.set('songStructure', mockSongStructure);
      stateStore.set('melodyStructure', mockMelody);
      stateStore.set('evaluation', mockEvaluation);
      stateStore.set('iterationCount', 3); // Max iterations
      stateStore.set('emotion', 'happy');
      stateStore.set('mood', 'energetic');

      const step = await agent.execute(stateStore, trace);

      expect(step.actions).toHaveLength(0);
      expect(step.plan.reasoning).toContain('Max iterations');
    });

    it('should pass tempo, key, and timeSignature to generate tool when provided', async () => {
      const mockSongStructure = createMockSongStructure();
      stateStore.set('songStructure', mockSongStructure);
      stateStore.set('emotion', 'happy');
      stateStore.set('mood', 'energetic');
      stateStore.set('tempo', 140);
      stateStore.set('key', 'D major');
      stateStore.set('timeSignature', '3/4');

      const step = await agent.execute(stateStore, trace);

      expect(step.actions).toHaveLength(1);
      const actionInput = step.actions[0].input as any;
      expect(actionInput.tempo).toBe(140);
      expect(actionInput.key).toBe('D major');
      expect(actionInput.timeSignature).toBe('3/4');
    });
  });

  describe('properties', () => {
    it('should have correct id, name, and goal', () => {
      expect(agent.id).toBe('melody-agent');
      expect(agent.name).toBe('MelodyAgent');
      expect(agent.goal).toBeDefined();
    });

    it('should have tools', () => {
      expect(agent.tools).toBeDefined();
      expect(agent.tools.length).toBe(3);
    });
  });
});
