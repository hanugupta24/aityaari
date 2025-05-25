
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating interview questions based on user profile, role, interview duration, and optional resume text.
 * It aims to create a mix of oral and technical/written questions as appropriate for the role, with specific distributions for technical roles.
 *
 * - generateInterviewQuestions - A function that generates interview questions.
 * - GenerateInterviewQuestionsInput - The input type for the generateInterviewQuestions function.
 * - GenerateInterviewQuestionsOutput - The output type for the generateInterviewQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { GeneratedQuestion } from '@/types';

const GenerateInterviewQuestionsInputSchema = z.object({
  profileField: z.string().describe('The user profile field, e.g., Software Engineering, Data Science, Product Management.'),
  role: z.string().describe('The user role, e.g., Frontend Developer, Product Manager, Marketing Specialist.'),
  interviewDuration: z.enum(['15', '30', '45']).describe('The selected interview duration in minutes.'),
  resumeProcessedText: z.string().optional().describe('Optional: The client-side processed text content of the candidate\'s resume, used to tailor questions.'),
});
export type GenerateInterviewQuestionsInput = z.infer<
  typeof GenerateInterviewQuestionsInputSchema
>;

// This schema is used for output of this flow.
// It's also structurally compatible with how questions are stored in InterviewSession and used by the feedback flow.
const GeneratedQuestionSchemaInternal = z.object({
  id: z.string().describe('A unique ID for the question (e.g., q1, q2).'),
  text: z.string().describe('The question text.'),
  stage: z.enum(['oral', 'technical_written']).describe('The stage of the interview this question belongs to: "oral" for spoken answers, "technical_written" for typed/coding answers.'),
  type: z.enum(['behavioral', 'technical', 'coding', 'conversational', 'resume_based']).describe('The type of question. "conversational", "behavioral", "resume_based", and conceptual "technical" questions are generally for the oral stage. In-depth "technical" explanations and "coding" questions are for the technical_written stage. "resume_based" can be used for any stage if the question is directly derived from resume content.'),
  answer: z.string().optional().describe("The user's answer to this question, populated during the interview. This field should NOT be part of this generation output."),
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

Determine if the role is technical. Roles are considered technical if they include keywords such as: ${technicalRolesKeywords.join(', ')}. Examples: "Software Developer", "Data Scientist", "Frontend Developer", "Flutter Developer". Roles like "Product Manager", "Marketing Manager", "Sales Representative" are non-technical.

Question Stages & Types:
Questions are categorized by 'stage' ('oral' or 'technical_written') and 'type' ('conversational', 'behavioral', 'technical', 'coding', 'resume_based').
- 'oral' stage: For questions answered verbally.
    - For Technical Roles: 'technical' type questions in this stage are for conceptual discussions (e.g., "Explain how React hooks work conceptually", "Discuss the trade-offs of microservices vs. monolithic architecture", "What are LLMs and how do they generally learn?").
    - For Non-Technical Roles: Questions are primarily 'conversational', 'behavioral', or 'resume_based', focusing on job-specific scenarios, processes, and problem-solving (e.g., "Describe a time you managed a challenging project", "How would you approach market research for a new product in the X domain?", "Walk me through your experience with Y strategy mentioned in your resume.").
- 'technical_written' stage: For questions requiring typed answers (e.g., code, detailed technical explanations). This stage is primarily for technical roles.
    - Examples for Technical Roles: "Write a Python function to reverse a linked list.", "Describe the database schema you would design for an e-commerce platform, explaining your choices.", "Explain the CI/CD pipeline for the project X from your resume in writing."

Question Distribution and Types based on Duration:
The 'id' for each question MUST be unique (q1, q2, q3, etc.).
Sequence: All 'oral' stage questions must come before all 'technical_written' stage questions.

*   **For Non-Technical Roles (e.g., Product Management, Marketing, Sales):**
    *   All questions generated MUST be of the 'oral' stage. No 'technical_written' questions should be generated.
    *   The questions should be a diverse mix of 'conversational', 'behavioral', and 'resume_based' types, focusing on job-specific scenarios, work processes, and how the candidate approaches tasks relevant to their field.
    *   Ensure the total number of these oral questions aligns with the specified interview duration:
        *   **15 minutes (Total 6-7 questions):** Generate 6-7 diverse 'oral' questions.
        *   **30 minutes (Total 10-12 questions):** Generate 10-12 diverse 'oral' questions.
        *   **45 minutes (Total 15-16 questions):** Generate 15-16 diverse 'oral' questions.

*   **For Technical Roles (Identified by keywords like ${technicalRolesKeywords.join(', ')}):**
    The distribution below should be followed within the total question count for the duration.
    *   **Technical Oral Questions (approx. 45% of total questions for the duration):**
        *   stage: 'oral'
        *   type: 'technical' (e.g., for a web developer: "Explain the concept of closures in JavaScript", "What is the difference between virtual DOM and shadow DOM?"; for a data scientist: "Describe different types of biases in machine learning models.", "Explain the concept of overfitting and how to prevent it.") or type: 'resume_based' (e.g., "Tell me more about your experience with the XYZ framework mentioned in your resume and a challenging problem you solved with it."). These are for verbal discussion of technical topics, understanding of concepts, and problem-solving approaches.
    *   **Technical Written Questions (approx. 30% of total questions for the duration):**
        *   stage: 'technical_written'
        *   type: 'technical' (e.g., for a web developer: "Describe the key components of a RESTful API and how you would secure it.", "Explain the architecture of a recent web application you built."), type: 'coding' (e.g., "Write a function to find the second largest number in an array.", "Implement a basic caching mechanism."), or type: 'resume_based' (e.g., "Provide a detailed written explanation of the algorithm you implemented for project P from your resume."). These require typed, in-depth answers or code.
    *   **Non-Technical Oral Questions (approx. 25% of total questions for the duration):**
        *   stage: 'oral'
        *   type: 'conversational', type: 'behavioral', or type: 'resume_based' (focusing on non-technical aspects from resume like teamwork, communication, problem-solving approaches in a general context).

    *Specific counts for Technical Roles based on duration and above percentages:*

    *   **15 minutes (Total 6-7 questions for technical roles):**
        *   Technical Oral: 2-3 questions
        *   Technical Written: 2 questions
        *   Non-Technical Oral: 2 questions
        (Adjust slightly to meet total 6-7, prioritizing more technical content if needed)

    *   **30 minutes (Total 10-12 questions for technical roles):**
        *   Technical Oral: 4-5 questions
        *   Technical Written: 3-4 questions
        *   Non-Technical Oral: 2-3 questions
        (Adjust slightly to meet total 10-12)

    *   **45 minutes (Total 15-16 questions for technical roles):**
        *   Technical Oral: 6-7 questions
        *   Technical Written: 4-5 questions
        *   Non-Technical Oral: 4-5 questions
        (Adjust slightly to meet total 15-16)

General Guidelines for All Roles:
- All questions MUST be directly relevant to the provided 'profileField', 'role', and 'resumeProcessedText' (if available).
- 'resume_based' questions should clearly refer to specific information from the resume.
- For 'technical_written' questions of type 'coding', provide a clear, concise problem statement.
- 'Oral' questions should be open-ended and designed to encourage spoken, detailed responses.
- Each question MUST have a unique 'id', its 'text', its designated 'stage', and its 'type'. The 'answer' field should NOT be part of this generation output.

Generate the questions array according to these guidelines. Ensure questions are challenging yet appropriate for the experience level implied by the role, field, and resume.
If no resumeProcessedText is provided, generate questions based on role and field only, following the same distribution principles.
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

    console.log(`Generating questions for ${input.interviewDuration} min interview. Role: ${input.role}, Field: ${input.profileField}. Resume text provided: ${!!input.resumeProcessedText}. Considered technical by flow logic: ${isLikelyTechnicalRole}`);

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
    // This sorting respects the sequence of all oral questions first, then technical/written.
    const sortedQuestions = output.questions
      .map((q, index) => ({
        ...q,
        id: q.id || `gen_q${index + 1}`, // Ensure ID exists
      }))
      .sort((a, b) => {
        if (a.stage === 'oral' && b.stage === 'technical_written') return -1;
        if (a.stage === 'technical_written' && b.stage === 'oral') return 1;
        
        // If stages are the same, try to sort by original ID to maintain some generated order
        // (assuming IDs like q1, q2, q10 are generated)
        const idANum = parseInt(a.id.replace ( /^\D+/g, ''), 10);
        const idBNum = parseInt(b.id.replace ( /^\D+/g, ''), 10);
        if (!isNaN(idANum) && !isNaN(idBNum)) {
            return idANum - idBNum;
        }
        return 0; // Fallback if IDs are not purely numeric after prefix
    });

    return {
      questions: sortedQuestions as GeneratedQuestion[], // Cast as our type
    };
  }
);
