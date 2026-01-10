import { Tool as ITool } from '@/types/agent';
import { z } from 'zod';

/**
 * Base abstract class for all tools.
 * Provides common validation logic and enforces the Tool interface.
 */
export abstract class Tool implements ITool {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract inputSchema: z.ZodSchema;
  abstract outputSchema: z.ZodSchema;

  /**
   * Execute the tool with input validation and output validation.
   * @param input - The input to the tool (will be validated)
   * @returns The validated output
   * @throws Error if input or output validation fails
   */
  async execute(input: unknown): Promise<unknown> {
    try {
      // Validate input
      const validatedInput = this.inputSchema.parse(input);
      
      // Execute the tool's implementation
      const output = await this.executeInternal(validatedInput);
      
      // Validate output
      const validatedOutput = this.outputSchema.parse(output);
      
      return validatedOutput;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Tool ${this.name} validation error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Internal implementation of the tool.
   * Subclasses must implement this method.
   * @param input - The validated input
   * @returns The raw output (will be validated by execute())
   */
  protected abstract executeInternal(input: unknown): Promise<unknown>;
}
