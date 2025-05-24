
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
  prompt: `You are an expert interviewer. Generate interview questions for a job candidate.
The interview will have specific stages and question types based on the candidate's role and interview duration.

Candidate Profile Field: {{{profileField}}}
Candidate Role: {{{role}}}
Interview Duration: {{{interviewDuration}}} minutes

Determine if the role is technical. Roles are considered technical if they include keywords such as: ${technicalRolesKeywords.join(', ')}.

Question Stages:
1.  'oral': Questions in this stage are for the candidate to answer verbally. The AI (you) will dictate the question. Types for this stage are 'conversational' (e.g., "Tell me about yourself", "Why are you interested in this role?") or 'behavioral' (e.g., "Describe a time you faced a challenge and how you overcame it.").
2.  'technical_written': This stage is ONLY for technical roles and comes AFTER the 'oral' stage. Questions require a typed or written answer. Types for this stage are 'technical' (e.g., "Explain the concept of X specific to {{{profileField}}}") or 'coding' (e.g., "Write a function to do Y relevant to {{{role}}}").

Question Distribution and Types based on Duration:

*   **15 minutes:**
    *   Non-technical roles: 3-4 'oral' questions (mix of 'conversational' and 'behavioral').
    *   Technical roles:
        *   Stage 1 ('oral'): 2 'oral' questions ('conversational' or 'behavioral').
        *   Stage 2 ('technical_written'): 1 'technical_written' question (can be 'technical' or 'coding', relevant to {{{role}}} and {{{profileField}}}).

*   **30 minutes:**
    *   Non-technical roles: 5-6 'oral' questions (mix of 'conversational' and 'behavioral').
    *   Technical roles:
        *   Stage 1 ('oral'): 3 'oral' questions ('conversational' or 'behavioral').
        *   Stage 2 ('technical_written'): 1-2 'technical_written' questions ('technical' or 'coding').

*   **45 minutes:**
    *   Non-technical roles: 7-8 'oral' questions (mix of 'conversational' and 'behavioral').
    *   Technical roles:
        *   Stage 1 ('oral'): 3-4 'oral' questions ('conversational' or 'behavioral').
        *   Stage 2 ('technical_written'): 2 'technical_written' questions ('technical' or 'coding').

General Guidelines:
- Ensure all questions are relevant to the provided 'profileField' and 'role'.
- For 'technical_written' questions of type 'coding', provide a clear problem statement.
- For 'technical_written' questions of type 'technical', ask about concepts, definitions, or explanations.
- 'Oral' questions should be open-ended and encourage spoken responses.
- Provide questions in a logical sequence: 'oral' stage questions first, then 'technical_written' stage questions if applicable.
- Each question MUST have a unique 'id' (e.g., "q1", "q2", "q3"...), its 'text', its designated 'stage', and its 'type'.

Generate the questions array according to these guidelines.
`,
});


const generateInterviewQuestionsFlow = ai.defineFlow(
  {
    name: 'generateInterviewQuestionsFlow',
    inputSchema: GenerateInterviewQuestionsInputSchema,
    outputSchema: GenerateInterviewQuestionsOutputSchema,
  },
  async (input) => {
    const isTechnicalRole = technicalRolesKeywords.some(keyword =>
      input.role.toLowerCase().includes(keyword) || input.profileField.toLowerCase().includes(keyword)
    );

    console.log(`Generating questions for ${input.interviewDuration} min interview. Role: ${input.role}, Field: ${input.profileField}. Technical: ${isTechnicalRole}`);

    const {output} = await prompt(input);

    if (!output || !output.questions || output.questions.length === 0) {
        console.error("AI did not return any questions. Input was:", input);
        // Fallback or error based on requirements. For now, empty array to satisfy schema.
        // Consider throwing an error if questions are essential for the flow to proceed.
        return { questions: [] };
    }
    
    // Ensure IDs are unique and other basic validation if needed, though prompt asks for it.
    // Also, sort questions to ensure 'oral' comes before 'technical_written' if AI doesn't guarantee order.
    const sortedQuestions = output.questions.sort((a, b) => {
        if (a.stage === 'oral' && b.stage === 'technical_written') return -1;
        if (a.stage === 'technical_written' && b.stage === 'oral') return 1;
        // if same stage, maintain original order (or sort by id if needed)
        return (parseInt(a.id.substring(1)) || 0) - (parseInt(b.id.substring(1)) || 0);
    }).map((q, index) => ({
      ...q,
      id: q.id || `gen_q${index + 1}`, // Fallback ID generation
    }));
    
    return {
      questions: sortedQuestions as GeneratedQuestion[],
    };
  }
);

