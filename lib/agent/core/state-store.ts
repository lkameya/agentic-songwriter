import { StateStore as IStateStore } from '@/types/agent';

/**
 * In-memory state store for persisting artifacts across agent/orchestrator steps.
 * Separates artifacts (main data) from metadata (auxiliary information).
 */
export class StateStore implements IStateStore {
  artifacts: Map<string, unknown>;
  metadata: Record<string, unknown>;

  constructor() {
    this.artifacts = new Map<string, unknown>();
    this.metadata = {};
  }

  /**
   * Get an artifact by key.
   * @param key - The key to retrieve
   * @returns The artifact value or undefined if not found
   */
  get(key: string): unknown | undefined {
    return this.artifacts.get(key);
  }

  /**
   * Set an artifact by key.
   * @param key - The key to store
   * @param value - The value to store
   */
  set(key: string, value: unknown): void {
    this.artifacts.set(key, value);
  }

  /**
   * Get all artifacts as a plain object.
   * Useful for serialization or returning final state.
   * @returns Record of all artifacts
   */
  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.artifacts.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Clear all artifacts and metadata.
   * Useful for resetting state between runs.
   */
  clear(): void {
    this.artifacts.clear();
    this.metadata = {};
  }

  /**
   * Set metadata (auxiliary information separate from artifacts).
   * @param key - The metadata key
   * @param value - The metadata value
   */
  setMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  /**
   * Get metadata by key.
   * @param key - The metadata key
   * @returns The metadata value or undefined if not found
   */
  getMetadata(key: string): unknown | undefined {
    return this.metadata[key];
  }

  /**
   * Get all metadata.
   * @returns Record of all metadata
   */
  getAllMetadata(): Record<string, unknown> {
    return { ...this.metadata };
  }
}
