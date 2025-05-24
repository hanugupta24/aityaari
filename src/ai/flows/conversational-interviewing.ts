// src/ai/flows/conversational-interviewing.ts
'use server';
/**
 * @fileOverview An AI agent that guides the user through a conversational style interview.
 *
 * - conversationalInterview - A function that initiates and conducts the conversational interview.
 * - ConversationalInterviewInput - The input type for the conversationalInterview function.
 * - ConversationalInterviewOutput - The return type for the conversationalInterview function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ConversationalInterviewInputSchema = z.object({
  interviewLengthMinutes: z
    .number()
    .describe('The length of the interview in minutes. Must be 15, 30, or 45.'),
  userProfile: z.string().describe('The user profile, including role, company, education, etc.'),
});
export type ConversationalInterviewInput = z.infer<typeof ConversationalInterviewInputSchema>;

const ConversationalInterviewOutputSchema = z.object({
  interviewTranscript: z.string().describe('The transcript of the entire interview.'),
  feedback: z.string().describe('Detailed feedback on the interview performance.'),
});
export type ConversationalInterviewOutput = z.infer<typeof ConversationalInterviewOutputSchema>;

export async function conversationalInterview(input: ConversationalInterviewInput): Promise<ConversationalInterviewOutput> {
  return conversationalInterviewFlow(input);
}

const conversationalInterviewPrompt = ai.definePrompt({
  name: 'conversationalInterviewPrompt',
  input: {schema: ConversationalInterviewInputSchema},
  output: {schema: ConversationalInterviewOutputSchema},
  prompt: `You are an AI interviewer conducting a conversational interview.

The interview will last {{interviewLengthMinutes}} minutes.

Here is information about the candidate:
{{{userProfile}}}

Ask the candidate questions relevant to their profile and experience.

Make the interview conversational and engaging.

At the end of the interview, provide detailed feedback on the candidate's performance, including strengths and areas for improvement. Output the entire interview transcript along with the feedback.
`,
});

const conversationalInterviewFlow = ai.defineFlow(
  {
    name: 'conversationalInterviewFlow',
    inputSchema: ConversationalInterviewInputSchema,
    outputSchema: ConversationalInterviewOutputSchema,
  },
  async input => {
    const {output} = await conversationalInterviewPrompt(input);
    return output!;
  }
);
