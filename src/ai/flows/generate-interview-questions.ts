
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating interview questions based on user profile, role, interview duration, and optional resume text.
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
  resumeProcessedText: z.string().optional().describe('Optional: The client-side processed text content of the candidate\'s resume.'),
});
export type GenerateInterviewQuestionsInput = z.infer<
  typeof GenerateInterviewQuestionsInputSchema
>;

// This schema is used both for output of this flow AND as part of input to the feedback flow
// DO NOT EXPORT THIS ZOD SCHEMA OBJECT from a 'use server' file
const GeneratedQuestionSchemaInternal = z.object({
  id: z.string().describe('A unique ID for the question (e.g., q1, q2).'),
  text: z.string().describe('The question text.'),
  stage: z.enum(['oral', 'technical_written']).describe('The stage of the interview this question belongs to: "oral" for spoken answers, "technical_written" for typed/coding answers.'),
  type: z.enum(['behavioral', 'technical', 'coding', 'conversational', 'resume_based']).describe('The type of question. "conversational", "behavioral", and "resume_based" are for oral stage. "technical" and "coding" are for technical_written stage. "resume_based" can also be used if the question is directly derived from the resume content for any stage.'),
  answer: z.string().optional().describe("The user's answer to this question, if provided/applicable at the time of feedback generation. This field should NOT be part of this generation output."),
});

const GenerateInterviewQuestionsOutputSchema = z.object({
  questions: z.array(GeneratedQuestionSchemaInternal.omit({ answer: true })).describe('An array of generated interview questions with stages and types. The "answer" field should not be included in the output of this flow.'),
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
  prompt: `You are an expert AI Interview Question Generator. Your primary task is to create a set of the best, most relevant, and frequently asked interview questions.
These questions MUST be tailored to the candidate's profile field, role, the total interview duration, and their resume content (if provided from resumeProcessedText).

Candidate Information:
- Profile Field: {{{profileField}}}
- Candidate Role: {{{role}}}
- Interview Duration: {{{interviewDuration}}} minutes
{{#if resumeProcessedText}}
- Resume Content (Processed Text from client-side):
---
{{{resumeProcessedText}}}
---
{{/if}}

Determine if the role is technical. Roles are considered technical if they include keywords such as: ${technicalRolesKeywords.join(', ')}. Examples: "Software Developer", "Data Scientist", "Frontend Developer", "Flutter Developer".

Question Stages & Types:

1.  **Oral Stage ('oral')**:
    *   These questions are for the candidate to answer verbally. The AI (interviewer) will dictate the question.
    *   Focus: Conversational ice-breakers, behavioral questions, general theoretical questions relevant to the role/field, and questions derived from their resume (experiences, projects, skills).
    *   Allowed Types: 'conversational', 'behavioral', 'resume_based'.
    *   If resumeProcessedText is provided, ensure some 'oral' questions are 'resume_based', directly asking about specific points in their resume (e.g., "Tell me more about your project X mentioned in your resume," or "Your resume lists Y skill; can you elaborate on your experience with it in the context of Z?").

2.  **Technical/Written Stage ('technical_written')**:
    *   This stage is **ONLY for technical roles** and comes AFTER all 'oral' stage questions.
    *   Questions require a typed or written answer (e.g., code, detailed explanation of a technical concept).
    *   Allowed Types:
        *   'technical': Questions asking for explanations of concepts, definitions, or comparisons (e.g., "Explain the concept of closures in JavaScript specific to {{{profileField}}}").
        *   'coding': Questions requiring the candidate to write a function or solve a coding problem (e.g., "Write a Python function to find the median of a list, relevant to a {{{role}}}").
        *   'resume_based': If a technical question can be directly derived from a technical skill or project in the resume (e.g., "Your resume mentions using microservices; explain the challenges you faced with service discovery.").

Question Distribution and Types based on Duration:
Ensure a good mix of question types within each stage. Prioritize 'resume_based' questions if a resume is provided, integrating them naturally into both oral and technical stages where appropriate. The 'id' for each question MUST be unique (q1, q2, q3, etc.).

*   **15 minutes (Total 6-7 questions):**
    *   Non-technical roles: 6-7 'oral' questions (mix of 'conversational', 'behavioral', and 'resume_based' if resumeProcessedText exists).
    *   Technical roles:
        *   Oral Stage: 3-4 'oral' questions (mix of 'conversational', 'behavioral', 'resume_based').
        *   Technical/Written Stage: 2-3 'technical_written' questions (mix of 'technical', 'coding', 'resume_based').
        *   Ensure total questions for technical roles is 6-7.

*   **30 minutes (Total 10-12 questions):**
    *   Non-technical roles: 10-12 'oral' questions (mix of 'conversational', 'behavioral', and 'resume_based' if resumeProcessedText exists).
    *   Technical roles:
        *   Oral Stage: 4-5 'oral' questions (mix of 'conversational', 'behavioral', 'resume_based').
        *   Technical/Written Stage: 5-7 'technical_written' questions (mix of 'technical', 'coding', 'resume_based').
        *   Ensure total questions for technical roles is 10-12.

*   **45 minutes (Total 15-16 questions):**
    *   Non-technical roles: 15-16 'oral' questions (mix of 'conversational', 'behavioral', and 'resume_based' if resumeProcessedText exists).
    *   Technical roles:
        *   Oral Stage: 5-6 'oral' questions (mix of 'conversational', 'behavioral', 'resume_based').
        *   Technical/Written Stage: 8-10 'technical_written' questions (mix of 'technical', 'coding', 'resume_based').
        *   Ensure total questions for technical roles is 15-16.

General Guidelines:
- All questions MUST be directly relevant to the provided 'profileField', 'role', and 'resumeProcessedText' (if available).
- 'resume_based' questions should refer to specific information from the resume.
- For 'technical_written' questions of type 'coding', provide a clear, concise problem statement.
- 'Oral' questions should be open-ended and designed to encourage spoken, detailed responses.
- Provide questions in a logical sequence: all 'oral' stage questions first, then all 'technical_written' stage questions if the role is technical.
- Each question MUST have a unique 'id' (e.g., "q1", "q2", "q3"...), its 'text', its designated 'stage', and its 'type'. The 'answer' field should NOT be part of this generation output.

Generate the questions array according to these guidelines. Ensure questions are challenging yet appropriate for the experience level implied by the role, field, and resume.
If no resumeProcessedText is provided, generate questions based on role and field only.
Ensure your entire output is a single JSON object that strictly adheres to the defined output schema.
`,
});


