'use server';

/**
 * @fileOverview Analyzes interview performance and provides detailed feedback.
 *
 * - analyzeInterviewFeedback - A function that analyzes interview performance and provides feedback.
 * - AnalyzeInterviewFeedbackInput - The input type for the analyzeInterviewFeedback function.
 * - AnalyzeInterviewFeedbackOutput - The return type for the analyzeInterviewFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeInterviewFeedbackInputSchema = z.object({
  interviewTranscript: z
    .string()
    .describe('The transcript of the interview.'),
  jobDescription: z
    .string()
    .describe('The job description for the role the candidate interviewed for.'),
  candidateProfile: z
    .string()
    .describe('Information about the candidate like skills and experience.'),
  expectedAnswers: z
    .string()
    .optional()
    .describe('The expected answers for the interview questions.'),
});

export type AnalyzeInterviewFeedbackInput = z.infer<
  typeof AnalyzeInterviewFeedbackInputSchema
>;

const AnalyzeInterviewFeedbackOutputSchema = z.object({
  overallFeedback: z.string().describe('Overall feedback on the interview.'),
  correctAnswers: z
    .string()
    .describe('Feedback on correct answers provided during the interview.'),
  incorrectAnswers: z
    .string()
    .describe('Feedback on incorrect answers provided during the interview.'),
  areasForImprovement: z
    .string()
    .describe('Areas for improvement based on the interview performance.'),
});

export type AnalyzeInterviewFeedbackOutput = z.infer<
  typeof AnalyzeInterviewFeedbackOutputSchema
>;

export async function analyzeInterviewFeedback(
  input: AnalyzeInterviewFeedbackInput
): Promise<AnalyzeInterviewFeedbackOutput> {
  return analyzeInterviewFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeInterviewFeedbackPrompt',
  input: {schema: AnalyzeInterviewFeedbackInputSchema},
  output: {schema: AnalyzeInterviewFeedbackOutputSchema},
  prompt: `You are an AI-powered interview analyzer. Your task is to analyze the interview transcript, job description, and candidate profile to provide detailed feedback on the candidate's performance.

Consider the following information:

Job Description: {{{jobDescription}}}
Candidate Profile: {{{candidateProfile}}}
Interview Transcript: {{{interviewTranscript}}}
Expected Answers (if available): {{{expectedAnswers}}}

Provide feedback on the following aspects:

*   Overall performance during the interview.
*   Correct answers provided by the candidate.
*   Incorrect answers provided by the candidate.
*   Areas for improvement to enhance the candidate's interview skills.

Format your response as follows:

Overall Feedback: ...
Correct Answers: ...
Incorrect Answers: ...
Areas for Improvement: ...`,
});

const analyzeInterviewFeedbackFlow = ai.defineFlow(
  {
    name: 'analyzeInterviewFeedbackFlow',
    inputSchema: AnalyzeInterviewFeedbackInputSchema,
    outputSchema: AnalyzeInterviewFeedbackOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
