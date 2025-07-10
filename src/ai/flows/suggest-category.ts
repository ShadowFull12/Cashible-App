'use server';

/**
 * @fileOverview A Genkit flow for suggesting an expense category based on a description.
 *
 * - suggestCategory - A function that takes an expense description and a list of categories and returns the best fit.
 * - SuggestCategoryInput - The input type for the suggestCategory function.
 * - SuggestCategoryOutput - The return type for the suggestCategory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const SuggestCategoryInputSchema = z.object({
  description: z.string().describe('The description of the expense.'),
  categories: z.array(z.string()).describe('A list of available categories to choose from.'),
});
export type SuggestCategoryInput = z.infer<typeof SuggestCategoryInputSchema>;

const SuggestCategoryOutputSchema = z.object({
  category: z.string().describe('The suggested category from the provided list. Can be an empty string if no suitable category is found.'),
});
export type SuggestCategoryOutput = z.infer<typeof SuggestCategoryOutputSchema>;

export async function suggestCategory(input: SuggestCategoryInput): Promise<SuggestCategoryOutput> {
  return suggestCategoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestCategoryPrompt',
  input: {schema: SuggestCategoryInputSchema},
  output: {schema: SuggestCategoryOutputSchema},
  prompt: `You are an expert at categorizing personal expenses. Based on the expense description, choose the single most appropriate category from the provided list.

Only return one category name exactly as it appears in the list. Do not make up new categories.

If no category from the list is a good fit, you can return an empty string for the category field.

Available Categories:
{{{json categories}}}

Expense Description:
"{{{description}}}"`,
});

const suggestCategoryFlow = ai.defineFlow(
  {
    name: 'suggestCategoryFlow',
    inputSchema: SuggestCategoryInputSchema,
    outputSchema: SuggestCategoryOutputSchema,
  },
  async input => {
    if (input.categories.length === 0) {
      return { category: "" };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
