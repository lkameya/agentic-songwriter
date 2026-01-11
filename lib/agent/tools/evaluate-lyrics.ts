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
    language: z.enum(['en', 'pt-BR']).optional(),
  });
  
  outputSchema = LyricsEvaluationSchema;

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

  protected async executeInternal(input: unknown): Promise<LyricsEvaluation> {
    const { songStructure, language } = input as { 
      songStructure: SongStructure;
      language?: 'en' | 'pt-BR';
    };
    const outputLanguage = language || 'en';

    // MOCK MODE: Generate sample evaluation without API call
    if (this.useMock) {
      return this.generateMockEvaluation(songStructure);
    }

    // LLM CALL: Evaluate lyrics quality
    const completion = await this.openai!.chat.completions.create({
      model: this.getModel(),
      messages: [
        {
          role: 'system',
          content: `You are a strict, expert music critic and award-winning songwriter. Evaluate song lyrics with high standards for creativity and originality.

EVALUATION CRITERIA (be strict):
- **Creativity & Originality (CRITICAL)**: Are the lyrics fresh and unique? Do they avoid clichés and generic phrases? Score LOW if lyrics contain overused expressions or predictable metaphors.
- **Emotional Resonance**: Do the lyrics create genuine emotional impact through specific, vivid details rather than abstract statements?
- **Imagery & Sensory Details**: Are there vivid, concrete images that engage the senses? Generic descriptions score LOW.
- **Coherence & Narrative Flow**: Does the song tell a coherent story or build a clear emotional arc?
- **Rhyme & Rhythm Quality**: Are rhymes natural and rhythm smooth?
- **Memorability**: Would listeners remember specific lines? Generic lyrics score LOW.
- **Alignment**: Does it match the intended emotion/genre?
- **Overall Polish**: Professional quality and refinement

SCORING GUIDELINES:
- 9-10: Exceptional creativity, unique voice, memorable lines, vivid imagery, no clichés
- 8-8.9: Strong creativity, mostly original, good imagery, minimal clichés
- 7-7.9: Decent creativity but some generic phrases or predictable elements
- Below 7: Too many clichés, generic phrases, lacks originality, needs significant improvement

Set needsImprovement to TRUE if quality < 8.5 OR if lyrics contain multiple clichés/generic phrases.

Provide a quality score (0-10), list strengths, weaknesses, specific suggestions, and whether improvement is needed.
Be constructive, specific, and STRICT about creativity and originality.
${outputLanguage === 'pt-BR' ? 'IMPORTANT: Provide all evaluation feedback (strengths, weaknesses, suggestions) in Portuguese (Brazil).' : 'Provide all evaluation feedback in English.'}`
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
  "needsImprovement": <boolean - true if quality < 8.5 OR if lyrics contain clichés/generic phrases OR significant creativity issues>
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

  private generateMockEvaluation(songStructure: SongStructure): LyricsEvaluation {
    // Generate mock evaluation based on song structure
    const sectionCount = songStructure.sections.length;
    const avgSectionLength = songStructure.sections.reduce((sum, s) => sum + s.content.length, 0) / sectionCount;
    
    // Rule-based quality scoring (simulating LLM evaluation)
    let quality = 6; // Base score
    if (sectionCount >= 5) quality += 1;
    if (avgSectionLength > 100) quality += 1;
    if (songStructure.sections.some(s => s.type === 'chorus')) quality += 0.5;
    
    const needsImprovement = quality < 7;
    
    return {
      quality: Math.min(10, Math.max(0, quality)),
      strengths: [
        'Good song structure with multiple sections',
        'Clear thematic development',
        sectionCount >= 5 ? 'Comprehensive section variety' : 'Adequate section structure',
      ],
      weaknesses: needsImprovement ? [
        'Could benefit from more descriptive imagery',
        'Rhyme scheme could be more consistent',
        avgSectionLength < 80 ? 'Some sections feel brief' : undefined,
      ].filter(Boolean) as string[] : [],
      suggestions: needsImprovement ? [
        'Add more vivid imagery and metaphors',
        'Strengthen the emotional impact in verses',
        'Enhance the chorus to make it more memorable',
      ] : [],
      needsImprovement,
    };
  }
}
