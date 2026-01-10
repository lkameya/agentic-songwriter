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
  
  inputSchema = CreativeBriefSchema;
  outputSchema = SongStructureSchema;

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

  protected async executeInternal(input: unknown): Promise<SongStructure> {
    const brief = input as CreativeBrief;

    // LLM CALL: Generate song structure
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
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
}
