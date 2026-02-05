import { tool } from 'ai';
import { calculate_schema, execute_calculate } from '@/tools/calculate';
import { thought_schema, execute_thought } from '@/tools/thought';

export const tool_registry = {
  thought: tool({
    description: 'Capture internal reasoning for UI display.',
    parameters: thought_schema,
    execute: async (args) => execute_thought(args),
  }),
  calculate: tool({
    description: 'Safely evaluate a math expression.',
    parameters: calculate_schema,
    execute: async (args) => execute_calculate(args),
  }),
};
