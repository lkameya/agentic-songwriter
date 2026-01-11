import { Tool } from '@/lib/agent/core/tool';
import { z } from 'zod';
import { CreativeBriefSchema, CreativeBrief } from '@/lib/agent/schemas/creative-brief';
import { SongStructureSchema, SongStructure } from '@/lib/agent/schemas/song-structure';
import OpenAI from 'openai';

/**
 * Tool that generates a song structure from a creative brief.
 * This is where the LLM is called to create the song.
 */
export class GenerateSongStructureTool extends Tool {
  id = 'generate-song-structure';
  name = 'GenerateSongStructure';
  description = 'Generates a complete song structure (title, verses, chorus, bridge, etc.) from a creative brief';
  
  inputSchema = CreativeBriefSchema.extend({
    userFeedback: z.string().optional(),
    language: z.enum(['en', 'pt-BR']).optional(),
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

  private getModel(): string {
    // Allow model override via environment variable, default to gpt-4-turbo-preview
    return process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
  }

  protected async executeInternal(input: unknown): Promise<SongStructure> {
    // Input is validated by Zod, so it should match CreativeBrief + optional userFeedback
    const inputData = input as CreativeBrief & { userFeedback?: string; language?: 'en' | 'pt-BR' };
    const { userFeedback, language, ...briefData } = inputData;
    const brief = briefData as CreativeBrief;
    const outputLanguage = language || brief.language || 'en';

    // MOCK MODE: Generate sample song structure without API call
    if (this.useMock) {
      return this.generateMockSongStructure(brief, outputLanguage);
    }

    // LLM CALL: Generate song structure
    const completion = await this.openai!.chat.completions.create({
      model: this.getModel(),
      messages: [
        {
          role: 'system',
          content: `You are an award-winning, highly creative songwriter known for original, evocative lyrics. Create a complete song structure based on the creative brief provided.

CRITICAL CREATIVITY REQUIREMENTS:
- AVOID generic phrases, clichés, and overused expressions (e.g., "heart of gold", "tears falling", "love forever")
- Use vivid, specific imagery and sensory details (sights, sounds, textures, smells)
- Employ creative metaphors and unexpected comparisons
- Create unique, memorable phrases that haven't been heard before
- Use concrete, tangible details rather than abstract concepts
- Build emotional depth through specific scenes and moments, not general statements
- Make each line contribute something fresh and original

STRUCTURAL REQUIREMENTS:
- The song should have a title and multiple sections (verse, chorus, bridge, intro, outro)
- Each section should have substantial content (at least 4-6 lines, preferably 6-8)
- Lyrics must match the emotion, mood, and themes specified
- Create a strong, memorable chorus that captures the essence
- Verses should tell a story or paint vivid scenes
- Bridge should offer a new perspective or emotional shift

QUALITY TARGET: Aim for lyrics that would score 8.5+ out of 10 for creativity, originality, and emotional impact.

${outputLanguage === 'pt-BR' ? 'IMPORTANT: Write all lyrics, title, and content in Portuguese (Brazil). Use Brazilian Portuguese spelling and expressions. Avoid generic phrases common in Brazilian music.' : 'Write all lyrics, title, and content in English.'}`
        },
        {
          role: 'user',
          content: `Create a highly creative, original song structure from this creative brief:

Lyrics (base): ${brief.lyrics}
Emotion: ${brief.emotion}
Mood: ${brief.mood}
Themes: ${brief.themes.join(', ')}
${brief.genre ? `Genre: ${brief.genre}` : ''}
${brief.tempo ? `Tempo: ${brief.tempo}` : ''}
${brief.style ? `Style: ${brief.style}` : ''}
${outputLanguage === 'pt-BR' ? '\nLanguage: Portuguese (Brazil) - Write all content in Brazilian Portuguese.' : '\nLanguage: English - Write all content in English.'}

CREATIVITY REQUIREMENTS:
- Use the base lyrics as inspiration, but transform them into something fresh and original
- Avoid generic phrases like "forever and always", "tears in my eyes", "heart of gold"
- Create vivid, specific imagery: instead of "I'm sad", describe what sadness looks/feels like in concrete terms
- Use unexpected metaphors and comparisons
- Make each line memorable and unique
- Build emotional impact through specific scenes and moments

${userFeedback ? `\nIMPORTANT USER FEEDBACK:\n${userFeedback}\n\nPlease incorporate this feedback into the song lyrics while maintaining high creativity.` : ''}

Provide the song structure as JSON with this exact format:
{
  "title": "<song title>",
  "sections": [
    {
      "type": "<verse|chorus|bridge|intro|outro>",
      "content": "<lyrics for this section, multiple lines>",
      "order": <number>
    }
  ],
  "totalSections": <number>
}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.95, // Higher temperature for maximum creativity and originality
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

  private generateMockSongStructure(brief: CreativeBrief, language: 'en' | 'pt-BR' = 'en'): SongStructure {
    // Generate mock song structure based on brief
    const lines = brief.lyrics.split('\n').filter(l => l.trim()).slice(0, 4);
    const baseLyrics = lines.join('\n') || brief.lyrics.substring(0, 100);

    if (language === 'pt-BR') {
      // Portuguese (Brazil) mock content
      const emotionPt = brief.emotion === 'sad' ? 'tristeza' : brief.emotion === 'happy' ? 'alegria' : brief.emotion === 'love' ? 'amor' : brief.emotion;
      const moodPt = brief.mood === 'melancholic' ? 'melancólico' : brief.mood === 'upbeat' ? 'animado' : brief.mood === 'romantic' ? 'romântico' : brief.mood;
      
      return {
        title: `Canção de ${emotionPt.charAt(0).toUpperCase() + emotionPt.slice(1)}`,
        sections: [
          {
            type: 'intro',
            content: `Na ${moodPt} da noite\nMe encontro pensando em você`,
            order: 1,
          },
          {
            type: 'verse',
            content: `${baseLyrics}\nEssas palavras fluem do meu coração\nExpressando o que sinto por dentro`,
            order: 2,
          },
          {
            type: 'chorus',
            content: `Esta é minha canção de ${emotionPt}\nPreenchida com ${brief.themes.join(' e ')}\nCada nota, cada palavra\nConta a história do meu mundo ${moodPt}`,
            order: 3,
          },
          {
            type: 'verse',
            content: `${baseLyrics}\nA melodia me leva para longe\nPara um lugar onde as emoções brincam`,
            order: 4,
          },
          {
            type: 'chorus',
            content: `Esta é minha canção de ${emotionPt}\nPreenchida com ${brief.themes.join(' e ')}\nCada nota, cada palavra\nConta a história do meu mundo ${moodPt}`,
            order: 5,
          },
          {
            type: 'bridge',
            content: `E neste momento, eu percebo\nQue ${emotionPt} não é apenas um sentimento\nÉ uma jornada, é um caminho\nQue leva ao entendimento`,
            order: 6,
          },
          {
            type: 'outro',
            content: `Então aqui estou, cantando minha canção de ${emotionPt}\nPara sempre e sempre, este é o lugar onde pertenço`,
            order: 7,
          },
        ],
        totalSections: 7,
      };
    }

    // English mock content (default)
    return {
      title: `${brief.emotion.charAt(0).toUpperCase() + brief.emotion.slice(1)} Song`,
      sections: [
        {
          type: 'intro',
          content: `In the ${brief.mood} of the night\nI find myself thinking of you`,
          order: 1,
        },
        {
          type: 'verse',
          content: `${baseLyrics}\nThese words flow from my heart\nExpressing what I feel inside`,
          order: 2,
        },
        {
          type: 'chorus',
          content: `This is my ${brief.emotion} song\nFilled with ${brief.themes.join(' and ')}\nEvery note, every word\nTells the story of my ${brief.mood} world`,
          order: 3,
        },
        {
          type: 'verse',
          content: `${baseLyrics}\nThe melody carries me away\nTo a place where emotions play`,
          order: 4,
        },
        {
          type: 'chorus',
          content: `This is my ${brief.emotion} song\nFilled with ${brief.themes.join(' and ')}\nEvery note, every word\nTells the story of my ${brief.mood} world`,
          order: 5,
        },
        {
          type: 'bridge',
          content: `And in this moment, I realize\nThat ${brief.emotion} is not just a feeling\nIt's a journey, it's a path\nThat leads to understanding`,
          order: 6,
        },
        {
          type: 'outro',
          content: `So here I am, singing my ${brief.emotion} song\nForever and always, this is where I belong`,
          order: 7,
        },
      ],
      totalSections: 7,
    };
  }
}
