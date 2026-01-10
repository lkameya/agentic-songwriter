import { z } from 'zod';

export const SectionSchema = z.object({
  type: z.enum(['verse', 'chorus', 'bridge', 'intro', 'outro']),
  content: z.string(),
  order: z.number(),
});

export const SongStructureSchema = z.object({
  title: z.string(),
  sections: z.array(SectionSchema),
  totalSections: z.number(),
});

export type SongStructure = z.infer<typeof SongStructureSchema>;
export type Section = z.infer<typeof SectionSchema>;
