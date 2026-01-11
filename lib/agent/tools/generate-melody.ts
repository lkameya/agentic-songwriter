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
          content: `You are an award-winning professional music composer and songwriter with decades of experience creating sophisticated, memorable melodies for hit songs. Generate professional-grade MIDI note sequences that perfectly match lyrics with exceptional musical quality.

PROFESSIONAL MELODY COMPOSITION REQUIREMENTS:

1. NOTE DENSITY (CRITICAL):
   - Generate DENSE melodies with 4-8 notes per line of lyrics (not sparse)
   - Each syllable/word should typically have 1-2 notes, with more for emphasized words
   - Use varied note durations (eighth notes, quarter notes, half notes, sixteenth notes)
   - Include passing tones, grace notes, and melodic embellishments for musical interest
   - Aim for professional-level complexity, not simple nursery-rhyme melodies

2. MELODIC STRUCTURE & PHRASING:
   - Create well-shaped melodic phrases that have clear beginning, middle, and end
   - Use melodic contour (ascending, descending, arch-shaped phrases) for musical interest
   - Build phrases that breathe and flow naturally with the lyrics
   - Create melodic motifs and variations (repeat and develop musical ideas)
   - Use step-wise motion primarily, with strategic leaps for emphasis

3. MUSICAL SOPHISTICATION:
   - Add melodic interest through: sequences, suspensions, appoggiaturas, and passing tones
   - Create rhythmic variety (syncopation, varied note values, rhythmic patterns)
   - Use chromatic passing tones and neighboring tones for color
   - Vary melodic contour between sections (verse vs chorus should have different character)
   - Build melodic climaxes at important lyrical moments

4. EMOTIONAL EXPRESSION:
   - Match the emotional tone and mood of the lyrics precisely
   - Use appropriate musical scales and modes for the emotion (major, minor, modal, etc.)
   - Create melodies that enhance the emotional impact of the words
   - Use dynamics (velocity) to emphasize important words/phrases
   - Create musical tension and release that matches lyrical content

5. VOCAL CONSIDERATIONS:
   - Write singable melodies (avoid extreme leaps, consider vocal range)
   - Match melodic rhythm to natural speech rhythms of the lyrics
   - Create memorable melodic hooks, especially in the chorus
   - Use melodic repetition strategically (but with variation)

6. SECTION VARIATION:
   - Verses: More restrained, narrative quality
   - Chorus: More memorable, higher energy, stronger melodic hooks
   - Bridge: Contrasting melodic material, new musical ideas
   - Intro/Outro: Establish or resolve melodic themes

MIDI NOTE FORMAT:
- MIDI note numbers: 0-127 (C4 = 60, middle C)
- Velocity: 0-127 (use 70-110 for main melody, vary for expression)
- startTime: In beats (0.0 = start of song, precise to 0.25 beats minimum)
- duration: In beats (use varied durations: 0.25 = sixteenth, 0.5 = eighth, 1.0 = quarter, 1.5 = dotted quarter, 2.0 = half, etc.)

CRITICAL: Generate PROFESSIONAL-LEVEL melodies with high note density (4-8 notes per line), sophisticated phrasing, and musical interest throughout. This should sound like a professional songwriter's work, not a simple exercise.`
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

Create a PROFESSIONAL-LEVEL melody that:

1. **NOTE DENSITY**: Generate 4-8 notes per line of lyrics (DENSE, not sparse)
   - Each word/syllable should typically have 1-2 notes
   - Use varied note durations (eighth notes, quarter notes, sixteenth notes, etc.)
   - Include melodic embellishments and passing tones for sophistication

2. **MELODIC QUALITY**: Professional composition techniques
   - Create well-shaped melodic phrases with clear contour
   - Use melodic motifs that repeat and vary throughout
   - Add rhythmic interest (syncopation, varied note values)
   - Build melodic climaxes at important lyrical moments
   - Use step-wise motion with strategic leaps

3. **EMOTIONAL MATCH**: 
   - Matches the emotional tone (${emotion}, ${mood})
   - Uses appropriate musical scales and modes for the emotion
   - Enhances the emotional impact of the lyrics

4. **SECTION VARIATION**:
   - Verse: More narrative, restrained quality
   - Chorus: Memorable hooks, higher energy, stronger melodic ideas
   - Bridge: Contrasting melodic material
   - Each section should have distinct melodic character

5. **COVERAGE**: 
   - COVERS THE ENTIRE SONG - generate notes for ALL sections and ALL lines
   - Estimate 4-8 beats per line of lyrics (2 bars per line in 4/4)
   - Generate notes for every word/syllable, not just a few sparse notes
   - Total beats = (number of lines) × (4-8 beats per line)

6. **MUSICAL SOPHISTICATION**:
   - Include passing tones, neighboring tones, and melodic embellishments
   - Vary velocity (70-110) to emphasize important words
   - Create memorable melodic hooks, especially in the chorus
   - Use musical tension and release appropriately

${tempo ? `7. Uses tempo ${tempo} BPM` : '7. Uses appropriate tempo for the style'}
${key ? `8. Uses key ${key}` : '8. Uses appropriate key for the emotion'}
${timeSignature ? `9. Uses time signature ${timeSignature}` : '9. Uses 4/4 time signature'}

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
      temperature: 0.9, // Higher temperature for more creative, varied melodies
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
    
    // Generate professional-level dense melody notes
    const baseNote = emotion === 'sad' || mood === 'melancholic' ? 57 : 60; // A3 or C4
    const notes: Array<{ note: number; velocity: number; startTime: number; duration: number }> = [];
    
    // Create a more sophisticated melody pattern with higher note density
    let currentBeat = 0;
    const sections = songStructure.sections.sort((a, b) => a.order - b.order);
    
    sections.forEach((section, idx) => {
      // Calculate beats per section based on number of lines
      const sectionLines = section.content.split('\n').filter(l => l.trim());
      const linesCount = sectionLines.length || 4; // Default to 4 if empty
      const beatsPerLine = 6; // 6 beats per line (1.5 bars in 4/4) for more space
      const sectionBeats = linesCount * beatsPerLine;
      
      // Professional density: 5-7 notes per line (not just 2)
      const notesPerLine = 6;
      const sectionNotes = linesCount * notesPerLine;
      const noteSpacing = sectionBeats / sectionNotes;
      
      for (let i = 0; i < sectionNotes; i++) {
        const lineIndex = Math.floor(i / notesPerLine);
        const noteInLine = i % notesPerLine;
        const beatPosition = currentBeat + (i * noteSpacing);
        
        // Create more sophisticated melodic pattern with variation
        const patternOffset = (noteInLine % 4) * 2; // Step-wise motion with small leaps
        const sectionVariation = idx % 2 === 0 ? 0 : 2; // Vary by section
        const note = baseNote + patternOffset + sectionVariation;
        
        // Vary durations for interest (eighth notes, quarter notes, dotted notes)
        const durations = [0.5, 0.5, 0.75, 1.0, 0.5, 1.25];
        const duration = durations[noteInLine % durations.length];
        
        // Vary velocity for expression (70-95)
        const velocity = 75 + (noteInLine % 5) * 4;
        
        notes.push({
          note: Math.min(127, Math.max(0, note)),
          velocity: Math.min(127, Math.max(70, velocity)),
          startTime: Math.round(beatPosition * 100) / 100, // Round to 2 decimals
          duration: duration,
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
