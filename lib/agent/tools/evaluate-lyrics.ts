import { Tool } from '@/lib/agent/core/tool';
import { z } from 'zod';
import { SongStructureSchema, SongStructure } from '@/lib/agent/schemas/song-structure';
import { LyricsEvaluationSchema, LyricsEvaluation } from '@/lib/agent/schemas/evaluation';
import OpenAI from 'openai';

/**
 * Tool that evaluates the quality of song lyrics.
 * This is where the LLM is called to reason about lyrics quality.
 */
export class EvaluateLyricsTool extends Tool {
  id = 'evaluate-lyrics';
  name = 'EvaluateLyrics';
  description = 'Evaluates the quality of generated song lyrics, identifies strengths and weaknesses, and suggests improvements';
  
  inputSchema = z.object({
    songStructure: SongStructureSchema,
  });
  
  outputSchema = LyricsEvaluationSchema;

  private openai: OpenAI;

  constructor() {
    super();
    // Initialize OpenAI client - LLM calls happen ONLY here
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.openai = new OpenAI({ apiKey });
  }

  protected async executeInternal(input: unknown): Promise<LyricsEvaluation> {
    const { songStructure } = input as { songStructure: SongStructure };

    // LLM CALL: Evaluate lyrics quality
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are an expert music critic and songwriter. Evaluate song lyrics for:
- Emotional resonance and impact
- Coherence and narrative flow
- Rhyme and rhythm quality
- Originality and creativity
- Alignment with intended emotion/genre
- Overall quality and polish

Provide a quality score (0-10), list strengths, weaknesses, specific suggestions, and whether improvement is needed.
Be constructive and specific in your feedback.`
        },
        {
          role: 'user',
          content: `Evaluate this song structure:

Title: ${songStructure.title}

Sections:
${songStructure.sections
  .sort((a, b) => a.order - b.order)
  .map(s => `${s.type.toUpperCase()} (order ${s.order}):\n${s.content}`)
  .join('\n\n')}

Provide your evaluation as JSON matching this exact format:
{
  "quality": <number 0-10>,
  "strengths": [<array of strings describing what works well>],
  "weaknesses": [<array of strings describing areas needing improvement>],
  "suggestions": [<array of specific improvement suggestions>],
  "needsImprovement": <boolean - true if quality < 7 or significant issues found>
}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent evaluation
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    // Parse JSON response
    const parsed = JSON.parse(content);
    
    // Return will be validated by outputSchema in execute()
    return parsed as LyricsEvaluation;
  }
}
