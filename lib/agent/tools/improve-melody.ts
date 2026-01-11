import { Tool } from '@/lib/agent/core/tool';
import { z } from 'zod';
import { MelodyStructureSchema, MelodyStructure } from '@/lib/agent/schemas/melody';
import { MelodyEvaluationSchema, MelodyEvaluation } from '@/lib/agent/schemas/melody-evaluation';
import { SongStructureSchema, SongStructure } from '@/lib/agent/schemas/song-structure';
import OpenAI from 'openai';

/**
 * Tool that improves a melody based on evaluation feedback.
 * This is where the LLM is called to refine and improve melodies.
 */
export class ImproveMelodyTool extends Tool {
  id = 'improve-melody';
  name = 'ImproveMelody';
  description = 'Improves a melody based on evaluation feedback, maintaining harmony with lyrics while addressing weaknesses';
  
  inputSchema = z.object({
    melodyStructure: MelodyStructureSchema,
    evaluation: MelodyEvaluationSchema,
    songStructure: SongStructureSchema,
  });
  
  outputSchema = MelodyStructureSchema;

  private openai?: OpenAI;
  private useMock: boolean;

  constructor() {
    super();
    this.useMock = process.env.USE_MOCK_LLM === 'true';
    
    if (!this.useMock) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required (or set USE_MOCK_LLM=true for testing)');
      }
      this.openai = new OpenAI({ apiKey });
    }
  }

  private getModel(): string {
    return process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
  }

  protected async executeInternal(input: unknown): Promise<MelodyStructure> {
    const { melodyStructure, evaluation, songStructure } = input as {
      melodyStructure: MelodyStructure;
      evaluation: MelodyEvaluation;
      songStructure: SongStructure;
    };

    // MOCK MODE: Generate improved melody without API call
    if (this.useMock) {
      return this.generateMockImprovedMelody(melodyStructure, evaluation, songStructure);
    }

    // LLM CALL: Improve melody based on evaluation
    const completion = await this.openai!.chat.completions.create({
      model: this.getModel(),
      messages: [
        {
          role: 'system',
          content: `You are a professional music composer. Dramatically improve the melody based on evaluation feedback.

IMPROVEMENT REQUIREMENTS:
- Address ALL weaknesses identified in the evaluation
- Incorporate ALL suggested improvements
- Maintain harmony with the lyrics
- Preserve the emotional tone and mood
- Improve rhythm quality and musicality
- Add variation and interest while maintaining coherence
- Ensure the melody remains singable and memorable
- Target quality 8.5+ for musicality and harmony

Return the improved melody structure as JSON with the same format as the original.`
        },
        {
          role: 'user',
          content: `Improve this melody based on the evaluation:

ORIGINAL MELODY:
Tempo: ${melodyStructure.tempo} BPM
Key: ${melodyStructure.key}
Time Signature: ${melodyStructure.timeSignature}

Tracks:
${melodyStructure.tracks.map(track => `
Track: ${track.name}${track.instrument ? ` (${track.instrument})` : ''}
Notes: ${track.notes.length}
`).join('\n')}

EVALUATION:
Quality Score: ${evaluation.quality}/10
Strengths: ${evaluation.strengths.join(', ')}
Weaknesses: ${evaluation.weaknesses.join(', ')}
Suggestions: ${evaluation.suggestions.join(', ')}

SONG LYRICS (for reference):
Title: ${songStructure.title}

Sections:
${songStructure.sections
  .sort((a, b) => a.order - b.order)
  .map(s => `${s.type.toUpperCase()} (order ${s.order}):\n${s.content}`)
  .join('\n\n')}

Provide the improved melody structure as JSON with this exact format:
{
  "tempo": <number 40-200>,
  "key": "<string>",
  "timeSignature": "<string>",
  "tracks": [
    {
      "name": "<track name>",
      "instrument": "<optional instrument name>",
      "notes": [
        {
          "note": <number 0-127>,
          "velocity": <number 0-127>,
          "startTime": <number in beats>,
          "duration": <number in beats>
        }
      ]
    }
  ],
  "totalBeats": <number>
}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const parsed = JSON.parse(content);
    return parsed as MelodyStructure;
  }

  private generateMockImprovedMelody(
    melodyStructure: MelodyStructure,
    evaluation: MelodyEvaluation,
    songStructure: SongStructure
  ): MelodyStructure {
    // Simple improvement: add more variation and notes
    const improvedTracks = melodyStructure.tracks.map(track => ({
      ...track,
      notes: track.notes.map(note => ({
        ...note,
        velocity: Math.min(127, note.velocity + 5), // Slightly increase velocity
      })),
    }));

    return {
      ...melodyStructure,
      tracks: improvedTracks,
    };
  }
}
