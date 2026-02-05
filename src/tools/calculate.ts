import { z } from 'zod';
import { Parser } from 'expr-eval';

export const calculate_schema = z.object({
  expression: z.string().min(1, 'Expression is required'),
});

export type calculate_input = z.infer<typeof calculate_schema>;

const parser = new Parser({
  operators: {
    logical: false,
    comparison: false,
    in: false,
    assignment: false,
  },
});

export const execute_calculate = async (
  args: calculate_input
): Promise<{ expression: string; value: number }> => {
  const value = parser.evaluate(args.expression);
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error('Invalid calculation result');
  }
  return { expression: args.expression, value };
};
