import { StateStore } from '../state-store';

describe('StateStore', () => {
  let store: StateStore;

  beforeEach(() => {
    store = new StateStore();
  });

  describe('get/set', () => {
    it('should store and retrieve artifacts', () => {
      store.set('testKey', 'testValue');
      expect(store.get('testKey')).toBe('testValue');
    });

    it('should return undefined for non-existent keys', () => {
      expect(store.get('nonExistent')).toBeUndefined();
    });

    it('should overwrite existing values', () => {
      store.set('key', 'value1');
      store.set('key', 'value2');
      expect(store.get('key')).toBe('value2');
    });

    it('should handle different data types', () => {
      store.set('string', 'value');
      store.set('number', 42);
      store.set('boolean', true);
      store.set('object', { key: 'value' });
      store.set('array', [1, 2, 3]);

      expect(store.get('string')).toBe('value');
      expect(store.get('number')).toBe(42);
      expect(store.get('boolean')).toBe(true);
      expect(store.get('object')).toEqual({ key: 'value' });
      expect(store.get('array')).toEqual([1, 2, 3]);
    });
  });

  describe('getAll', () => {
    it('should return all artifacts as object', () => {
      store.set('key1', 'value1');
      store.set('key2', 'value2');
      const all = store.getAll();
      expect(all).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should return empty object when no artifacts', () => {
      expect(store.getAll()).toEqual({});
    });

    it('should return a new object (not reference)', () => {
      store.set('key', 'value');
      const all1 = store.getAll();
      const all2 = store.getAll();
      expect(all1).toEqual(all2);
      expect(all1).not.toBe(all2); // Different objects
    });
  });

  describe('clear', () => {
    it('should clear all artifacts and metadata', () => {
      store.set('key', 'value');
      store.setMetadata('meta', 'data');
      store.clear();
      expect(store.get('key')).toBeUndefined();
      expect(store.getMetadata('meta')).toBeUndefined();
      expect(store.getAll()).toEqual({});
      expect(store.getAllMetadata()).toEqual({});
    });
  });

  describe('metadata', () => {
    it('should store and retrieve metadata', () => {
      store.setMetadata('test', 'value');
      expect(store.getMetadata('test')).toBe('value');
    });

    it('should return undefined for non-existent metadata', () => {
      expect(store.getMetadata('nonExistent')).toBeUndefined();
    });

    it('should return all metadata', () => {
      store.setMetadata('key1', 'value1');
      store.setMetadata('key2', 'value2');
      const all = store.getAllMetadata();
      expect(all).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should overwrite existing metadata', () => {
      store.setMetadata('key', 'value1');
      store.setMetadata('key', 'value2');
      expect(store.getMetadata('key')).toBe('value2');
    });

    it('should return a new object for getAllMetadata (not reference)', () => {
      store.setMetadata('key', 'value');
      const meta1 = store.getAllMetadata();
      const meta2 = store.getAllMetadata();
      expect(meta1).toEqual(meta2);
      expect(meta1).not.toBe(meta2); // Different objects
    });
  });

  describe('artifacts vs metadata separation', () => {
    it('should keep artifacts and metadata separate', () => {
      store.set('artifactKey', 'artifactValue');
      store.setMetadata('metadataKey', 'metadataValue');

      expect(store.get('artifactKey')).toBe('artifactValue');
      expect(store.get('metadataKey')).toBeUndefined();
      expect(store.getMetadata('metadataKey')).toBe('metadataValue');
      expect(store.getMetadata('artifactKey')).toBeUndefined();
    });
  });
});
