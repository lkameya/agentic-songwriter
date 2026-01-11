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
    // Input is validated by Zod, so it should match CreativeBrief + optional userFeedback
    const inputData = input as CreativeBrief & { userFeedback?: string };
    const { userFeedback, ...briefData } = inputData;
    const brief = briefData as CreativeBrief;

    // MOCK MODE: Generate sample song structure without API call
    if (this.useMock) {
      return this.generateMockSongStructure(brief);
    }

    // LLM CALL: Generate song structure
    const completion = await this.openai!.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a professional songwriter. Create a complete song structure based on the creative brief provided. 
The song should have a title and multiple sections (verse, chorus, bridge, intro, outro) with meaningful lyrics that match the emotion, mood, and themes specified.
Each section should have substantial content (at least 4-6 lines).`
        },
        {
          role: 'user',
          content: `Create a song structure from this creative brief:

Lyrics (base): ${brief.lyrics}
Emotion: ${brief.emotion}
Mood: ${brief.mood}
Themes: ${brief.themes.join(', ')}
${brief.genre ? `Genre: ${brief.genre}` : ''}
${brief.tempo ? `Tempo: ${brief.tempo}` : ''}
${brief.style ? `Style: ${brief.style}` : ''}
${userFeedback ? `\nIMPORTANT USER FEEDBACK:\n${userFeedback}\n\nPlease incorporate this feedback into the song lyrics.` : ''}

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
      temperature: 0.8, // Higher temperature for creativity
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

  private generateMockSongStructure(brief: CreativeBrief): SongStructure {
    // Generate mock song structure based on brief
    const lines = brief.lyrics.split('\n').filter(l => l.trim()).slice(0, 4);
    const baseLyrics = lines.join('\n') || brief.lyrics.substring(0, 100);

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
