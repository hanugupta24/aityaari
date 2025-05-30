
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating interview questions.
 * It aims to create a mix of oral and technical/written questions based on user profile, role,
 * interview duration, an optional job description, and optional resume text.
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
  jobDescription: z.string().optional().describe('Optional: The targeted job description provided by the user for this specific interview. This should be the primary source for questions if available.'),
  resumeProcessedText: z.string().optional().describe('Optional: The client-side processed text content of the candidate\'s resume. Use this to tailor questions if jobDescription is not provided or to complement it.'),
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
  type: z.enum(['behavioral', 'technical', 'coding', 'conversational', 'resume_based', 'jd_based']).describe('The type of question. "jd_based" questions are derived from the job description. "conversational", "behavioral", "resume_based", and conceptual "technical" questions are generally for the oral stage. In-depth "technical" explanations and "coding" questions are for the technical_written stage.'),
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
Questions MUST be tailored based on the following information, in order of priority:
1.  **Targeted Job Description (if {{{jobDescription}}} is provided):** This is the MOST IMPORTANT source. Generate questions that directly assess skills, experience, and qualifications mentioned in this job description. Mark relevant questions with type: 'jd_based'.
2.  **Candidate's Resume Content (if {{{resumeProcessedText}}} is provided AND jobDescription is not, or to complement jobDescription):** Use this to ask specific 'resume_based' questions about projects, experiences, or skills listed.
3.  **Candidate's Profile Field ({{{profileField}}}) and Role ({{{role}}}):** If no job description or resume is available, or to add general relevant questions, use these.

