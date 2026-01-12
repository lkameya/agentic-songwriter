import { NextRequest, NextResponse } from 'next/server';
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

// Input validation schema
const RunRequestSchema = z.object({
  lyrics: z.string().min(1, 'Storyline is required'),
  emotion: z.string().min(1, 'Emotion is required'),
  genre: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const validatedInput = RunRequestSchema.parse(body);

    // Initialize state store and trace
    const stateStore = new StateStore();
    const trace = new Trace();

    // Create all three tools
    const generateTool = new GenerateSongStructureTool();
    const evaluateTool = new EvaluateLyricsTool();
    const improveTool = new ImproveLyricsTool();

    // Create agent with all tools
    const agent = new BriefAgent([generateTool, evaluateTool, improveTool]);

    // Create orchestrator with guardrails
    const orchestrator = new Orchestrator({
      maxSteps: 20, // Allow enough steps for iterations
      maxToolCalls: 15, // Allow enough tool calls (generate + evaluate + up to 3 improvements with re-evaluations)
      allowedTools: ['generate-song-structure', 'evaluate-lyrics', 'improve-lyrics'],
      stateStore,
      trace,
      maxIterations: 3,
    });

    // Run the orchestrator with initial input
    const result = await orchestrator.run(agent, validatedInput);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Orchestrator execution failed',
          trace: result.trace,
        },
        { status: 500 }
      );
    }

    // Extract results from final state
    const creativeBrief = stateStore.get('creativeBrief') as CreativeBrief | undefined;
    const songStructure = stateStore.get('songStructure') as SongStructure | undefined;
    const evaluation = stateStore.get('evaluation') as LyricsEvaluation | undefined;
    const iterationCount = (stateStore.get('iterationCount') as number) || 0;

    // Return response
    return NextResponse.json({
      success: true,
      creativeBrief: creativeBrief || null,
      songStructure: songStructure || null,
      evaluation: evaluation || null,
      iterationCount,
      trace: result.trace,
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