const generateInterviewQuestionsFlow = ai.defineFlow(
  {
    name: 'generateInterviewQuestionsFlow',
    inputSchema: GenerateInterviewQuestionsInputSchema,
    outputSchema: GenerateInterviewQuestionsOutputSchema,
  },
  async (input) => {
    const isLikelyTechnicalRole = technicalRolesKeywords.some(keyword =>
      input.role.toLowerCase().includes(keyword) || input.profileField.toLowerCase().includes(keyword)
    );

    console.log(`Generating questions for ${input.interviewDuration} min interview. Role: ${input.role}, Field: ${input.profileField}. Resume text provided: ${!!input.resumeProcessedText}. Considered technical by flow: ${isLikelyTechnicalRole}`);

    const {output} = await prompt(input);

    if (!output || !output.questions || output.questions.length === 0) {
        console.error("AI did not return any questions for generation. Input was:", input);
        // Return a default conversational question if generation fails
        return { questions: [{
            id: 'q1',
            text: 'Tell me about yourself and your experience relevant to this field.',
            stage: 'oral',
            type: 'conversational',
        }] };
    }

    // Ensure IDs are unique and sort questions: oral first, then technical/written.
    const sortedQuestions = output.questions
      .map((q, index) => ({
        ...q,
        id: q.id || `gen_q${index + 1}`, // Ensure ID exists
      }))
      .sort((a, b) => {
        if (a.stage === 'oral' && b.stage === 'technical_written') return -1;
        if (a.stage === 'technical_written' && b.stage === 'oral') return 1;
        // Fallback to original ID sorting if stages are the same
        const idA = parseInt(a.id.replace ( /^\D+/g, ''), 10);
        const idB = parseInt(b.id.replace ( /^\D+/g, ''), 10);
        if (!isNaN(idA) && !isNaN(idB)) {
            return idA - idB;
        }
        return 0;
    });

    return {
      questions: sortedQuestions as GeneratedQuestion[], // Cast as our type
    };
  }
);
