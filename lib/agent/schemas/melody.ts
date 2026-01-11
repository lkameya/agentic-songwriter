import { z } from 'zod';

export const MidiNoteSchema = z.object({
  note: z.number().min(0).max(127), // MIDI note number
  velocity: z.number().min(0).max(127), // 0-127
  startTime: z.number(), // In beats
  duration: z.number(),  // In beats
});

export const MidiTrackSchema = z.object({
  name: z.string(),
  notes: z.array(MidiNoteSchema),
  instrument: z.string().optional(), // e.g., "piano", "synth"
});

export const MelodyStructureSchema = z.object({
  tempo: z.number().min(40).max(200), // BPM
  key: z.string(), // e.g., "C major", "A minor"
  timeSignature: z.string(), // e.g., "4/4"
  tracks: z.array(MidiTrackSchema),
  totalBeats: z.number(),
});

export type MidiNote = z.infer<typeof MidiNoteSchema>;
export type MidiTrack = z.infer<typeof MidiTrackSchema>;
export type MelodyStructure = z.infer<typeof MelodyStructureSchema>;
