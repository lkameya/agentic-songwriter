import { Tool } from '../tool';
import { z } from 'zod';

// Create a concrete implementation for testing
class TestTool extends Tool {
  id = 'test-tool';
  name = 'TestTool';
  description = 'A test tool';
  inputSchema = z.object({ value: z.string() });
  outputSchema = z.object({ result: z.string() });

  protected async executeInternal(input: unknown): Promise<unknown> {
    const { value } = input as { value: string };
    return { result: `processed: ${value}` };
  }
}

// Create a tool with invalid output for testing error handling
class InvalidOutputTool extends Tool {
  id = 'invalid-output-tool';
  name = 'InvalidOutputTool';
  description = 'A tool that returns invalid output';
  inputSchema = z.object({ value: z.string() });
  outputSchema = z.object({ result: z.string() });

  protected async executeInternal(): Promise<unknown> {
    // Return invalid output (missing 'result' field)
    return { wrongField: 'value' };
  }
}

describe('Tool', () => {
  describe('execute', () => {
    it('should validate input and output schemas', async () => {
      const tool = new TestTool();
      const result = await tool.execute({ value: 'test' });
      
      expect(result).toEqual({ result: 'processed: test' });
    });

    it('should throw error for invalid input', async () => {
      const tool = new TestTool();
      
      await expect(tool.execute({ invalid: 'data' })).rejects.toThrow('validation error');
    });

    it('should throw error for missing required input fields', async () => {
      const tool = new TestTool();
      
      await expect(tool.execute({})).rejects.toThrow('validation error');
    });

    it('should throw error if output does not match schema', async () => {
      const tool = new InvalidOutputTool();
      
      await expect(tool.execute({ value: 'test' })).rejects.toThrow('validation error');
    });

    it('should handle async operations', async () => {
      class AsyncTool extends Tool {
        id = 'async-tool';
        name = 'AsyncTool';
        description = 'Async tool';
        inputSchema = z.object({ delay: z.number() });
        outputSchema = z.object({ result: z.string() });

        protected async executeInternal(input: unknown): Promise<unknown> {
          const { delay } = input as { delay: number };
          await new Promise(resolve => setTimeout(resolve, delay));
          return { result: 'done' };
        }
      }

      const tool = new AsyncTool();
      const result = await tool.execute({ delay: 10 });
      
      expect(result).toEqual({ result: 'done' });
    });
  });

  describe('properties', () => {
    it('should have correct id, name, and description', () => {
      const tool = new TestTool();
      
      expect(tool.id).toBe('test-tool');
      expect(tool.name).toBe('TestTool');
      expect(tool.description).toBe('A test tool');
    });

    it('should have input and output schemas', () => {
      const tool = new TestTool();
      
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
    });
  });

  describe('schema validation', () => {
    it('should validate complex input schemas', async () => {
      class ComplexTool extends Tool {
        id = 'complex-tool';
        name = 'ComplexTool';
        description = 'Complex tool';
        inputSchema = z.object({
          name: z.string(),
          age: z.number(),
          email: z.string().email().optional(),
          tags: z.array(z.string()),
        });
        outputSchema = z.object({ success: z.boolean() });

        protected async executeInternal(): Promise<unknown> {
          return { success: true };
        }
      }

      const tool = new ComplexTool();
      
      const validInput = {
        name: 'Test',
        age: 25,
        email: 'test@example.com',
        tags: ['tag1', 'tag2'],
      };

      const result = await tool.execute(validInput);
      expect(result).toEqual({ success: true });
    });

    it('should reject invalid email in input', async () => {
      class EmailTool extends Tool {
        id = 'email-tool';
        name = 'EmailTool';
        description = 'Email tool';
        inputSchema = z.object({ email: z.string().email() });
        outputSchema = z.object({ success: z.boolean() });

        protected async executeInternal(): Promise<unknown> {
          return { success: true };
        }
      }

      const tool = new EmailTool();
      
      await expect(tool.execute({ email: 'invalid-email' })).rejects.toThrow('validation error');
    });
  });
});
