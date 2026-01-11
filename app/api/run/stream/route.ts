import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Orchestrator } from '@/lib/agent/core/orchestrator';
import { BriefAgent } from '@/lib/agent/agents/brief-agent';
import { StateStore } from '@/lib/agent/core/state-store';
import { Trace } from '@/lib/agent/core/trace';
import { GenerateSongStructureTool } from '@/lib/agent/tools/generate-song-structure';
import { EvaluateLyricsTool } from '@/lib/agent/tools/evaluate-lyrics';
import { ImproveLyricsTool } from '@/lib/agent/tools/improve-lyrics';
import { CreativeBrief } from '@/lib/agent/schemas/creative-brief';
import { SongStructure } from '@/lib/agent/schemas/song-structure';
import { LyricsEvaluation } from '@/lib/agent/schemas/evaluation';
import { approvalStore } from '@/lib/agent/core/approval-store';
import { AgentStep } from '@/types/agent';
import { prisma } from '@/lib/db/prisma';

// Input validation schema
const RunRequestSchema = z.object({
  lyrics: z.string().min(1, 'Lyrics are required'),
  emotion: z.string().min(1, 'Emotion is required'),
  genre: z.string().optional(),
  language: z.enum(['en', 'pt-BR']).optional().default('en'),
  enableHumanInLoop: z.boolean().optional(),
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
        const validatedBody = RunRequestSchema.parse(body);
        const enableHumanInLoop = validatedBody.enableHumanInLoop ?? false;
        const { enableHumanInLoop: _, ...validatedInput } = validatedBody;

        // Generate a unique session ID for this execution
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Initialize state store and trace
        const stateStore = new StateStore();
        const trace = new Trace();

        // Create all three tools
        const generateTool = new GenerateSongStructureTool();
        const evaluateTool = new EvaluateLyricsTool();
        const improveTool = new ImproveLyricsTool();

        // Create agent with all tools
        const agent = new BriefAgent([generateTool, evaluateTool, improveTool]);

        // Human-in-the-loop callback - approves generated content (song sections)
        const humanInTheLoopCallback = enableHumanInLoop
          ? async (toolId: string, output: unknown): Promise<{
              decision: 'approve' | 'reject' | 'regenerate';
              feedback?: string;
            }> => {
              // Generate a unique approval ID
              const approvalId = `${sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
              
              console.log(`[Orchestrator] Creating content approval request: ${approvalId} for tool: ${toolId}`);
              
              // Create the approval request FIRST (before sending to client)
              const approvalPromise = approvalStore.createApprovalRequest(approvalId);
              
              console.log(`[Orchestrator] Approval request created. Pending IDs:`, approvalStore.getPendingIds());
              
              // Send approval request to client with the actual generated content
              sendEvent({
                type: 'approval_required',
                approvalId,
                toolId,
                output, // Send the actual generated content (song structure, etc.)
              });

              console.log(`[Orchestrator] Approval request sent to client: ${approvalId}`);

              // Wait for user approval
              try {
                const approvalData = await approvalPromise;
                console.log(`[Orchestrator] Approval received for ${approvalId}:`, approvalData);
                sendEvent({
                  type: 'approval_received',
                  decision: approvalData.decision,
                  hasFeedback: !!approvalData.feedback,
                  approvalId,
                });
                return approvalData;
              } catch (error) {
                console.error(`[Orchestrator] Approval error for ${approvalId}:`, error);
                sendEvent({
                  type: 'approval_error',
                  error: error instanceof Error ? error.message : 'Approval request failed',
                  approvalId,
                });
                return { decision: 'reject' };
              }
            }
          : undefined;

        // Create orchestrator with progress callback and optional human-in-the-loop
        const orchestrator = new Orchestrator({
          maxSteps: 20,
          maxToolCalls: 15,
          allowedTools: ['generate-song-structure', 'evaluate-lyrics', 'improve-lyrics'],
          stateStore,
          trace,
          maxIterations: 3,
          onProgress: (update) => {
            sendEvent({ type: 'progress', ...update });
          },
          humanInTheLoop: humanInTheLoopCallback,
        });

        // Run the orchestrator
        const result = await orchestrator.run(agent, validatedInput);

        if (!result.success) {
          sendEvent({
            type: 'error',
            error: result.error || 'Orchestrator execution failed',
            trace: result.trace,
          });
          controller.close();
          return;
        }

        // Extract results from final state
        const creativeBrief = stateStore.get('creativeBrief') as CreativeBrief | undefined;
        const songStructure = stateStore.get('songStructure') as SongStructure | undefined;
        const evaluation = stateStore.get('evaluation') as LyricsEvaluation | undefined;
        const iterationCount = (stateStore.get('iterationCount') as number) || 0;

        // Send final result
        sendEvent({
          type: 'complete',
          success: true,
          creativeBrief: creativeBrief || null,
          songStructure: songStructure || null,
          evaluation: evaluation || null,
          iterationCount,
          trace: result.trace,
        });

        // Save song to database (async, don't block the stream)
        if (songStructure) {
          try {
            const qualityScore = evaluation?.quality || null;
            const savedSong = await prisma.song.create({
              data: {
                title: songStructure.title,
                inputLyrics: validatedInput.lyrics,
                inputEmotion: validatedInput.emotion,
                inputGenre: validatedInput.genre || null,
                creativeBrief: creativeBrief ? JSON.stringify(creativeBrief) : null,
                songStructure: JSON.stringify(songStructure),
                evaluation: evaluation ? JSON.stringify(evaluation) : null,
                trace: result.trace ? JSON.stringify(result.trace) : null,
                iterationCount,
                qualityScore,
              },
            });

            // Send saved song ID to client
            sendEvent({
              type: 'saved',
              songId: savedSong.id,
            });
          } catch (saveError) {
            // Log error but don't fail the request
            console.error('Error saving song to database:', saveError);
            sendEvent({
              type: 'save_error',
              error: saveError instanceof Error ? saveError.message : 'Failed to save song',
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
