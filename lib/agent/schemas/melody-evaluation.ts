import { z } from 'zod';

export const MelodyEvaluationSchema = z.object({
  quality: z.number().min(0).max(10).describe('Quality score from 0-10'),
  strengths: z.array(z.string()).describe('List of what works well in the melody'),
  weaknesses: z.array(z.string()).describe('List of areas that need improvement'),
  suggestions: z.array(z.string()).describe('Specific suggestions for improvement'),
  needsImprovement: z.boolean().describe('Whether the melody should be improved'),
});

export type MelodyEvaluation = z.infer<typeof MelodyEvaluationSchema>;
