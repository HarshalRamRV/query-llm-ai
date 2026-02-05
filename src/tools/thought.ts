import { z } from 'zod';

export const thought_schema = z.object({
  thought: z.string().min(1, 'Thought is required'),
});

export type thought_input = z.infer<typeof thought_schema>;

export const execute_thought = async (args: thought_input): Promise<{ thought: string }> => {
  return { thought: args.thought };
};
