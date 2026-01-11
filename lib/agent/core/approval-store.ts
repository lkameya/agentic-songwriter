/**
 * In-memory store for managing human-in-the-loop approvals.
 * Maps approval request IDs to promise resolvers.
 */
interface ApprovalData {
  decision: 'approve' | 'reject' | 'regenerate';
  feedback?: string;
}

class ApprovalStore {
  private pendingApprovals: Map<string, {
    resolve: (data: ApprovalData) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = new Map();
  
  private approvalData: Map<string, ApprovalData> = new Map();

  private readonly TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout

  /**
   * Create a new approval request and return a promise that resolves when approved/rejected/regenerated.
   */
  createApprovalRequest(requestId: string): Promise<ApprovalData> {
    // Clean up old requests first (but don't remove the current one)
    this.cleanup();

    // Check if this request already exists (shouldn't happen, but be defensive)
    if (this.pendingApprovals.has(requestId)) {
      console.warn(`[ApprovalStore] Request ${requestId} already exists, removing old one`);
      this.pendingApprovals.delete(requestId);
    }

    console.log(`[ApprovalStore] Creating approval request: ${requestId}`);
    
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      
      // Store the promise resolvers BEFORE returning
      this.pendingApprovals.set(requestId, {
        resolve,
        reject,
        timestamp,
      });

      console.log(`[ApprovalStore] Approval request ${requestId} stored. Total pending: ${this.pendingApprovals.size}`);

      // Set timeout to auto-reject if no response
      setTimeout(() => {
        if (this.pendingApprovals.has(requestId)) {
          console.warn(`[ApprovalStore] Approval request ${requestId} timed out after ${this.TIMEOUT}ms`);
          this.pendingApprovals.delete(requestId);
          reject(new Error('Approval request timed out'));
        }
      }, this.TIMEOUT);
    });
  }

  /**
   * Resolve an approval request with user's decision and optional feedback.
   */
  resolveApproval(requestId: string, decision: 'approve' | 'reject' | 'regenerate', feedback?: string): boolean {
    console.log(`[ApprovalStore] resolveApproval called for: ${requestId}, decision: ${decision}`);
    console.log(`[ApprovalStore] Current pending approvals:`, Array.from(this.pendingApprovals.keys()));
    
    const approval = this.pendingApprovals.get(requestId);
    if (!approval) {
      console.error(`[ApprovalStore] Approval request ${requestId} not found in pendingApprovals.`);
      console.error(`[ApprovalStore] Available keys:`, Array.from(this.pendingApprovals.keys()));
      console.error(`[ApprovalStore] Request might have been resolved already or never created.`);
      return false; // Request not found or already resolved
    }

    const approvalData: ApprovalData = {
      decision,
      feedback: feedback?.trim() || undefined,
    };

    console.log(`[ApprovalStore] Resolving approval ${requestId} with:`, approvalData);

    // Store the data temporarily (though it's not really needed after resolution)
    this.approvalData.set(requestId, approvalData);

    // Delete BEFORE resolving to prevent double resolution
    this.pendingApprovals.delete(requestId);
    approval.resolve(approvalData);
    console.log(`[ApprovalStore] Successfully resolved approval ${requestId}`);
    return true;
  }

  /**
   * Get approval data for a request ID (before it's resolved).
   */
  getApprovalData(requestId: string): ApprovalData | undefined {
    return this.approvalData.get(requestId);
  }

  /**
   * Get all pending approval IDs (for debugging).
   */
  getPendingIds(): string[] {
    return Array.from(this.pendingApprovals.keys());
  }

  /**
   * Check if an approval request exists.
   */
  hasRequest(requestId: string): boolean {
    return this.pendingApprovals.has(requestId);
  }

  /**
   * Clean up expired requests.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [id, approval] of this.pendingApprovals.entries()) {
      if (now - approval.timestamp > this.TIMEOUT) {
        this.pendingApprovals.delete(id);
        approval.reject(new Error('Approval request expired'));
      }
    }
  }
}

// Singleton instance - use a global variable to ensure it's truly shared across Next.js routes
// In Next.js, module singletons might not be shared across different contexts
declare global {
  var __approvalStore: ApprovalStore | undefined;
}

// Use global variable in development, create new instance in production (or use a shared store like Redis)
const approvalStore = globalThis.__approvalStore || new ApprovalStore();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__approvalStore = approvalStore;
}

export { approvalStore };
