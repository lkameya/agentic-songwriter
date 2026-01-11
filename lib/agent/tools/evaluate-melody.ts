import { Tool } from '@/lib/agent/core/tool';
import { z } from 'zod';
import { MelodyStructureSchema, MelodyStructure } from '@/lib/agent/schemas/melody';
import { SongStructureSchema, SongStructure } from '@/lib/agent/schemas/song-structure';
import { MelodyEvaluationSchema, MelodyEvaluation } from '@/lib/agent/schemas/melody-evaluation';
import OpenAI from 'openai';

/**
 * Tool that evaluates the quality of a melody.
 * This is where the LLM is called to reason about melody quality.
 */
export class EvaluateMelodyTool extends Tool {
  id = 'evaluate-melody';
  name = 'EvaluateMelody';
  description = 'Evaluates the quality of a generated melody, checking harmony with lyrics, emotional match, rhythm quality, and musicality';
  
  inputSchema = z.object({
    melodyStructure: MelodyStructureSchema,
    songStructure: SongStructureSchema,
  });
  
  outputSchema = MelodyEvaluationSchema;

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

  protected async executeInternal(input: unknown): Promise<MelodyEvaluation> {
    const { melodyStructure, songStructure } = input as {
      melodyStructure: MelodyStructure;
      songStructure: SongStructure;
    };

    // MOCK MODE: Generate sample evaluation without API call
    if (this.useMock) {
      return this.generateMockEvaluation(melodyStructure, songStructure);
    }

    // LLM CALL: Evaluate melody quality
    const completion = await this.openai!.chat.completions.create({
      model: this.getModel(),
      messages: [
        {
          role: 'system',
          content: `You are an expert music critic and composer. Evaluate melodies with high standards for musicality, emotional resonance, and harmony with lyrics.

EVALUATION CRITERIA:
- **Harmony with Lyrics**: Does the melody match the rhythm, phrasing, and emotional tone of the lyrics?
- **Emotional Match**: Does the melody convey the intended emotion and mood?
- **Rhythm Quality**: Is the rhythm natural, flowing, and appropriate for the lyrics?
- **Musicality**: Is the melody musically coherent, memorable, and singable?
- **Structure**: Does the melody follow good musical structure and phrasing?
- **Key and Scale**: Is the key appropriate for the emotion and mood?
- **Tempo**: Is the tempo suitable for the song's emotion and style?
- **Overall Polish**: Professional quality and refinement

SCORING GUIDELINES:
- 9-10: Exceptional melody, perfect harmony with lyrics, highly memorable
- 8-8.9: Strong melody, good harmony, memorable
- 7-7.9: Decent melody but some issues with harmony or musicality
- Below 7: Significant issues, needs improvement

Set needsImprovement to TRUE if quality < 8.5 OR if there are significant issues with harmony, rhythm, or musicality.

Provide a quality score (0-10), list strengths, weaknesses, specific suggestions, and whether improvement is needed.`
        },
        {
          role: 'user',
          content: `Evaluate this melody structure:

MELODY:
Tempo: ${melodyStructure.tempo} BPM
Key: ${melodyStructure.key}
Time Signature: ${melodyStructure.timeSignature}
Total Beats: ${melodyStructure.totalBeats}

Tracks:
${melodyStructure.tracks.map(track => `
Track: ${track.name}${track.instrument ? ` (${track.instrument})` : ''}
Notes: ${track.notes.length}
${track.notes.slice(0, 10).map(n => `  - Note ${n.note}, velocity ${n.velocity}, start ${n.startTime}, duration ${n.duration}`).join('\n')}
${track.notes.length > 10 ? `  ... and ${track.notes.length - 10} more notes` : ''}
`).join('\n')}

SONG LYRICS:
Title: ${songStructure.title}

Sections:
${songStructure.sections
  .sort((a, b) => a.order - b.order)
  .map(s => `${s.type.toUpperCase()} (order ${s.order}):\n${s.content}`)
  .join('\n\n')}

Provide your evaluation as JSON matching this exact format:
{
  "quality": <number 0-10>,
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...],
  "suggestions": ["<suggestion 1>", "<suggestion 2>", ...],
  "needsImprovement": <boolean - true if quality < 8.5 OR significant issues>
}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const parsed = JSON.parse(content);
    return parsed as MelodyEvaluation;
  }

  private generateMockEvaluation(melodyStructure: MelodyStructure, songStructure: SongStructure): MelodyEvaluation {
    const quality = 7.5 + Math.random() * 1.5; // Random quality between 7.5-9
    
    return {
      quality: Math.round(quality * 10) / 10,
      strengths: [
        'Melody flows well with the lyrics',
        'Good use of musical phrasing',
        'Appropriate tempo and key for the emotion',
      ],
      weaknesses: [
        'Could use more variation in note patterns',
        'Some sections feel repetitive',
      ],
      suggestions: [
        'Add more dynamic variation',
        'Consider adding harmony tracks',
        'Vary the rhythm patterns between sections',
      ],
      needsImprovement: quality < 8.5,
    };
  }
}
