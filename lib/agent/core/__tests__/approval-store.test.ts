import { approvalStore } from '../approval-store';

describe('ApprovalStore', () => {
  // Clean up after each test
  afterEach(() => {
    // Get all pending IDs and attempt to resolve them to clean up
    const pendingIds = approvalStore.getPendingIds();
    pendingIds.forEach(id => {
      try {
        approvalStore.resolveApproval(id, 'approve');
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
  });

  describe('createApprovalRequest', () => {
    it('should create an approval request and return a promise', async () => {
      const requestId = 'test-request-1';
      const approvalPromise = approvalStore.createApprovalRequest(requestId);
      
      expect(approvalStore.hasRequest(requestId)).toBe(true);
      expect(approvalStore.getPendingIds()).toContain(requestId);

      // Resolve it immediately
      const resolved = approvalStore.resolveApproval(requestId, 'approve');
      expect(resolved).toBe(true);

      const result = await approvalPromise;
      expect(result.decision).toBe('approve');
      expect(result.feedback).toBeUndefined();
    });

    it('should handle regenerate decision with feedback', async () => {
      const requestId = 'test-request-2';
      const approvalPromise = approvalStore.createApprovalRequest(requestId);
      
      const resolved = approvalStore.resolveApproval(requestId, 'regenerate', 'Make it better');
      expect(resolved).toBe(true);

      const result = await approvalPromise;
      expect(result.decision).toBe('regenerate');
      expect(result.feedback).toBe('Make it better');
    });

    it('should handle reject decision', async () => {
      const requestId = 'test-request-3';
      const approvalPromise = approvalStore.createApprovalRequest(requestId);
      
      const resolved = approvalStore.resolveApproval(requestId, 'reject');
      expect(resolved).toBe(true);

      const result = await approvalPromise;
      expect(result.decision).toBe('reject');
    });

    it('should handle approve decision with optional feedback', async () => {
      const requestId = 'test-request-4';
      const approvalPromise = approvalStore.createApprovalRequest(requestId);
      
      const resolved = approvalStore.resolveApproval(requestId, 'approve', 'Looks good!');
      expect(resolved).toBe(true);

      const result = await approvalPromise;
      expect(result.decision).toBe('approve');
      expect(result.feedback).toBe('Looks good!');
    });

    it('should return false when resolving non-existent request', () => {
      const resolved = approvalStore.resolveApproval('non-existent', 'approve');
      expect(resolved).toBe(false);
    });

    it('should handle multiple concurrent requests', async () => {
      const requestId1 = 'test-request-5';
      const requestId2 = 'test-request-6';
      
      const promise1 = approvalStore.createApprovalRequest(requestId1);
      const promise2 = approvalStore.createApprovalRequest(requestId2);

      expect(approvalStore.getPendingIds()).toContain(requestId1);
      expect(approvalStore.getPendingIds()).toContain(requestId2);
      expect(approvalStore.getPendingIds().length).toBeGreaterThanOrEqual(2);

      approvalStore.resolveApproval(requestId1, 'approve');
      approvalStore.resolveApproval(requestId2, 'reject');

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1.decision).toBe('approve');
      expect(result2.decision).toBe('reject');
    });

    it('should trim feedback whitespace', async () => {
      const requestId = 'test-request-7';
      const approvalPromise = approvalStore.createApprovalRequest(requestId);
      
      approvalStore.resolveApproval(requestId, 'regenerate', '  Trimmed feedback  ');

      const result = await approvalPromise;
      expect(result.feedback).toBe('Trimmed feedback');
    });

    it('should handle empty feedback string as undefined', async () => {
      const requestId = 'test-request-8';
      const approvalPromise = approvalStore.createApprovalRequest(requestId);
      
      approvalStore.resolveApproval(requestId, 'approve', '   ');

      const result = await approvalPromise;
      expect(result.feedback).toBeUndefined();
    });
  });

  describe('hasRequest', () => {
    it('should return true for existing request', () => {
      const requestId = 'test-request-9';
      approvalStore.createApprovalRequest(requestId);
      expect(approvalStore.hasRequest(requestId)).toBe(true);
    });

    it('should return false for non-existent request', () => {
      expect(approvalStore.hasRequest('non-existent')).toBe(false);
    });

    it('should return false after request is resolved', async () => {
      const requestId = 'test-request-10';
      const promise = approvalStore.createApprovalRequest(requestId);
      expect(approvalStore.hasRequest(requestId)).toBe(true);

      approvalStore.resolveApproval(requestId, 'approve');
      await promise;

      expect(approvalStore.hasRequest(requestId)).toBe(false);
    });
  });

  describe('getPendingIds', () => {
    it('should return empty array when no pending requests', () => {
      // Clean up any existing requests
      const pendingIds = approvalStore.getPendingIds();
      pendingIds.forEach(id => {
        try {
          approvalStore.resolveApproval(id, 'approve');
        } catch (error) {
          // Ignore
        }
      });

      expect(approvalStore.getPendingIds()).toEqual([]);
    });

    it('should return list of pending request IDs', () => {
      const requestId1 = 'test-request-11';
      const requestId2 = 'test-request-12';
      
      approvalStore.createApprovalRequest(requestId1);
      approvalStore.createApprovalRequest(requestId2);

      const pendingIds = approvalStore.getPendingIds();
      expect(pendingIds).toContain(requestId1);
      expect(pendingIds).toContain(requestId2);
      expect(pendingIds.length).toBeGreaterThanOrEqual(2);
    });
  });
});
