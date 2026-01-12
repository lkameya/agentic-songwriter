import { QuotaService, QuotaContext } from '../quota-service';
import { QuotaExceededError } from '@/lib/errors/quota-errors';
import { prisma } from '@/lib/db/prisma';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    usage: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('QuotaService', () => {
  let quotaService: QuotaService;
  const originalEnv = process.env.USE_MOCK_LLM;

  beforeEach(() => {
    quotaService = new QuotaService();
    jest.clearAllMocks();
    // Reset to non-mock mode by default
    process.env.USE_MOCK_LLM = 'false';
  });

  afterEach(() => {
    process.env.USE_MOCK_LLM = originalEnv;
  });

  describe('checkQuota', () => {
    it('should pass when quota is available (authenticated user)', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      mockPrisma.usage.findUnique.mockResolvedValue({
        id: 'usage-1',
        userId: 'user-1',
        sessionId: null,
        date: today,
        requestsUsed: 2,
        requestsLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context: QuotaContext = { userId: 'user-1' };
      await expect(quotaService.checkQuota(context)).resolves.not.toThrow();
    });

    it('should pass when quota is available (guest session)', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      mockPrisma.usage.findUnique.mockResolvedValue({
        id: 'usage-1',
        userId: null,
        sessionId: 'session-1',
        date: today,
        requestsUsed: 3,
        requestsLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context: QuotaContext = { sessionId: 'session-1' };
      await expect(quotaService.checkQuota(context)).resolves.not.toThrow();
    });

    it('should throw QuotaExceededError when quota is exceeded', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      mockPrisma.usage.findUnique.mockResolvedValue({
        id: 'usage-1',
        userId: 'user-1',
        sessionId: null,
        date: today,
        requestsUsed: 5,
        requestsLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context: QuotaContext = { userId: 'user-1' };
      await expect(quotaService.checkQuota(context)).rejects.toThrow(QuotaExceededError);
      await expect(quotaService.checkQuota(context)).rejects.toThrow('Daily quota exceeded: 5/5 requests used');
    });

    it('should create usage record if it does not exist', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // First call: no record exists
      mockPrisma.usage.findUnique.mockResolvedValueOnce(null);
      // Second call: create returns new record
      mockPrisma.usage.create.mockResolvedValue({
        id: 'usage-1',
        userId: 'user-1',
        sessionId: null,
        date: today,
        requestsUsed: 0,
        requestsLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context: QuotaContext = { userId: 'user-1' };
      await expect(quotaService.checkQuota(context)).resolves.not.toThrow();

      expect(mockPrisma.usage.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          sessionId: null,
          date: today,
          requestsUsed: 0,
          requestsLimit: 5,
        },
      });
    });

    it('should bypass quota check in mock mode', async () => {
      process.env.USE_MOCK_LLM = 'true';

      const context: QuotaContext = { userId: 'user-1' };
      await expect(quotaService.checkQuota(context)).resolves.not.toThrow();

      // Should not call Prisma at all
      expect(mockPrisma.usage.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.usage.create).not.toHaveBeenCalled();
    });

    it('should throw error if both userId and sessionId are provided', async () => {
      const context: QuotaContext = { userId: 'user-1', sessionId: 'session-1' };
      await expect(quotaService.checkQuota(context)).rejects.toThrow(
        'Cannot specify both userId and sessionId'
      );
    });

    it('should throw error if neither userId nor sessionId are provided', async () => {
      const context: QuotaContext = {};
      await expect(quotaService.checkQuota(context)).rejects.toThrow(
        'Must specify either userId or sessionId'
      );
    });
  });

  describe('incrementQuota', () => {
    it('should increment quota for authenticated user', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      mockPrisma.usage.upsert.mockResolvedValue({
        id: 'usage-1',
        userId: 'user-1',
        sessionId: null,
        date: today,
        requestsUsed: 1,
        requestsLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context: QuotaContext = { userId: 'user-1' };
      await quotaService.incrementQuota(context);

      expect(mockPrisma.usage.upsert).toHaveBeenCalledWith({
        where: {
          userId_date: {
            userId: 'user-1',
            date: today,
          },
        },
        create: {
          userId: 'user-1',
          sessionId: null,
          date: today,
          requestsUsed: 1,
          requestsLimit: 5,
        },
        update: {
          requestsUsed: {
            increment: 1,
          },
        },
      });
    });

    it('should increment quota for guest session', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      mockPrisma.usage.upsert.mockResolvedValue({
        id: 'usage-1',
        userId: null,
        sessionId: 'session-1',
        date: today,
        requestsUsed: 1,
        requestsLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context: QuotaContext = { sessionId: 'session-1' };
      await quotaService.incrementQuota(context);

      expect(mockPrisma.usage.upsert).toHaveBeenCalledWith({
        where: {
          sessionId_date: {
            sessionId: 'session-1',
            date: today,
          },
        },
        create: {
          userId: null,
          sessionId: 'session-1',
          date: today,
          requestsUsed: 1,
          requestsLimit: 5,
        },
        update: {
          requestsUsed: {
            increment: 1,
          },
        },
      });
    });

    it('should bypass quota increment in mock mode', async () => {
      process.env.USE_MOCK_LLM = 'true';

      const context: QuotaContext = { userId: 'user-1' };
      await quotaService.incrementQuota(context);

      // Should not call Prisma at all
      expect(mockPrisma.usage.upsert).not.toHaveBeenCalled();
    });

    it('should throw error if both userId and sessionId are provided', async () => {
      const context: QuotaContext = { userId: 'user-1', sessionId: 'session-1' };
      await expect(quotaService.incrementQuota(context)).rejects.toThrow(
        'Cannot specify both userId and sessionId'
      );
    });

    it('should throw error if neither userId nor sessionId are provided', async () => {
      const context: QuotaContext = {};
      await expect(quotaService.incrementQuota(context)).rejects.toThrow(
        'Must specify either userId or sessionId'
      );
    });
  });

  describe('getQuotaStatus', () => {
    it('should return quota status for authenticated user', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      mockPrisma.usage.findUnique.mockResolvedValue({
        id: 'usage-1',
        userId: 'user-1',
        sessionId: null,
        date: today,
        requestsUsed: 2,
        requestsLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context: QuotaContext = { userId: 'user-1' };
      const status = await quotaService.getQuotaStatus(context);

      expect(status).toEqual({
        used: 2,
        limit: 5,
        remaining: 3,
      });
    });

    it('should return quota status for guest session', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      mockPrisma.usage.findUnique.mockResolvedValue({
        id: 'usage-1',
        userId: null,
        sessionId: 'session-1',
        date: today,
        requestsUsed: 4,
        requestsLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context: QuotaContext = { sessionId: 'session-1' };
      const status = await quotaService.getQuotaStatus(context);

      expect(status).toEqual({
        used: 4,
        limit: 5,
        remaining: 1,
      });
    });

    it('should create usage record if it does not exist', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      mockPrisma.usage.findUnique.mockResolvedValueOnce(null);
      mockPrisma.usage.create.mockResolvedValue({
        id: 'usage-1',
        userId: 'user-1',
        sessionId: null,
        date: today,
        requestsUsed: 0,
        requestsLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context: QuotaContext = { userId: 'user-1' };
      const status = await quotaService.getQuotaStatus(context);

      expect(status).toEqual({
        used: 0,
        limit: 5,
        remaining: 5,
      });
    });

    it('should return default status in mock mode', async () => {
      process.env.USE_MOCK_LLM = 'true';

      const context: QuotaContext = { userId: 'user-1' };
      const status = await quotaService.getQuotaStatus(context);

      expect(status).toEqual({
        used: 0,
        limit: 5,
        remaining: 5,
      });

      // Should not call Prisma at all
      expect(mockPrisma.usage.findUnique).not.toHaveBeenCalled();
    });

    it('should handle zero remaining quota', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      mockPrisma.usage.findUnique.mockResolvedValue({
        id: 'usage-1',
        userId: 'user-1',
        sessionId: null,
        date: today,
        requestsUsed: 5,
        requestsLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context: QuotaContext = { userId: 'user-1' };
      const status = await quotaService.getQuotaStatus(context);

      expect(status).toEqual({
        used: 5,
        limit: 5,
        remaining: 0,
      });
    });
  });

  describe('date handling', () => {
    it('should use UTC midnight for date calculations', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      mockPrisma.usage.findUnique.mockResolvedValue({
        id: 'usage-1',
        userId: 'user-1',
        sessionId: null,
        date: today,
        requestsUsed: 0,
        requestsLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context: QuotaContext = { userId: 'user-1' };
      await quotaService.checkQuota(context);

      // Verify the date passed to Prisma is at UTC midnight
      const findUniqueCall = mockPrisma.usage.findUnique.mock.calls[0];
      const whereClause = findUniqueCall[0]?.where;
      if (whereClause?.userId_date) {
        const date = whereClause.userId_date.date;
        expect(date.getUTCHours()).toBe(0);
        expect(date.getUTCMinutes()).toBe(0);
        expect(date.getUTCSeconds()).toBe(0);
        expect(date.getUTCMilliseconds()).toBe(0);
      }
    });
  });
});
