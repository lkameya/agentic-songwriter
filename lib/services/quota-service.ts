import { prisma } from '@/lib/db/prisma';
import { QuotaExceededError } from '@/lib/errors/quota-errors';

/**
 * Context for quota tracking
 */
export interface QuotaContext {
  userId?: string; // For authenticated users
  sessionId?: string; // For guest users
}

/**
 * Quota service for tracking and enforcing API usage limits
 * 
 * Rules:
 * - Same limit for all users: 5 drafts per day
 * - Resets at midnight UTC
 * - Quota tracked per day (not rolling 24h window)
 * - Mock mode (USE_MOCK_LLM=true) bypasses quota checks
 */
export class QuotaService {
  private readonly DEFAULT_LIMIT = 5;

  /**
   * Get or create usage record for today
   */
  private async getOrCreateUsageRecord(context: QuotaContext): Promise<{
    id: string;
    requestsUsed: number;
    requestsLimit: number;
  }> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Start of day in UTC

    // Ensure exactly one of userId or sessionId is set
    if (context.userId && context.sessionId) {
      throw new Error('Cannot specify both userId and sessionId');
    }
    if (!context.userId && !context.sessionId) {
      throw new Error('Must specify either userId or sessionId');
    }

    // Try to find existing record
    let usage = context.userId
      ? await prisma.usage.findUnique({
          where: {
            userId_date: {
              userId: context.userId,
              date: today,
            },
          },
        })
      : await prisma.usage.findUnique({
          where: {
            sessionId_date: {
              sessionId: context.sessionId!,
              date: today,
            },
          },
        });

    // Create if doesn't exist
    if (!usage) {
      usage = await prisma.usage.create({
        data: {
          userId: context.userId || null,
          sessionId: context.sessionId || null,
          date: today,
          requestsUsed: 0,
          requestsLimit: this.DEFAULT_LIMIT,
        },
      });
    }

    return {
      id: usage.id,
      requestsUsed: usage.requestsUsed,
      requestsLimit: usage.requestsLimit,
    };
  }

  /**
   * Check if user/session has quota available
   * @throws QuotaExceededError if quota is exceeded
   */
  async checkQuota(context: QuotaContext): Promise<void> {
    // Skip quota checks in mock mode
    if (process.env.USE_MOCK_LLM === 'true') {
      return;
    }

    const usage = await this.getOrCreateUsageRecord(context);

    if (usage.requestsUsed >= usage.requestsLimit) {
      throw new QuotaExceededError(
        usage.requestsLimit,
        usage.requestsUsed
      );
    }
  }

  /**
   * Increment quota usage after successful LLM call
   */
  async incrementQuota(context: QuotaContext): Promise<void> {
    // Skip quota increment in mock mode
    if (process.env.USE_MOCK_LLM === 'true') {
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Start of day in UTC

    // Ensure exactly one of userId or sessionId is set
    if (context.userId && context.sessionId) {
      throw new Error('Cannot specify both userId and sessionId');
    }
    if (!context.userId && !context.sessionId) {
      throw new Error('Must specify either userId or sessionId');
    }

    // Increment usage (create if doesn't exist)
    if (context.userId) {
      await prisma.usage.upsert({
        where: {
          userId_date: {
            userId: context.userId,
            date: today,
          },
        },
        create: {
          userId: context.userId,
          sessionId: null,
          date: today,
          requestsUsed: 1,
          requestsLimit: this.DEFAULT_LIMIT,
        },
        update: {
          requestsUsed: {
            increment: 1,
          },
        },
      });
    } else {
      await prisma.usage.upsert({
        where: {
          sessionId_date: {
            sessionId: context.sessionId!,
            date: today,
          },
        },
        create: {
          userId: null,
          sessionId: context.sessionId!,
          date: today,
          requestsUsed: 1,
          requestsLimit: this.DEFAULT_LIMIT,
        },
        update: {
          requestsUsed: {
            increment: 1,
          },
        },
      });
    }
  }

  /**
   * Get current quota status for user/session
   */
  async getQuotaStatus(context: QuotaContext): Promise<{
    used: number;
    limit: number;
    remaining: number;
  }> {
    // Skip quota checks in mock mode
    if (process.env.USE_MOCK_LLM === 'true') {
      return {
        used: 0,
        limit: this.DEFAULT_LIMIT,
        remaining: this.DEFAULT_LIMIT,
      };
    }

    const usage = await this.getOrCreateUsageRecord(context);

    return {
      used: usage.requestsUsed,
      limit: usage.requestsLimit,
      remaining: Math.max(0, usage.requestsLimit - usage.requestsUsed),
    };
  }
}

// Export singleton instance
export const quotaService = new QuotaService();
