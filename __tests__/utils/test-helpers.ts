import { StateStore } from '@/lib/agent/core/state-store';
import { Trace } from '@/lib/agent/core/trace';
import { SongStructure } from '@/lib/agent/schemas/song-structure';
import { MelodyStructure } from '@/lib/agent/schemas/melody';
import { LyricsEvaluation } from '@/lib/agent/schemas/evaluation';
import { CreativeBrief } from '@/lib/agent/schemas/creative-brief';

export function createMockSongStructure(): SongStructure {
  return {
    title: 'Test Song',
    sections: [
      { type: 'verse', content: 'Verse line 1\nVerse line 2', order: 0 },
      { type: 'chorus', content: 'Chorus line 1\nChorus line 2', order: 1 },
    ],
    totalSections: 2,
  };
}

export function createMockMelodyStructure(): MelodyStructure {
  return {
    tempo: 120,
    key: 'C major',
    timeSignature: '4/4',
    tracks: [
      {
        name: 'Main Melody',
        notes: [
          { note: 60, velocity: 80, startTime: 0, duration: 1 },
          { note: 62, velocity: 80, startTime: 1, duration: 1 },
          { note: 64, velocity: 80, startTime: 2, duration: 1 },
          { note: 65, velocity: 80, startTime: 3, duration: 1 },
        ],
      },
    ],
    totalBeats: 16,
  };
}

export function createMockLyricsEvaluation(): LyricsEvaluation {
  return {
    quality: 8.5,
    strengths: ['Good emotional impact', 'Memorable chorus'],
    weaknesses: ['Could use more imagery'],
    suggestions: ['Add more specific details', 'Strengthen the bridge'],
    needsImprovement: false,
  };
}

export function createMockCreativeBrief(): CreativeBrief {
  return {
    lyrics: 'Test lyrics',
    emotion: 'happy',
    mood: 'energetic',
    themes: ['love', 'joy'],
    genre: 'pop',
    tempo: 'moderate',
    style: 'uplifting',
  };
}

export function createTestStateStore(): StateStore {
  return new StateStore();
}

export function createTestTrace(): Trace {
  return new Trace();
}
