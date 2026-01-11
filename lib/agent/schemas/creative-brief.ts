import { z } from 'zod';

// CreativeBrief is created deterministically by BriefAgent (rule-based, NO LLM)
// BriefAgent derives mood, themes, tempo from emotion/genre inputs using rule-based logic
export const CreativeBriefSchema = z.object({
  lyrics: z.string().min(1, 'Lyrics are required'),
  emotion: z.string().min(1, 'Emotion is required'),
  genre: z.string().optional(),
  mood: z.string(), // Derived deterministically from emotion (e.g., "sad" → "melancholic")
  themes: z.array(z.string()), // Derived deterministically from emotion (e.g., "sad" → ["loss", "nostalgia"])
  tempo: z.enum(['slow', 'moderate', 'fast']).optional(), // Derived from emotion/genre rules
  style: z.string().optional(), // Derived from genre if provided
  language: z.enum(['en', 'pt-BR']).default('en'), // Output language for generated content
});

export type CreativeBrief = z.infer<typeof CreativeBriefSchema>;
