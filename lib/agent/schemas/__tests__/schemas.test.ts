import { SongStructureSchema, SectionSchema } from '../song-structure';
import { CreativeBriefSchema } from '../creative-brief';
import { MelodyStructureSchema, MidiNoteSchema, MidiTrackSchema } from '../melody';
import { LyricsEvaluationSchema } from '../evaluation';
import { MelodyEvaluationSchema } from '../melody-evaluation';
import { z } from 'zod';

describe('Schemas', () => {
  describe('SectionSchema', () => {
    it('should validate valid section', () => {
      const validSection = {
        type: 'verse',
        content: 'Test content',
        order: 0,
      };
      expect(() => SectionSchema.parse(validSection)).not.toThrow();
      const parsed = SectionSchema.parse(validSection);
      expect(parsed.type).toBe('verse');
      expect(parsed.content).toBe('Test content');
      expect(parsed.order).toBe(0);
    });

    it('should validate all section types', () => {
      const types = ['verse', 'chorus', 'bridge', 'intro', 'outro'] as const;
      
      types.forEach(type => {
        const section = { type, content: 'Test', order: 0 };
        expect(() => SectionSchema.parse(section)).not.toThrow();
      });
    });

    it('should reject invalid section type', () => {
      const invalidSection = {
        type: 'invalid',
        content: 'Test',
        order: 0,
      };
      expect(() => SectionSchema.parse(invalidSection)).toThrow();
    });

    it('should reject missing required fields', () => {
      expect(() => SectionSchema.parse({})).toThrow();
      expect(() => SectionSchema.parse({ type: 'verse' })).toThrow();
      expect(() => SectionSchema.parse({ content: 'Test' })).toThrow();
      expect(() => SectionSchema.parse({ order: 0 })).toThrow();
    });

    it('should reject invalid order type', () => {
      const invalidSection = {
        type: 'verse',
        content: 'Test',
        order: 'not-a-number',
      };
      expect(() => SectionSchema.parse(invalidSection)).toThrow();
    });
  });

  describe('SongStructureSchema', () => {
    it('should validate valid song structure', () => {
      const validSong = {
        title: 'Test Song',
        sections: [
          { type: 'verse' as const, content: 'Verse 1', order: 0 },
          { type: 'chorus' as const, content: 'Chorus', order: 1 },
        ],
        totalSections: 2,
      };
      expect(() => SongStructureSchema.parse(validSong)).not.toThrow();
      const parsed = SongStructureSchema.parse(validSong);
      expect(parsed.title).toBe('Test Song');
      expect(parsed.sections).toHaveLength(2);
      expect(parsed.totalSections).toBe(2);
    });

    it('should reject missing title', () => {
      const invalidSong = {
        sections: [{ type: 'verse' as const, content: 'Test', order: 0 }],
        totalSections: 1,
      };
      expect(() => SongStructureSchema.parse(invalidSong)).toThrow();
    });

    it('should reject missing sections', () => {
      const invalidSong = {
        title: 'Test',
        totalSections: 0,
      };
      expect(() => SongStructureSchema.parse(invalidSong)).toThrow();
    });

    it('should reject invalid totalSections', () => {
      const invalidSong = {
        title: 'Test',
        sections: [{ type: 'verse' as const, content: 'Test', order: 0 }],
        totalSections: 'not-a-number',
      };
      expect(() => SongStructureSchema.parse(invalidSong)).toThrow();
    });
  });

  describe('MidiNoteSchema', () => {
    it('should validate valid MIDI note', () => {
      const validNote = {
        note: 60,
        velocity: 80,
        startTime: 0,
        duration: 1,
      };
      expect(() => MidiNoteSchema.parse(validNote)).not.toThrow();
    });

    it('should reject note outside 0-127 range', () => {
      const invalidNote1 = { note: -1, velocity: 80, startTime: 0, duration: 1 };
      const invalidNote2 = { note: 128, velocity: 80, startTime: 0, duration: 1 };
      
      expect(() => MidiNoteSchema.parse(invalidNote1)).toThrow();
      expect(() => MidiNoteSchema.parse(invalidNote2)).toThrow();
    });

    it('should reject velocity outside 0-127 range', () => {
      const invalidNote = { note: 60, velocity: 200, startTime: 0, duration: 1 };
      expect(() => MidiNoteSchema.parse(invalidNote)).toThrow();
    });
  });

  describe('MidiTrackSchema', () => {
    it('should validate valid MIDI track', () => {
      const validTrack = {
        name: 'Main Melody',
        notes: [
          { note: 60, velocity: 80, startTime: 0, duration: 1 },
          { note: 62, velocity: 80, startTime: 1, duration: 1 },
        ],
      };
      expect(() => MidiTrackSchema.parse(validTrack)).not.toThrow();
    });

    it('should validate track with optional instrument', () => {
      const validTrack = {
        name: 'Main Melody',
        instrument: 'piano',
        notes: [{ note: 60, velocity: 80, startTime: 0, duration: 1 }],
      };
      expect(() => MidiTrackSchema.parse(validTrack)).not.toThrow();
      const parsed = MidiTrackSchema.parse(validTrack);
      expect(parsed.instrument).toBe('piano');
    });

    it('should reject track without name', () => {
      const invalidTrack = {
        notes: [{ note: 60, velocity: 80, startTime: 0, duration: 1 }],
      };
      expect(() => MidiTrackSchema.parse(invalidTrack)).toThrow();
    });
  });

  describe('MelodyStructureSchema', () => {
    it('should validate valid melody structure', () => {
      const validMelody = {
        tempo: 120,
        key: 'C major',
        timeSignature: '4/4',
        tracks: [
          {
            name: 'Main Melody',
            notes: [
              { note: 60, velocity: 80, startTime: 0, duration: 1 },
            ],
          },
        ],
        totalBeats: 16,
      };
      expect(() => MelodyStructureSchema.parse(validMelody)).not.toThrow();
    });

    it('should reject tempo outside 40-200 range', () => {
      const invalidMelody1 = {
        tempo: 30,
        key: 'C major',
        timeSignature: '4/4',
        tracks: [],
        totalBeats: 16,
      };
      const invalidMelody2 = {
        tempo: 250,
        key: 'C major',
        timeSignature: '4/4',
        tracks: [],
        totalBeats: 16,
      };
      
      expect(() => MelodyStructureSchema.parse(invalidMelody1)).toThrow();
      expect(() => MelodyStructureSchema.parse(invalidMelody2)).toThrow();
    });

    it('should reject missing required fields', () => {
      expect(() => MelodyStructureSchema.parse({})).toThrow();
    });
  });

  describe('CreativeBriefSchema', () => {
    it('should validate valid creative brief', () => {
      const validBrief = {
        lyrics: 'Test lyrics',
        emotion: 'happy',
        mood: 'energetic',
        themes: ['love', 'joy'],
      };
      expect(() => CreativeBriefSchema.parse(validBrief)).not.toThrow();
    });

    it('should validate brief with optional fields', () => {
      const validBrief = {
        lyrics: 'Test',
        emotion: 'happy',
        mood: 'energetic',
        themes: ['love'],
        genre: 'pop',
        tempo: 'moderate',
        style: 'uplifting',
      };
      expect(() => CreativeBriefSchema.parse(validBrief)).not.toThrow();
    });

    it('should reject missing required fields', () => {
      expect(() => CreativeBriefSchema.parse({})).toThrow();
    });
  });

  describe('LyricsEvaluationSchema', () => {
    it('should validate valid lyrics evaluation', () => {
      const validEval = {
        quality: 8.5,
        strengths: ['Good'],
        weaknesses: ['Needs work'],
        suggestions: ['Improve'],
        needsImprovement: false,
      };
      expect(() => LyricsEvaluationSchema.parse(validEval)).not.toThrow();
    });

    it('should reject quality outside 0-10 range', () => {
      const invalidEval = {
        quality: 15,
        strengths: [],
        weaknesses: [],
        suggestions: [],
        needsImprovement: false,
      };
      expect(() => LyricsEvaluationSchema.parse(invalidEval)).toThrow();
    });
  });

  describe('MelodyEvaluationSchema', () => {
    it('should validate valid melody evaluation', () => {
      const validEval = {
        quality: 8.5,
        strengths: ['Good'],
        weaknesses: ['Needs work'],
        suggestions: ['Improve'],
        needsImprovement: false,
      };
      expect(() => MelodyEvaluationSchema.parse(validEval)).not.toThrow();
    });

    it('should reject invalid needsImprovement type', () => {
      const invalidEval = {
        quality: 8.5,
        strengths: [],
        weaknesses: [],
        suggestions: [],
        needsImprovement: 'yes',
      };
      expect(() => MelodyEvaluationSchema.parse(invalidEval)).toThrow();
    });
  });
});
