
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
    .describe('The transcript of the interview, including AI questions and candidate answers.'),
  jobDescription: z
    .string()
    .describe('The job description for the role the candidate interviewed for.'),
  candidateProfile: z
    .string()
    .describe('Information about the candidate like skills, experience, profile field, and education.'),
  expectedAnswers: z // This remains optional as it might not always be available
    .string()
    .optional()
    .describe('General guidance on what constitutes good answers or key points for the interview questions.'),
});

export type AnalyzeInterviewFeedbackInput = z.infer<
  typeof AnalyzeInterviewFeedbackInputSchema
>;

// Updated output schema based on type definition
const AnalyzeInterviewFeedbackOutputSchema = z.object({
  overallScore: z.number().min(0).max(100).optional().describe('Overall score for the interview from 0 to 100. Optional.'),
  overallFeedback: z.string().describe('Overall feedback on the interview performance, including general impressions and summary.'),
  correctAnswersSummary: z
    .string()
    .describe('Summary of strengths, well-answered questions, or positive aspects of the candidate\'s responses.'),
  incorrectAnswersSummary: z
    .string()
    .describe('Summary of weaknesses, poorly answered questions, or areas where the candidate struggled.'),
  areasForImprovement: z
    .string()
    .describe('Specific, actionable advice and areas for improvement based on the interview performance.'),
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
  prompt: `You are an AI-powered interview performance analyzer. Your task is to analyze the interview transcript, job description, and candidate profile to provide detailed, constructive feedback on the candidate's performance.

Consider the following information:

Job Description: {{{jobDescription}}}
Candidate Profile: {{{candidateProfile}}}
Interview Transcript:
{{{interviewTranscript}}}
Expected Answer Guidelines (if available): {{{expectedAnswers}}}

Please provide feedback structured as follows:

1.  **Overall Score (Optional)**: If possible, assign an overall score from 0 to 100 reflecting the candidate's performance. If a score cannot be confidently assigned, omit this field or provide a qualitative assessment.
2.  **Overall Feedback**: Summarize the candidate's general performance. What were your overall impressions?
3.  **Correct Answers / Strengths**: Highlight what the candidate did well. Which questions were answered effectively? What were their strong points?
4.  **Incorrect Answers / Weaknesses**: Identify areas where the candidate struggled. Which answers were weak or incorrect? Were there any missed opportunities?
5.  **Areas for Improvement**: Provide specific, actionable suggestions for how the candidate can improve their interview skills and answers for future opportunities.

Focus on being constructive and helpful. The goal is to help the candidate learn and improve.
`,
});

const analyzeInterviewFeedbackFlow = ai.defineFlow(
  {
    name: 'analyzeInterviewFeedbackFlow',
    inputSchema: AnalyzeInterviewFeedbackInputSchema,
    outputSchema: AnalyzeInterviewFeedbackOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
        // Handle cases where AI might not return valid output
        throw new Error("AI failed to generate feedback.");
    }
    return output;
  }
);
