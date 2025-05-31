
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

const technicalRolesKeywords = ['developer', 'engineer', 'scientist', 'analyst', 'architect', 'programmer', 'data', 'software', 'backend', 'frontend', 'fullstack', 'flutter', 'devops', 'sre', 'machine learning', 'ai engineer', 'cybersecurity', 'network', 'database administrator', 'dba'];

const prompt = ai.definePrompt({
  name: 'generateInterviewQuestionsPrompt',
  input: {schema: GenerateInterviewQuestionsInputSchema},
  output: {schema: GenerateInterviewQuestionsOutputSchema},
  prompt: `You are an expert AI Interview Question Generator. Your primary task is to create a set of the best, most relevant, and frequently asked interview questions.
Questions MUST be tailored based on the following information, in a strict order of priority:

1.  **Targeted Job Description (if a specific {{{jobDescription}}} is provided for THIS interview session):**
    *   This is the MOST IMPORTANT source if available.
    *   Generate questions that directly assess skills, experience, and qualifications mentioned in this job description.
    *   Mark relevant questions with type: 'jd_based'.

2.  **Candidate's Resume Content (if {{{resumeProcessedText}}} is provided):**
    *   **If a Targeted Job Description (point 1) is NOT provided:** The Resume Content becomes the PRIMARY source.
        *   Generate specific 'resume_based' questions about projects, experiences, skills, and technologies listed in the resume.
        *   **Crucially, if the resume's content (skills, experiences) points to a different field or domain than the general {{{profileField}}} and {{{role}}}, your questions MUST predominantly reflect the resume's content.** Ask questions that deeply probe the experiences and skills detailed in the resume.
        *   You can then ask a *few* questions related to {{{profileField}}}/{{{role}}} to understand the candidate's interest or transferable skills, but the bulk of the questions should be resume-driven.
    *   **If a Targeted Job Description (point 1) IS provided:** Use the Resume Content to ask complementary 'resume_based' questions, or to seek more detail on items potentially mentioned in both the JD and resume. Do not let resume questions overshadow JD-based questions in this scenario.

3.  **Candidate's Profile Field ({{{profileField}}}) and Role ({{{role}}}):**
    *   Use these as a **fallback if no Job Description (point 1) or detailed Resume Content (point 2) is available**.
    *   Or, use them to add general relevant questions that supplement the JD/Resume-based questions, especially if the resume aligns with the profile field/role.
    *   **If the resume was the primary source (point 2) and indicated a different focus, these fields should primarily be used for a small number of bridging or context-setting questions, not as the main driver for question generation.**

Candidate Information:
- Profile Field: {{{profileField}}}
- Candidate Role: {{{role}}}
- Interview Duration: {{{interviewDuration}}} minutes
{{#if jobDescription}}
- Targeted Job Description (Specific to this session):
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

Determine if the role (primarily indicated by the highest priority source: JD, then Resume, then Profile Role/Field) is technical. Roles are considered technical if they include keywords such as: ${technicalRolesKeywords.join(', ')}. Examples: "Software Developer", "Data Scientist", "AI Engineer". Roles like "Product Manager", "Marketing Manager" are non-technical.

Question Stages & Types:
Questions are categorized by 'stage' ('oral' or 'technical_written') and 'type' ('conversational', 'behavioral', 'technical', 'coding', 'resume_based', 'jd_based').
- 'oral' stage: For questions answered verbally.
    - **For Technical Roles:** 'technical' type questions in this stage MUST be specific and in-depth, focusing on core concepts, tools, libraries, algorithms, and methodologies relevant to the highest priority source (JD > Resume > Profile/Role). Avoid overly generic technical questions.
        - Example for Web Dev (if JD/Resume mentions React): "Explain the concept of reconciliation in React. How does the virtual DOM contribute to this process?"
        - Example for Data Science (if JD/Resume mentions PyTorch/dimensionality reduction): "What are Tensors in PyTorch and how are they different from NumPy arrays? How does PyTorch's Autograd feature work?" or "Describe Principal Component Analysis (PCA). What are its main assumptions and when might it not be the best technique for dimensionality reduction?"
        - Example for Backend (if JD/Resume mentions microservices): "Discuss the trade-offs of synchronous versus asynchronous communication between microservices. When would you choose one over the other, referencing specific scenarios if possible from the JD/resume?"
    - For Non-Technical Roles: Questions are primarily 'conversational', 'behavioral', and 'jd_based' or 'resume_based' (if applicable based on priority), focusing on job-specific scenarios, processes, and problem-solving relevant to the highest priority source.

- 'technical_written' stage: For questions requiring typed answers (e.g., code, detailed technical explanations, system design). This stage is primarily for technical roles.
    - Examples for Technical Roles (tailor to JD/Resume if available):
        - Coding: "Write a Python function that takes [specific input, e.g., a list of user activity data from resume/JD] and returns [specific output, e.g., a summary of active users per day]."
        - Technical Explanation: "If the JD/Resume indicates experience with [e.g., NoSQL databases like MongoDB], explain the data modeling considerations you would make for a [e.g., social media feed application], contrasting it with a relational approach."
        - System Design (if relevant to JD/role/resume): "Outline the architecture for a [e.g., real-time notification system] as might be needed for a feature described in the JD/resume. What are the key components and technologies you'd consider?"

Question Distribution and Types based on Duration:
The 'id' for each question MUST be unique (q1, q2, q3, etc.).
Sequence: All 'oral' stage questions must come before all 'technical_written' stage questions.

*   **For Non-Technical Roles (e.g., Product Management, Marketing, Sales):**
    *   All questions generated MUST be of the 'oral' stage. No 'technical_written' questions should be generated.
    *   The questions should be a diverse mix of 'conversational', 'behavioral', and primarily 'jd_based' (if JD provided) or 'resume_based' (if resume provided and JD not), or general questions based on profile/role.
    *   Number of questions: **15 mins (6-7 oral)**, **30 mins (10-12 oral)**, **45 mins (15-16 oral)**.

*   **For Technical Roles (Identified by keywords like ${technicalRolesKeywords.join(', ')}):**
    Prioritize questions based on the hierarchy (JD > Resume > Profile/Role). Ensure 'technical' questions are specific and in-depth.
    *   **Technical Oral Questions (approx. 45% of total):**
        *   stage: 'oral'
        *   type: 'technical' (deep conceptual, tool-specific, algorithm-specific), 'jd_based', 'resume_based'.
    *   **Technical Written Questions (approx. 30% of total):**
        *   stage: 'technical_written'
        *   type: 'technical' (detailed explanations, system design), 'coding', 'jd_based', 'resume_based'.
    *   **Non-Technical Oral Questions (approx. 25% of total):**
        *   stage: 'oral'
        *   type: 'conversational', 'behavioral', 'jd_based', 'resume_based' (soft skills, teamwork, communication).

    *Specific counts for Technical Roles based on duration and above percentages:*
    *   **15 minutes (Total 6-7 questions):**
        *   Technical Oral: 2-3 questions (ensure these are deeply technical and relevant)
        *   Technical Written: 2 questions
        *   Non-Technical Oral: 2 questions

    *   **30 minutes (Total 10-12 questions):**
        *   Technical Oral: 4-5 questions (ensure these are deeply technical and relevant)
        *   Technical Written: 3-4 questions
        *   Non-Technical Oral: 2-3 questions

    *   **45 minutes (Total 15-16 questions):**
        *   Technical Oral: 6-7 questions (ensure these are deeply technical and relevant)
        *   Technical Written: 4-5 questions
        *   Non-Technical Oral: 4-5 questions

General Guidelines for All Roles:
- Follow the strict priority: Targeted Job Description (if provided for this session) > Candidate's Resume Content (if JD not provided or for complementary info) > Profile Field/Role.
- All questions MUST be directly relevant to the information from the highest priority source available.
- For 'technical_written' questions of type 'coding', provide a clear, concise problem statement, ideally related to the highest priority source.
- Each question MUST have a unique 'id', its 'text', its designated 'stage', and its 'type'. The 'answer' field should NOT be part of this generation output.

Generate the questions array according to these guidelines. Ensure questions are challenging yet appropriate for the experience level implied by the role, field, job description, and resume.
If no jobDescription or resumeProcessedText is provided, generate questions based on role and field only, following the same distribution principles, ensuring technical questions are appropriately deep for the role.
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

    // Log the input received by the flow for easier debugging
    console.log("generateInterviewQuestionsFlow INPUT:", {
        profileField: input.profileField,
        role: input.role,
        interviewDuration: input.interviewDuration,
        jobDescriptionProvided: !!input.jobDescription,
        resumeProcessedTextProvided: !!input.resumeProcessedText,
        // For security/privacy, you might choose not to log the full text of JD/resume here in production logs
        // resumeProcessedTextLength: input.resumeProcessedText?.length || 0, 
        // jobDescriptionLength: input.jobDescription?.length || 0,
        isLikelyTechnicalRole,
    });


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

