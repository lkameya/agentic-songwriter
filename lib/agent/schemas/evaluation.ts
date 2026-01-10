import { z } from 'zod';

export const LyricsEvaluationSchema = z.object({
  quality: z.number().min(0).max(10).describe('Quality score from 0-10'),
  strengths: z.array(z.string()).describe('List of what works well in the lyrics'),
  weaknesses: z.array(z.string()).describe('List of areas that need improvement'),
  suggestions: z.array(z.string()).describe('Specific suggestions for improvement'),
  needsImprovement: z.boolean().describe('Whether the lyrics should be improved'),
});

export type LyricsEvaluation = z.infer<typeof LyricsEvaluationSchema>;
