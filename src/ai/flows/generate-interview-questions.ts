
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating interview questions based on user profile, role, and interview duration.
 * It aims to create a mix of oral and technical/written questions as appropriate for the role.
 *
 * - generateInterviewQuestions - A function that generates interview questions.
 * - GenerateInterviewQuestionsInput - The input type for the generateInterviewQuestions function.
 * - GenerateInterviewQuestionsOutput - The output type for the generateInterviewQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { GeneratedQuestion } from '@/types';

const GenerateInterviewQuestionsInputSchema = z.object({
  profileField: z.string().describe('The user profile field, e.g., Software Engineering, Data Science.'),
  role: z.string().describe('The user role, e.g., Frontend Developer, Product Manager.'),
  interviewDuration: z.enum(['15', '30', '45']).describe('The selected interview duration in minutes.'),
});
export type GenerateInterviewQuestionsInput = z.infer<
  typeof GenerateInterviewQuestionsInputSchema
>;

const GeneratedQuestionSchema = z.object({
  id: z.string().describe('A unique ID for the question (e.g., q1, q2).'),
  text: z.string().describe('The question text.'),
  stage: z.enum(['oral', 'technical_written']).describe('The stage of the interview this question belongs to: "oral" for spoken answers, "technical_written" for typed/coding answers.'),
  type: z.enum(['behavioral', 'technical', 'coding', 'conversational']).describe('The type of question. "conversational" and "behavioral" are for oral stage. "technical" and "coding" are for technical_written stage.'),
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

const technicalRolesKeywords = ['developer', 'engineer', 'scientist', 'analyst', 'architect', 'programmer', 'data', 'software', 'backend', 'frontend', 'fullstack', 'flutter', 'devops', 'sre', 'machine learning', 'ai engineer'];

const prompt = ai.definePrompt({
  name: 'generateInterviewQuestionsPrompt',
  input: {schema: GenerateInterviewQuestionsInputSchema},
  output: {schema: GenerateInterviewQuestionsOutputSchema},
  prompt: `You are an expert AI Interview Question Generator. Your task is to create a set of high-quality, relevant interview questions, including those frequently asked for the specified role and field. The questions should be tailored to the candidate's profile field, role, and the total interview duration.

Candidate Profile Field: {{{profileField}}}
Candidate Role: {{{role}}}
Interview Duration: {{{interviewDuration}}} minutes

Determine if the role is technical. Roles are considered technical if they include keywords such as: ${technicalRolesKeywords.join(', ')}. Examples: "Software Developer", "Data Scientist", "Frontend Developer", "Backend Developer", "Flutter Developer".

Question Stages & Types:

1.  **Oral Stage ('oral')**:
    *   These questions are for the candidate to answer verbally. The AI (interviewer) will dictate the question.
    *   Focus: Conversational ice-breakers, behavioral questions, and general theoretical questions relevant to the role and field.
    *   Allowed Types: 'conversational' (e.g., "Tell me about yourself," "Why are you interested in this role?"), 'behavioral' (e.g., "Describe a time you faced a challenge and how you overcame it.").

2.  **Technical/Written Stage ('technical_written')**:
    *   This stage is **ONLY for technical roles** and comes AFTER all 'oral' stage questions.
    *   Questions require a typed or written answer (e.g., code, detailed explanation).
    *   Allowed Types:
        *   'technical': Questions asking for explanations of concepts, definitions, or comparisons (e.g., "Explain the concept of closures in JavaScript specific to {{{profileField}}}").
        *   'coding': Questions requiring the candidate to write a function or solve a coding problem (e.g., "Write a Python function to find the median of a list, relevant to a {{{role}}}").

Question Distribution and Types based on Duration:

*   **15 minutes:**
    *   Non-technical roles: 3-4 'oral' questions (mix of 'conversational' and 'behavioral').
    *   Technical roles:
        *   Oral Stage: 2 'oral' questions (mix of 'conversational', 'behavioral').
        *   Technical/Written Stage: 1 'technical_written' question (can be 'technical' or 'coding', highly relevant to {{{role}}} and {{{profileField}}}).

*   **30 minutes:**
    *   Non-technical roles: 5-6 'oral' questions (mix of 'conversational' and 'behavioral').
    *   Technical roles:
        *   Oral Stage: 3 'oral' questions (mix of 'conversational', 'behavioral').
        *   Technical/Written Stage: 1-2 'technical_written' questions (mix of 'technical' or 'coding').

*   **45 minutes:**
    *   Non-technical roles: 7-8 'oral' questions (mix of 'conversational' and 'behavioral').
    *   Technical roles:
        *   Oral Stage: 3-4 'oral' questions (mix of 'conversational', 'behavioral').
        *   Technical/Written Stage: 2 'technical_written' questions (mix of 'technical' and 'coding'). Ensure a good mix if multiple.

General Guidelines:
- All questions MUST be directly relevant to the provided 'profileField' and 'role'.
- For 'technical_written' questions of type 'coding', provide a clear, concise problem statement.
- For 'technical_written' questions of type 'technical', ask about core concepts, definitions, or detailed explanations.
- 'Oral' questions should be open-ended and designed to encourage spoken, detailed responses. They should be phrased as if an interviewer is speaking them.
- Provide questions in a logical sequence: all 'oral' stage questions first, then all 'technical_written' stage questions if the role is technical.
- Each question MUST have a unique 'id' (e.g., "q1", "q2", "q3"...), its 'text', its designated 'stage', and its 'type'.

Generate the questions array according to these guidelines. Ensure questions are challenging yet appropriate for the experience level implied by the role and field.
`,
});


const generateInterviewQuestionsFlow = ai.defineFlow(
  {
    name: 'generateInterviewQuestionsFlow',
    inputSchema: GenerateInterviewQuestionsInputSchema,
    outputSchema: GenerateInterviewQuestionsOutputSchema,
  },
  async (input) => {
    // This logic is to help the prompt, the AI should make the final determination.
    const isLikelyTechnicalRole = technicalRolesKeywords.some(keyword =>
      input.role.toLowerCase().includes(keyword) || input.profileField.toLowerCase().includes(keyword)
    );

    console.log(`Generating questions for ${input.interviewDuration} min interview. Role: ${input.role}, Field: ${input.profileField}. Considered technical by flow: ${isLikelyTechnicalRole}`);

    const {output} = await prompt(input);

    if (!output || !output.questions || output.questions.length === 0) {
        console.error("AI did not return any questions. Input was:", input);
        // Fallback or error based on requirements.
        return { questions: [] }; // Return empty array to satisfy schema, client should handle.
    }
    
    // Ensure IDs are unique and sort questions to enforce 'oral' before 'technical_written'
    // The AI prompt already requests this, but sorting here is a safeguard.
    const sortedQuestions = output.questions
      .map((q, index) => ({
        ...q,
        id: q.id || `gen_q${index + 1}`, // Fallback ID if AI misses it
      }))
      .sort((a, b) => {
        if (a.stage === 'oral' && b.stage === 'technical_written') return -1;
        if (a.stage === 'technical_written' && b.stage === 'oral') return 1;
        // If same stage, maintain original order or sort by id if necessary
        return (parseInt(a.id.substring(1)) || 0) - (parseInt(b.id.substring(1)) || 0);
    });
    
    return {
      questions: sortedQuestions as GeneratedQuestion[],
    };
  }
);

