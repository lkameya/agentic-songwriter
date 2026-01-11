import { BriefAgent } from '../brief-agent';
import { GenerateSongStructureTool } from '../../tools/generate-song-structure';
import { EvaluateLyricsTool } from '../../tools/evaluate-lyrics';
import { ImproveLyricsTool } from '../../tools/improve-lyrics';
import { StateStore } from '../../core/state-store';
import { Trace } from '../../core/trace';
import { createMockSongStructure, createMockLyricsEvaluation } from '@/__tests__/utils/test-helpers';

describe('BriefAgent', () => {
  let agent: BriefAgent;
  let stateStore: StateStore;
  let trace: Trace;

  beforeEach(() => {
    // Use mock mode for tools
    process.env.USE_MOCK_LLM = 'true';
    
    const generateTool = new GenerateSongStructureTool();
    const evaluateTool = new EvaluateLyricsTool();
    const improveTool = new ImproveLyricsTool();
    
    agent = new BriefAgent([generateTool, evaluateTool, improveTool]);
    stateStore = new StateStore();
    trace = new Trace();
  });

  describe('execute', () => {
    it('should generate initial song structure when no song exists', async () => {
      stateStore.set('initialInput', {
        lyrics: 'Test lyrics',
        emotion: 'happy',
        genre: 'pop',
        language: 'en',
      });

      const step = await agent.execute(stateStore, trace);

      expect(step.agentId).toBe('brief-agent');
      expect(step.actions).toHaveLength(1);
      expect(step.actions[0].type).toBe('tool_call');
      expect(step.actions[0].toolId).toBe('generate-song-structure');
      expect(step.plan.steps).toContain('GenerateSongStructure');
      expect(step.plan.reasoning).toContain('Initial song generation');
    });

    it('should evaluate song when song structure exists but not evaluated', async () => {
      const mockSongStructure = createMockSongStructure();
      stateStore.set('songStructure', mockSongStructure);
      stateStore.set('initialInput', {
        lyrics: 'Test lyrics',
        emotion: 'happy',
        language: 'en',
      });

      const step = await agent.execute(stateStore, trace);

      expect(step.actions).toHaveLength(1);
      expect(step.actions[0].toolId).toBe('evaluate-lyrics');
      expect(step.plan.steps).toContain('EvaluateLyrics');
    });

    it('should improve song when evaluation indicates need and within iteration limit', async () => {
      const mockSongStructure = createMockSongStructure();
      const mockEvaluation = createMockLyricsEvaluation();
      mockEvaluation.needsImprovement = true;
      mockEvaluation.quality = 7.0;

      stateStore.set('songStructure', mockSongStructure);
      stateStore.set('evaluation', mockEvaluation);
      stateStore.set('iterationCount', 1);
      stateStore.set('initialInput', {
        lyrics: 'Test lyrics',
        emotion: 'happy',
        language: 'en',
      });

      const step = await agent.execute(stateStore, trace);

      expect(step.actions).toHaveLength(1);
      expect(step.actions[0].toolId).toBe('improve-lyrics');
      expect(step.plan.steps).toContain('ImproveLyrics');
    });

    it('should stop when evaluation does not need improvement', async () => {
      const mockSongStructure = createMockSongStructure();
      const mockEvaluation = createMockLyricsEvaluation();
      mockEvaluation.needsImprovement = false;
      mockEvaluation.quality = 9.0;

      stateStore.set('songStructure', mockSongStructure);
      stateStore.set('evaluation', mockEvaluation);
      stateStore.set('initialInput', {
        lyrics: 'Test lyrics',
        emotion: 'happy',
        language: 'en',
      });

      const step = await agent.execute(stateStore, trace);

      expect(step.actions).toHaveLength(0);
      expect(step.plan.reasoning).toContain('acceptable');
    });

    it('should stop when max iterations reached', async () => {
      const mockSongStructure = createMockSongStructure();
      const mockEvaluation = createMockLyricsEvaluation();
      mockEvaluation.needsImprovement = true;

      stateStore.set('songStructure', mockSongStructure);
      stateStore.set('evaluation', mockEvaluation);
      stateStore.set('iterationCount', 3); // Max iterations
      stateStore.set('initialInput', {
        lyrics: 'Test lyrics',
        emotion: 'happy',
        language: 'en',
      });

      const step = await agent.execute(stateStore, trace);

      expect(step.actions).toHaveLength(0);
      expect(step.plan.reasoning).toContain('Max iterations');
    });

    it('should handle language parameter in brief', async () => {
      stateStore.set('initialInput', {
        lyrics: 'Test lyrics',
        emotion: 'happy',
        language: 'pt-BR',
      });

      const step = await agent.execute(stateStore, trace);

      expect(step.actions).toHaveLength(1);
      expect(step.actions[0].toolId).toBe('generate-song-structure');
      
      // Check that language is stored in state
      expect(stateStore.get('language')).toBe('pt-BR');
    });

    it('should create creative brief with all input fields', async () => {
      stateStore.set('initialInput', {
        lyrics: 'Test lyrics',
        emotion: 'happy',
        genre: 'pop',
        language: 'en',
      });

      await agent.execute(stateStore, trace);

      const brief = stateStore.get('creativeBrief');
      expect(brief).toBeDefined();
      
      if (brief) {
        const briefObj = brief as any;
        expect(briefObj.lyrics).toBe('Test lyrics');
        expect(briefObj.emotion).toBe('happy');
        expect(briefObj.genre).toBe('pop');
      }
    });
  });

  describe('properties', () => {
    it('should have correct id, name, and goal', () => {
      expect(agent.id).toBe('brief-agent');
      expect(agent.name).toBe('BriefAgent');
      expect(agent.goal).toBeDefined();
    });

    it('should have tools', () => {
      expect(agent.tools).toBeDefined();
      expect(agent.tools.length).toBe(3);
    });
  });
});
