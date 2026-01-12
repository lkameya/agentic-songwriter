import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Orchestrator } from '@/lib/agent/core/orchestrator';
import { MelodyAgent } from '@/lib/agent/agents/melody-agent';
import { StateStore } from '@/lib/agent/core/state-store';
import { Trace } from '@/lib/agent/core/trace';
import { GenerateMelodyTool } from '@/lib/agent/tools/generate-melody';
import { EvaluateMelodyTool } from '@/lib/agent/tools/evaluate-melody';
import { ImproveMelodyTool } from '@/lib/agent/tools/improve-melody';
import { MelodyStructure } from '@/lib/agent/schemas/melody';
import { MelodyEvaluation } from '@/lib/agent/schemas/melody-evaluation';
import { SongStructure } from '@/lib/agent/schemas/song-structure';
import { prisma } from '@/lib/db/prisma';
import { quotaService, QuotaContext } from '@/lib/services/quota-service';
import { QuotaExceededError } from '@/lib/errors/quota-errors';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';

// Input validation schema
const MelodyRequestSchema = z.object({
  songId: z.string().min(1, 'Song ID is required'),
  tempo: z.number().min(40).max(200).optional(),
  key: z.string().optional(),
  timeSignature: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // Create a ReadableStream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: unknown) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      try {
        // Parse and validate request body
        const body = await req.json();
        const validatedBody = MelodyRequestSchema.parse(body);

        // Get user context for quota enforcement
        // Note: In App Router, getServerSession works without explicit headers
        // but we need to handle the case where session might be null
        const session = await getServerSession(authOptions).catch(() => null);
        let quotaContext: QuotaContext;
        
        if (session?.user?.id) {
          // Authenticated user
          quotaContext = { userId: session.user.id as string };
        } else {
          // Guest user - get or create session ID from cookie
          const guestSessionId = req.cookies.get('guest_session_id')?.value || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          quotaContext = { sessionId: guestSessionId };
        }

        // Check quota before starting generation
        try {
          await quotaService.checkQuota(quotaContext);
        } catch (error) {
          if (error instanceof QuotaExceededError) {
            sendEvent({
              type: 'error',
              error: `Quota exceeded: ${error.message}`,
            });
            controller.close();
            return;
          }
          throw error;
        }

        // Load song from database
        const song = await prisma.song.findUnique({
          where: { id: validatedBody.songId },
        });

        if (!song) {
          sendEvent({
            type: 'error',
            error: 'Song not found',
          });
          controller.close();
          return;
        }

        // Parse song structure from database
        const songStructure = JSON.parse(song.songStructure) as SongStructure;
        const creativeBrief = song.creativeBrief ? JSON.parse(song.creativeBrief) : null;

        // Extract emotion and mood from creative brief or song data
        const emotion = song.inputEmotion;
        const mood = creativeBrief?.mood || 'neutral';

        // Generate a unique session ID for this execution
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Initialize state store and trace
        const stateStore = new StateStore();
        const trace = new Trace();

        // Store song structure and parameters in state
        stateStore.set('songStructure', songStructure);
        stateStore.set('emotion', emotion);
        stateStore.set('mood', mood);
        if (validatedBody.tempo) {
          stateStore.set('tempo', validatedBody.tempo);
        }
        if (validatedBody.key) {
          stateStore.set('key', validatedBody.key);
        }
        if (validatedBody.timeSignature) {
          stateStore.set('timeSignature', validatedBody.timeSignature);
        }

        // Create all three melody tools
        const generateTool = new GenerateMelodyTool();
        const evaluateTool = new EvaluateMelodyTool();
        const improveTool = new ImproveMelodyTool();

        // Create agent with all tools
        const agent = new MelodyAgent([generateTool, evaluateTool, improveTool]);

        // Create orchestrator with progress callback
        // Increased limits to handle iterative improvement workflow
        const orchestrator = new Orchestrator({
          maxSteps: 30,
          maxToolCalls: 30,
          allowedTools: ['generate-melody', 'evaluate-melody', 'improve-melody'],
          stateStore,
          trace,
          maxIterations: 3,
          onProgress: (update) => {
            sendEvent({ type: 'progress', ...update });
          },
        });

        // Run the orchestrator
        const result = await orchestrator.run(agent, {});

        if (!result.success) {
          sendEvent({
            type: 'error',
            error: result.error || 'Orchestrator execution failed',
            trace: result.trace,
          });
          controller.close();
          return;
        }

        // Increment quota after successful generation
        try {
          await quotaService.incrementQuota(quotaContext);
        } catch (error) {
          console.error('[Quota] Error incrementing quota:', error);
          // Don't fail the request if quota increment fails, but log it
        }

        // Extract results from final state
        const melodyStructure = stateStore.get('melodyStructure') as MelodyStructure | undefined;
        const evaluation = stateStore.get('evaluation') as MelodyEvaluation | undefined;
        const iterationCount = (stateStore.get('iterationCount') as number) || 0;

        // Send final result (include song structure for lyrics display)
        sendEvent({
          type: 'complete',
          success: true,
          melodyStructure: melodyStructure || null,
          evaluation: evaluation || null,
          iterationCount,
          songStructure: songStructure, // Include song structure for lyrics display
          trace: result.trace,
        });

        // Save melody to database (async, don't block the stream)
        if (melodyStructure) {
          try {
            const qualityScore = evaluation?.quality || null;
            const savedMelody = await prisma.melody.create({
              data: {
                songId: validatedBody.songId,
                midiStructure: JSON.stringify(melodyStructure),
                tempo: melodyStructure.tempo,
                key: melodyStructure.key,
                timeSignature: melodyStructure.timeSignature,
                iterationCount,
                qualityScore,
              },
            });

            // Send saved melody ID to client
            sendEvent({
              type: 'saved',
              melodyId: savedMelody.id,
            });
          } catch (saveError) {
            // Log error but don't fail the request
            console.error('Error saving melody to database:', saveError);
            sendEvent({
              type: 'save_error',
              error: saveError instanceof Error ? saveError.message : 'Failed to save melody',
            });
          }
        }

        controller.close();
      } catch (error) {
        // Handle validation errors
        if (error instanceof z.ZodError) {
          sendEvent({
            type: 'error',
            error: 'Invalid request data',
            details: error.errors,
          });
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          sendEvent({
            type: 'error',
            error: errorMessage,
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
