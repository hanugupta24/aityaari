"use server";

/**
 * @fileOverview Analyzes interview performance and provides detailed feedback,
 * including question-by-question analysis with ideal answers, suggestions, and scores.
 *
 * - analyzeInterviewFeedback - A function that analyzes interview performance and provides feedback.
 * - AnalyzeInterviewFeedbackInput - The input type for the analyzeInterviewFeedback function.
 * - AnalyzeInterviewFeedbackOutput - The return type for the analyzeInterviewFeedback function.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";
// Do not import GeneratedQuestionSchema from generate-interview-questions.ts as it's a 'use server' file
// Redefine it here if needed for the input schema.

// Schema for a single generated question, used as part of the input to this flow.
// This needs to match the structure of questions stored in the InterviewSession document.
const InterviewQuestionWithAnswerSchema = z.object({
  id: z.string().describe("A unique ID for the question (e.g., q1, q2)."),
  text: z.string().describe("The question text."),
  stage: z
    .enum(["oral", "technical_written"])
    .describe(
      'The stage of the interview this question belongs to: "oral" for spoken answers, "technical_written" for typed/coding answers.'
    ),
  type: z
    .enum([
      "behavioral",
      "technical",
      "coding",
      "conversational",
      "resume_based",
      "jd_based",
      "profile_based",
      "structured_exp_based",
      "structured_proj_based",
    ])
    .describe("The type of question."),
  answer: z.string().optional().describe("The user's answer to this question."),
});

// Schema for a single question's detailed feedback (part of the output)
const DetailedQuestionFeedbackItemSchema = z.object({
  questionId: z.string().describe("The ID of the original question."),
  questionText: z.string().describe("The text of the question that was asked."),
  userAnswer: z
    .string()
    .optional()
    .describe("The user's answer to this question."),
  idealAnswer: z
    .string()
    .describe("An example of a model or ideal answer for this question."),
  refinementSuggestions: z
    .string()
    .describe(
      "Specific suggestions on how the user could improve their answer to this particular question."
    ),
  score: z
    .number()
    .min(0)
    .max(10)
    .describe("A score for the user's answer to this question (0-10)."),
});

// Input schema for the feedback analysis flow
const AnalyzeInterviewFeedbackInputSchema = z.object({
  questions: z
    .array(InterviewQuestionWithAnswerSchema)
    .describe(
      "An array of all questions asked during the interview, including the user's answers."
    ),
  jobDescription: z
    .string()
    .describe(
      "The job description for the role the candidate interviewed for."
    ),
  candidateProfile: z
    .string()
    .describe(
      "Information about the candidate like skills, experience, profile field, and education."
    ),
  interviewTranscript: z // Keep for overall context or if AI needs full flow
    .string()
    .optional()
    .describe(
      "The full transcript of the interview, including AI questions and candidate answers. May be used for overall context if individual question objects are not sufficient."
    ),
  expectedAnswers: z
    .string()
    .optional()
    .describe(
      "General guidance on what constitutes good answers or key points for the interview questions (overall guidance)."
    ),
});

export type AnalyzeInterviewFeedbackInput = z.infer<
  typeof AnalyzeInterviewFeedbackInputSchema
>;

// Output schema for the feedback analysis flow
const AnalyzeInterviewFeedbackOutputSchema = z.object({
  overallScore: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Overall score for the interview from 0 to 100. Optional."),
  overallFeedback: z
    .string()
    .describe(
      "Overall feedback on the interview performance, including general impressions and summary."
    ),
  strengthsSummary: z
    .string()
    .describe(
      "Summary of strengths, well-answered questions, or positive aspects of the candidate's responses."
    ),
  weaknessesSummary: z
    .string()
    .describe(
      "Summary of weaknesses, poorly answered questions, or areas where the candidate struggled."
    ),
  overallAreasForImprovement: z
    .string()
    .describe(
      "Specific, actionable advice and areas for overall improvement based on the interview performance."
    ),
  detailedQuestionFeedback: z
    .array(DetailedQuestionFeedbackItemSchema)
    .optional()
    .describe("An array containing detailed feedback for each question asked."),
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
  name: "analyzeInterviewFeedbackPrompt",
  input: { schema: AnalyzeInterviewFeedbackInputSchema },
  output: { schema: AnalyzeInterviewFeedbackOutputSchema },
  prompt: `You are an AI-powered Interview Performance Analyzer. Your task is to analyze the candidate's performance based on the questions asked, their answers, the job description, and their profile. Provide detailed, constructive feedback.

Reference Information:
- Job Description: {{{jobDescription}}}
- Candidate Profile: {{{candidateProfile}}}
{{#if interviewTranscript}}
- Full Interview Transcript (for overall context):
{{{interviewTranscript}}}
{{/if}}
{{#if expectedAnswers}}
- General Expected Answer Guidelines (Overall): {{{expectedAnswers}}}
{{/if}}

Interview Questions & Answers:
{{#each questions}}
  Question ID: {{this.id}}
  Question Text: {{this.text}}
  Question Type: {{this.type}} (Stage: {{this.stage}})
  User's Answer: {{#if this.answer}}{{this.answer}}{{else}}[No answer provided by user for this question]{{/if}}
---
{{/each}}

Analysis Task:

Part 1: Detailed Question-by-Question Feedback
For each question listed above:
1.  Identify the original Question ID and Question Text.
2.  Note the User's Answer. If no answer was provided, state that.
3.  Provide an "Ideal Answer": Describe what a model or strong answer to this specific question would entail. Be concise but comprehensive.
4.  Provide "Refinement Suggestions": Offer specific, actionable advice on how the user could improve *their particular answer* to *this question*. If the answer was strong, highlight why. If weak, explain how to make it better.
5.  Assign a "Score" (0-10): Rate the user's answer for this question, where 0 is very poor and 10 is excellent.

Part 2: Overall Interview Assessment
After analyzing all questions individually, provide the following overall assessment:
1.  "Overall Score" (Optional, 0-100): If possible, assign an overall score reflecting the candidate's performance across all questions. If a score cannot be confidently assigned, omit this field.
2.  "Overall Feedback": Summarize the candidate's general performance. What were your overall impressions?
3.  "Strengths Summary": Highlight what the candidate did well overall. Which types of questions were answered effectively? What were their strong points across the interview?
4.  "Weaknesses Summary": Identify general areas where the candidate struggled. Which types of answers were generally weak or incorrect? Were there any recurring missed opportunities?
5.  "Overall Areas for Improvement": Provide specific, actionable suggestions for how the candidate can improve their interview skills and general answering strategies for future opportunities, based on their overall performance.

Focus on being constructive, fair, and helpful. The goal is to help the candidate learn and improve.
Ensure your entire output is a single JSON object that strictly adheres to the defined output schema, including the 'detailedQuestionFeedback' array and all other specified fields.
If a user did not provide an answer for a question, reflect that in the 'userAnswer' field for that question's feedback item, and the 'refinementSuggestions' and 'score' should reflect that no answer was given (e.g., score 0).
`,
});

const analyzeInterviewFeedbackFlow = ai.defineFlow(
  {
    name: "analyzeInterviewFeedbackFlow",
    inputSchema: AnalyzeInterviewFeedbackInputSchema,
    outputSchema: AnalyzeInterviewFeedbackOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      // Handle cases where AI might not return valid output
      console.error("AI failed to generate feedback. Input was:", input);
      throw new Error("AI failed to generate feedback.");
    }
    return output;
  }
);