Candidate Information:
- Profile Field: {{{profileField}}}
- Candidate Role: {{{role}}}
- Interview Duration: {{{interviewDuration}}} minutes
{{#if jobDescription}}
- Targeted Job Description (Primary Source):
---
{{{jobDescription}}}
---
{{/if}}
{{#if resumeProcessedText}}
- Resume Content (Processed Text from client-side):
---
{{{resumeProcessedText}}}
---
{{/if}}

Determine if the role is technical. Roles are considered technical if they include keywords such as: ${technicalRolesKeywords.join(', ')}. Examples: "Software Developer", "Data Scientist", "Flutter Developer". Roles like "Product Manager", "Marketing Manager" are non-technical.

Question Stages & Types:
Questions are categorized by 'stage' ('oral' or 'technical_written') and 'type' ('conversational', 'behavioral', 'technical', 'coding', 'resume_based', 'jd_based').
- 'oral' stage: For questions answered verbally.
    - For Technical Roles: 'technical' type questions in this stage are for conceptual discussions (e.g., "Explain how React hooks work conceptually based on the job description requirement for React expertise", "Discuss the trade-offs of microservices vs. monolithic architecture if relevant to the JD/role", "What are LLMs and how do they generally learn if applying for a Data Science role?").
    - For Non-Technical Roles: Questions are primarily 'conversational', 'behavioral', 'resume_based', or 'jd_based', focusing on job-specific scenarios, processes, and problem-solving relevant to the job description or role (e.g., "Describe a time you managed a challenging project as outlined in the JD", "How would you approach market research for the new product mentioned in the job description?").
- 'technical_written' stage: For questions requiring typed answers (e.g., code, detailed technical explanations). This stage is primarily for technical roles.
    - Examples for Technical Roles: "Write a Python function to solve a problem related to a requirement in the job description.", "Describe the database schema you would design for a system similar to what's described in the JD.", "Explain the CI/CD pipeline for a project that uses technologies listed in the job description."

Question Distribution and Types based on Duration:
The 'id' for each question MUST be unique (q1, q2, q3, etc.).
Sequence: All 'oral' stage questions must come before all 'technical_written' stage questions.

*   **For Non-Technical Roles (e.g., Product Management, Marketing, Sales):**
    *   All questions generated MUST be of the 'oral' stage. No 'technical_written' questions should be generated.
    *   The questions should be a diverse mix of 'conversational', 'behavioral', and primarily 'jd_based' (if JD provided) or 'resume_based' (if resume provided) types, focusing on job-specific scenarios, work processes, and how the candidate approaches tasks relevant to their field and the provided job description.
    *   Ensure the total number of these oral questions aligns with the specified interview duration:
        *   **15 minutes (Total 6-7 questions):** Generate 6-7 diverse 'oral' questions.
        *   **30 minutes (Total 10-12 questions):** Generate 10-12 diverse 'oral' questions.
        *   **45 minutes (Total 15-16 questions):** Generate 15-16 diverse 'oral' questions.

*   **For Technical Roles (Identified by keywords like ${technicalRolesKeywords.join(', ')}):**
    The distribution below should be followed within the total question count for the duration. Prioritize 'jd_based' questions if a job description is provided.
    *   **Technical Oral Questions (approx. 45% of total questions for the duration):**
        *   stage: 'oral'
        *   type: 'technical' (e.g., for a web developer based on JD: "Explain the concept of closures in JavaScript as it relates to asynchronous operations mentioned in the JD requirements", "What is the difference between virtual DOM and shadow DOM if the JD mentions advanced frontend frameworks?"), 'jd_based', or 'resume_based'. These are for verbal discussion of technical topics, understanding of concepts, and problem-solving approaches relevant to the job description or resume.
    *   **Technical Written Questions (approx. 30% of total questions for the duration):**
        *   stage: 'technical_written'
        *   type: 'technical', 'coding' (e.g., "Write a function to implement a feature described in the job description.", "Solve a coding problem using a language specified in the JD."), or 'jd_based' / 'resume_based'. These require typed, in-depth answers or code.
    *   **Non-Technical Oral Questions (approx. 25% of total questions for the duration):**
        *   stage: 'oral'
        *   type: 'conversational', 'behavioral', 'jd_based', or 'resume_based' (focusing on soft skills, teamwork, communication, problem-solving approaches in a general context or related to JD/resume).

    *Specific counts for Technical Roles based on duration and above percentages:*
    *   **15 minutes (Total 6-7 questions for technical roles):**
        *   Technical Oral: 2-3 questions
        *   Technical Written: 2 questions
        *   Non-Technical Oral: 2 questions
        (Adjust slightly to meet total 6-7, prioritizing JD/resume-based content)

    *   **30 minutes (Total 10-12 questions for technical roles):**
        *   Technical Oral: 4-5 questions
        *   Technical Written: 3-4 questions
        *   Non-Technical Oral: 2-3 questions
        (Adjust slightly to meet total 10-12, prioritizing JD/resume-based content)

    *   **45 minutes (Total 15-16 questions for technical roles):**
        *   Technical Oral: 6-7 questions
        *   Technical Written: 4-5 questions
        *   Non-Technical Oral: 4-5 questions
        (Adjust slightly to meet total 15-16, prioritizing JD/resume-based content)

General Guidelines for All Roles:
- If a jobDescription is provided, make it the primary driver for question content.
- All questions MUST be directly relevant to the provided information (jobDescription > resumeProcessedText > profileField/role).
- 'jd_based' questions should clearly refer to specific requirements or aspects from the job description.
- 'resume_based' questions should clearly refer to specific information from the resume.
- For 'technical_written' questions of type 'coding', provide a clear, concise problem statement.
- 'Oral' questions should be open-ended and designed to encourage spoken, detailed responses.
- Each question MUST have a unique 'id', its 'text', its designated 'stage', and its 'type'. The 'answer' field should NOT be part of this generation output.

Generate the questions array according to these guidelines. Ensure questions are challenging yet appropriate for the experience level implied by the role, field, job description, and resume.
If no jobDescription or resumeProcessedText is provided, generate questions based on role and field only, following the same distribution principles.
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

    console.log(`Generating questions for ${input.interviewDuration} min interview. Role: ${input.role}, Field: ${input.profileField}. Job Description provided: ${!!input.jobDescription}. Resume text provided: ${!!input.resumeProcessedText}. Considered technical by flow logic: ${isLikelyTechnicalRole}`);

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

    const sortedQuestions = output.questions
      .map((q, index) => ({
        ...q,
        id: q.id || `gen_q${index + 1}`, 
      }))
      .sort((a, b) => {
        if (a.stage === 'oral' && b.stage === 'technical_written') return -1;
        if (a.stage === 'technical_written' && b.stage === 'oral') return 1;
        
        const idANum = parseInt((a.id || 'q0').replace( /^\D+/g, ''), 10) || 0;
        const idBNum = parseInt((b.id || 'q0').replace( /^\D+/g, ''), 10) || 0;
        return idANum - idBNum;
    });

    return {
      questions: sortedQuestions as GeneratedQuestion[], 
    };
  }
);
