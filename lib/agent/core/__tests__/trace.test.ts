import { Trace } from '../trace';

describe('Trace', () => {
  let trace: Trace;

  beforeEach(() => {
    trace = new Trace();
  });

  describe('add', () => {
    it('should add trace events', () => {
      const event = {
        type: 'tool_call',
        toolId: 'test-tool',
        timestamp: Date.now(),
        metadata: { input: 'test' },
      };

      trace.add(event);

      const events = trace.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it('should add multiple trace events in order', () => {
      const event1 = {
        type: 'tool_call',
        toolId: 'tool1',
        timestamp: Date.now(),
      };
      const event2 = {
        type: 'tool_call',
        toolId: 'tool2',
        timestamp: Date.now() + 1,
      };

      trace.add(event1);
      trace.add(event2);

      const events = trace.getAll();
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(event1);
      expect(events[1]).toEqual(event2);
    });
  });

  describe('getAll', () => {
    it('should return empty array initially', () => {
      expect(trace.getAll()).toEqual([]);
    });

    it('should return all trace events', () => {
      const event1 = { type: 'tool_call', toolId: 'tool1', timestamp: Date.now() };
      const event2 = { type: 'agent_step', agentId: 'agent1', timestamp: Date.now() };

      trace.add(event1);
      trace.add(event2);

      const events = trace.getAll();
      expect(events).toHaveLength(2);
      expect(events).toEqual([event1, event2]);
    });

    it('should return a new array (not reference)', () => {
      trace.add({ type: 'tool_call', toolId: 'test', timestamp: Date.now() });
      
      const events1 = trace.getAll();
      const events2 = trace.getAll();
      
      expect(events1).toEqual(events2);
      expect(events1).not.toBe(events2); // Different arrays
    });
  });

  describe('clear', () => {
    it('should clear all trace events', () => {
      trace.add({ type: 'tool_call', toolId: 'test', timestamp: Date.now() });
      trace.add({ type: 'agent_step', agentId: 'test', timestamp: Date.now() });

      expect(trace.getAll()).toHaveLength(2);

      trace.clear();

      expect(trace.getAll()).toEqual([]);
    });
  });

  describe('event types', () => {
    it('should handle tool_call events', () => {
      const event = {
        type: 'tool_call',
        toolId: 'generate-song',
        timestamp: Date.now(),
        metadata: { input: { lyrics: 'test' } },
      };

      trace.add(event);
      const events = trace.getAll();

      expect(events[0].type).toBe('tool_call');
      expect(events[0].toolId).toBe('generate-song');
    });

    it('should handle agent_step events', () => {
      const event = {
        type: 'agent_step',
        agentId: 'brief-agent',
        timestamp: Date.now(),
        metadata: { reasoning: 'test' },
      };

      trace.add(event);
      const events = trace.getAll();

      expect(events[0].type).toBe('agent_step');
      expect(events[0].agentId).toBe('brief-agent');
    });
  });
});
