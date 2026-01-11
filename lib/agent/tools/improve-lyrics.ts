import { Tool } from '@/lib/agent/core/tool';
import { z } from 'zod';
import { SongStructureSchema, SongStructure } from '@/lib/agent/schemas/song-structure';
import { LyricsEvaluationSchema, LyricsEvaluation } from '@/lib/agent/schemas/evaluation';
import OpenAI from 'openai';

/**
 * Tool that improves song lyrics based on evaluation feedback.
 * This is where the LLM is called to refine and improve lyrics.
 */
export class ImproveLyricsTool extends Tool {
  id = 'improve-lyrics';
  name = 'ImproveLyrics';
  description = 'Improves song lyrics based on evaluation feedback, maintaining the original emotion and style while addressing weaknesses';
  
  inputSchema = z.object({
    songStructure: SongStructureSchema,
    evaluation: LyricsEvaluationSchema,
    userFeedback: z.string().optional(),
  });
  
  outputSchema = SongStructureSchema;

  private openai?: OpenAI;

  private useMock: boolean;

  constructor() {
    super();
    this.useMock = process.env.USE_MOCK_LLM === 'true';
    
    // Only initialize OpenAI if not using mock mode
    if (!this.useMock) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required (or set USE_MOCK_LLM=true for testing)');
      }
      this.openai = new OpenAI({ apiKey });
    }
  }

  protected async executeInternal(input: unknown): Promise<SongStructure> {
    const { songStructure, evaluation, userFeedback } = input as {
      songStructure: SongStructure;
      evaluation: LyricsEvaluation;
      userFeedback?: string;
    };

    // MOCK MODE: Generate improved song structure without API call
    if (this.useMock) {
      return this.generateMockImprovedSong(songStructure, evaluation);
    }

    // LLM CALL: Improve lyrics based on evaluation
    const completion = await this.openai!.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a professional songwriter. Improve lyrics based on feedback while:
- Maintaining the original emotional tone and genre
- Addressing specific weaknesses identified in the evaluation
- Incorporating suggested improvements
- Preserving the song structure (sections, order)
- Keeping the same title or improving it if suggested
- Ensuring each section has substantial, meaningful content

Return the improved song structure as JSON.`
        },
        {
          role: 'user',
          content: `Improve this song based on the evaluation${userFeedback ? ' and the following user feedback' : ''}:

ORIGINAL SONG:
Title: ${songStructure.title}

Sections:
${songStructure.sections
  .sort((a, b) => a.order - b.order)
  .map(s => `${s.type.toUpperCase()} (order ${s.order}):\n${s.content}`)
  .join('\n\n')}

EVALUATION:
Quality Score: ${evaluation.quality}/10
Strengths: ${evaluation.strengths.join(', ')}
Weaknesses: ${evaluation.weaknesses.join(', ')}
Suggestions: ${evaluation.suggestions.join(', ')}
${userFeedback ? `\nUSER FEEDBACK:\n${userFeedback}\n\nPlease prioritize incorporating the user's feedback while addressing the evaluation suggestions.` : ''}

Provide the improved song structure as JSON matching this exact format:
{
  "title": "<improved song title>",
  "sections": [
    {
      "type": "<verse|chorus|bridge|intro|outro>",
      "content": "<improved lyrics for this section, multiple lines>",
      "order": <number>
    }
  ],
  "totalSections": <number>
}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8, // Higher temperature for creativity while incorporating feedback
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    // Parse JSON response
    const parsed = JSON.parse(content);
    
    // Return will be validated by outputSchema in execute()
    return parsed as SongStructure;
  }

  private generateMockImprovedSong(songStructure: SongStructure, evaluation: LyricsEvaluation): SongStructure {
    // Generate improved version by enhancing existing sections
    const improvedSections = songStructure.sections.map((section, idx) => {
      let improvedContent = section.content;
      
      // Apply improvements based on suggestions
      if (evaluation.suggestions.some(s => s.toLowerCase().includes('imagery'))) {
        improvedContent = improvedContent + '\n[Enhanced with more vivid imagery]';
      }
      if (evaluation.suggestions.some(s => s.toLowerCase().includes('emotional'))) {
        improvedContent = `With deeper feeling,\n${improvedContent}`;
      }
      if (section.type === 'chorus' && evaluation.suggestions.some(s => s.toLowerCase().includes('memorable'))) {
        improvedContent = `${improvedContent}\n[More catchy and memorable]`;
      }
      
      return {
        ...section,
        content: improvedContent || section.content,
      };
    });

    return {
      title: songStructure.title.startsWith('Improved') 
        ? songStructure.title 
        : `Improved ${songStructure.title}`,
      sections: improvedSections,
      totalSections: improvedSections.length,
    };
  }
}
