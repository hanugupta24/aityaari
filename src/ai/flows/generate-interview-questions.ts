
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating interview questions based on user profile, role, and interview duration.
 * It aims to create a mix of oral and technical/written questions as appropriate.
 *
 * - generateInterviewQuestions - A function that generates interview questions.
 * - GenerateInterviewQuestionsInput - The input type for the generateInterviewQuestions function.
 * - GenerateInterviewQuestionsOutput - The output type for the generateInterviewQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { GeneratedQuestion } from '@/types'; // Assuming GeneratedQuestion type is updated

const GenerateInterviewQuestionsInputSchema = z.object({
  profileField: z.string().describe('The user profile field, e.g., Software Engineering, Data Science.'),
  role: z.string().describe('The user role, e.g., Frontend Developer, Product Manager.'),
  interviewDuration: z.enum(['15', '30', '45']).describe('The selected interview duration in minutes.'),
});
export type GenerateInterviewQuestionsInput = z.infer<
  typeof GenerateInterviewQuestionsInputSchema
>;

const GeneratedQuestionSchema = z.object({
  id: z.string().describe('A unique ID for the question.'),
  text: z.string().describe('The question text.'),
  stage: z.enum(['oral', 'technical_written']).describe('The stage of the interview this question belongs to.'),
  type: z.enum(['behavioral', 'technical', 'coding', 'conversational']).describe('The type of question.'),
});

const GenerateInterviewQuestionsOutputSchema = z.object({
  questions: z.array(GeneratedQuestionSchema).describe('An array of generated interview questions with stages and types.'),
});
export type GenerateInterviewQuestionsOutput = z.infer<
  typeof GenerateInterviewQuestionsOutputSchema
>;

export async function generateInterviewQuestions(
  input: GenerateInterviewQuestionsInput
): Promise<GenerateInterviewQuestionsOutput> {
  return generateInterviewQuestionsFlow(input);
}

const technicalRolesKeywords = ['developer', 'engineer', 'scientist', 'analyst', 'architect', 'programmer', 'data', 'software', 'backend', 'frontend', 'fullstack', 'flutter'];

const prompt = ai.definePrompt({
  name: 'generateInterviewQuestionsPrompt',
  input: {schema: GenerateInterviewQuestionsInputSchema},
  output: {schema: GenerateInterviewQuestionsOutputSchema},
  prompt: `You are an expert interviewer. Generate interview questions based on the user's profile field, role, and desired interview duration.
The interview should consist of two stages if the role is technical: 'oral' and 'technical_written'. Non-technical roles may only have an 'oral' stage.

Profile Field: {{{profileField}}}
Role: {{{role}}}
Interview Duration: {{{interviewDuration}}} minutes

Guidelines:
1.  Determine if the role is technical. Roles containing keywords like 'developer', 'engineer', 'scientist', 'analyst', 'architect', 'programmer', 'data', 'software', 'backend', 'frontend', 'fullstack', 'flutter' are considered technical.
2.  Question Distribution based on Duration:
    *   15 minutes:
        *   Non-technical: 3-4 'oral' questions (mix of 'conversational' and 'behavioral').
        *   Technical: 2-3 'oral' questions (mix of 'conversational' and 'behavioral'), followed by 1 'technical_written' question ('technical' or 'coding').
    *   30 minutes:
        *   Non-technical: 5-6 'oral' questions.
        *   Technical: 3-4 'oral' questions, followed by 2 'technical_written' questions.
    *   45 minutes:
        *   Non-technical: 7-8 'oral' questions.
        *   Technical: 4-5 'oral' questions, followed by 2-3 'technical_written' questions.
3.  'oral' stage questions: Should be answerable verbally. Types can be 'conversational' (e.g., "Tell me about yourself") or 'behavioral' (e.g., "Describe a time you faced a challenge").
4.  'technical_written' stage questions: Should require a typed/written answer. Types can be 'technical' (e.g., "Explain the concept of X specific to {{{profileField}}}") or 'coding' (e.g., "Write a function to do Y relevant to {{{role}}}").
5.  Ensure questions are relevant to the provided 'profileField' and 'role'.
6.  Each question must have a unique 'id' (e.g., "q1", "q2"), 'text', 'stage', and 'type'.

Generate the questions array.
`,
});


const generateInterviewQuestionsFlow = ai.defineFlow(
  {
    name: 'generateInterviewQuestionsFlow',
    inputSchema: GenerateInterviewQuestionsInputSchema,
    outputSchema: GenerateInterviewQuestionsOutputSchema,
  },
  async (input) => {
    // Determine if the role is technical for potentially adjusting logic, though the prompt should handle it
    const isTechnicalRole = technicalRolesKeywords.some(keyword =>
      input.role.toLowerCase().includes(keyword) || input.profileField.toLowerCase().includes(keyword)
    );

    console.log(`Generating questions for ${input.interviewDuration} min interview. Role: ${input.role}, Field: ${input.profileField}. Technical: ${isTechnicalRole}`);

    const {output} = await prompt(input);

    if (!output || !output.questions || output.questions.length === 0) {
        console.error("AI did not return any questions. Input was:", input);
        // Fallback to some generic questions if AI fails, or throw an error
        // For now, let's ensure it's an empty array if undefined, to satisfy schema.
        return { questions: [] };
    }
    
    // Ensure IDs are unique if not already, though prompt asks for it
    return {
      questions: output.questions.map((q, index) => ({
        ...q,
        id: q.id || `gen_q${index + 1}`, // Fallback ID generation
      })) as GeneratedQuestion[],
    };
  }
);
