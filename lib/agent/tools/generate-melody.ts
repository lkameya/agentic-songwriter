import { Tool } from '@/lib/agent/core/tool';
import { z } from 'zod';
import { SongStructureSchema, SongStructure } from '@/lib/agent/schemas/song-structure';
import { MelodyStructureSchema, MelodyStructure } from '@/lib/agent/schemas/melody';
import OpenAI from 'openai';

/**
 * Tool that generates a MIDI melody structure from song lyrics.
 * This is where the LLM is called to create the melody.
 */
export class GenerateMelodyTool extends Tool {
  id = 'generate-melody';
  name = 'GenerateMelody';
  description = 'Generates a MIDI melody structure that matches the lyrics rhythm, emotion, and mood';
  
  inputSchema = z.object({
    songStructure: SongStructureSchema,
    emotion: z.string(),
    mood: z.string(),
    tempo: z.number().min(40).max(200).optional(),
    key: z.string().optional(),
    timeSignature: z.string().optional(),
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
    const { songStructure, emotion, mood, tempo, key, timeSignature } = input as {
      songStructure: SongStructure;
      emotion: string;
      mood: string;
      tempo?: number;
      key?: string;
      timeSignature?: string;
    };

    // MOCK MODE: Generate sample melody without API call
    if (this.useMock) {
      return this.generateMockMelody(songStructure, emotion, mood, tempo, key, timeSignature);
    }

    // LLM CALL: Generate melody structure
    const completion = await this.openai!.chat.completions.create({
      model: this.getModel(),
      messages: [
        {
          role: 'system',
          content: `You are a professional music composer specializing in creating melodies that perfectly match lyrics. Generate MIDI note sequences that align with the rhythm, emotion, and mood of the lyrics.

MELODY GENERATION REQUIREMENTS:
- Match the emotional tone and mood of the lyrics
- Create melodies that flow naturally with the rhythm of the words
- Use appropriate musical scales and keys for the emotion (e.g., major for happy, minor for sad)
- Create memorable, singable melodies
- Ensure proper musical phrasing and structure
- Match the tempo and time signature preferences if provided
- Generate multiple tracks if needed (e.g., melody, harmony, bass)

MIDI NOTE FORMAT:
- MIDI note numbers: 0-127 (C4 = 60, middle C)
- Velocity: 0-127 (loudness, typically 60-100 for melodies)
- startTime: In beats (0.0 = start of song)
- duration: In beats (e.g., 0.5 = eighth note, 1.0 = quarter note, 2.0 = half note)

Return a complete melody structure with tempo, key, time signature, and tracks containing MIDI notes.`
        },
        {
          role: 'user',
          content: `Generate a MIDI melody structure for this song:

Title: ${songStructure.title}

Emotion: ${emotion}
Mood: ${mood}
${tempo ? `Preferred Tempo: ${tempo} BPM` : ''}
${key ? `Preferred Key: ${key}` : ''}
${timeSignature ? `Preferred Time Signature: ${timeSignature}` : ''}

Song Sections:
${songStructure.sections
  .sort((a, b) => a.order - b.order)
  .map(s => `${s.type.toUpperCase()} (order ${s.order}):\n${s.content}`)
  .join('\n\n')}

Create a melody that:
1. Matches the emotional tone (${emotion}, ${mood})
2. Flows naturally with the rhythm of the lyrics
3. Uses appropriate musical scales for the emotion
4. Creates memorable, singable melodies
5. Includes at least one main melody track
${tempo ? `6. Uses tempo ${tempo} BPM` : ''}
${key ? `7. Uses key ${key}` : ''}
${timeSignature ? `8. Uses time signature ${timeSignature}` : ''}

Provide the melody structure as JSON with this exact format:
{
  "tempo": <number 40-200>,
  "key": "<string, e.g., 'C major' or 'A minor'>",
  "timeSignature": "<string, e.g., '4/4' or '3/4'>",
  "tracks": [
    {
      "name": "<track name, e.g., 'Main Melody'>",
      "instrument": "<optional instrument name, e.g., 'piano' or 'synth'>",
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
  "totalBeats": <number, total length of melody in beats>
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

  private generateMockMelody(
    songStructure: SongStructure,
    emotion: string,
    mood: string,
    tempo?: number,
    key?: string,
    timeSignature?: string
  ): MelodyStructure {
    const defaultTempo = tempo || 120;
    const defaultKey = key || (emotion === 'sad' || mood === 'melancholic' ? 'A minor' : 'C major');
    const defaultTimeSignature = timeSignature || '4/4';
    
    // Generate simple melody notes
    const baseNote = emotion === 'sad' || mood === 'melancholic' ? 57 : 60; // A3 or C4
    const notes: Array<{ note: number; velocity: number; startTime: number; duration: number }> = [];
    
    // Create a simple melody pattern
    let currentBeat = 0;
    const sections = songStructure.sections.sort((a, b) => a.order - b.order);
    
    sections.forEach((section, idx) => {
      const sectionBeats = 8; // 8 beats per section (2 bars in 4/4)
      const sectionNotes = 4; // 4 notes per section
      
      for (let i = 0; i < sectionNotes; i++) {
        const noteOffset = i % 4;
        const note = baseNote + noteOffset * 2; // Simple ascending pattern
        notes.push({
          note: Math.min(127, Math.max(0, note)),
          velocity: 80,
          startTime: currentBeat + (i * sectionBeats / sectionNotes),
          duration: sectionBeats / sectionNotes,
        });
      }
      
      currentBeat += sectionBeats;
    });

    return {
      tempo: defaultTempo,
      key: defaultKey,
      timeSignature: defaultTimeSignature,
      tracks: [
        {
          name: 'Main Melody',
          instrument: 'piano',
          notes,
        },
      ],
      totalBeats: currentBeat,
    };
  }
}
