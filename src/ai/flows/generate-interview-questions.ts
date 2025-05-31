
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating interview questions.
 * It aims to create a mix of oral and technical/written questions based on user profile, role,
 * interview duration, an optional job description, and detailed profile information like resume,
 * experiences, projects, skills, and education.
 *
 * - generateInterviewQuestions - A function that generates interview questions.
 * - GenerateInterviewQuestionsInput - The input type for the generateInterviewQuestions function.
 * - GenerateInterviewQuestionsOutput - The output type for the generateInterviewQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { GeneratedQuestion } from '@/types';

// Schemas for structured profile data passed in the input
const ExperienceItemInputSchema = z.object({
  id: z.string(),
  jobTitle: z.string(),
  companyName: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  description: z.string().optional(),
}).describe("A specific work experience item from the user's profile.");

const ProjectItemInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  technologiesUsed: z.array(z.string()).optional(),
  projectUrl: z.string().optional(),
}).describe("A specific project item from the user's profile.");

const EducationItemInputSchema = z.object({
  id: z.string(),
  degree: z.string(),
  institution: z.string(),
  yearOfCompletion: z.string(),
  details: z.string().optional(),
}).describe("A specific education item from the user's profile.");


const GenerateInterviewQuestionsInputSchema = z.object({
  profileField: z.string().describe('The user profile field, e.g., Software Engineering, Data Science, Product Management.'),
  role: z.string().describe('The user role, e.g., Frontend Developer, Product Manager, Marketing Specialist.'),
  interviewDuration: z.enum(['15', '30', '45']).describe('The selected interview duration in minutes.'),
  jobDescription: z.string().optional().describe('Optional: The targeted job description provided by the user for this specific interview. This should be the primary source for questions if available.'),
  resumeProcessedText: z.string().optional().describe('Optional: The client-side processed text content of the candidate\'s resume. Use this to tailor questions.'),
  keySkills: z.array(z.string()).optional().describe("Optional: A list of key skills from the user's profile."),
  experiences: z.array(ExperienceItemInputSchema).optional().describe("Optional: A list of work experiences from the user's profile."),
  projects: z.array(ProjectItemInputSchema).optional().describe("Optional: A list of projects from the user's profile."),
  educationHistory: z.array(EducationItemInputSchema).optional().describe("Optional: A list of education items from the user's profile."),
});
export type GenerateInterviewQuestionsInput = z.infer<
  typeof GenerateInterviewQuestionsInputSchema
>;

const GeneratedQuestionSchemaInternal = z.object({
  id: z.string().describe('A unique ID for the question (e.g., q1, q2).'),
  text: z.string().describe('The question text.'),
  stage: z.enum(['oral', 'technical_written']).describe('The stage of the interview this question belongs to: "oral" for spoken answers, "technical_written" for typed/coding answers.'),
  type: z.enum(['behavioral', 'technical', 'coding', 'conversational', 'resume_based', 'jd_based', 'profile_based']).describe('The type of question. "jd_based" from job description. "resume_based" from resume text. "profile_based" from structured profile (experiences, projects, skills). "conversational", "behavioral" for general. "technical" for conceptual/deep dives. "coding" for coding tasks.'),
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
The interview duration is {{{interviewDuration}}} minutes.

**Strict Order of Priority for Question Generation:**

{{#if jobDescription}}
  **PRIORITY 1: BASED ON PROVIDED TARGETED JOB DESCRIPTION (FOR THIS SESSION)**
  *   The following Job Description is the **SOLE SOURCE** for generating questions for this interview.
  *   All questions MUST directly assess skills, experience, and qualifications mentioned in this job description.
  *   Mark all questions with type: 'jd_based'.
  *   Question Distribution for Job Description:
      *   Identify if the role described in the JD is technical (keywords: ${technicalRolesKeywords.join(', ')}).
      *   **If Technical Role (from JD):**
          *   Approximately 45% of questions: Deep domain-specific ORAL questions (conceptual, tool-specific, algorithmic, methodology-based, directly from JD requirements). Stage: 'oral', Type: 'jd_based' (can also be considered 'technical' in essence).
          *   Approximately 30% of questions: Deep technical WRITTEN questions (coding tasks, system design scenarios, detailed explanations of complex topics, directly from JD requirements). Stage: 'technical_written', Type: 'jd_based' (can also be considered 'technical' or 'coding' in essence).
          *   Approximately 25% of questions: Domain-specific ORAL questions related to management, behavioral aspects, problem-solving, or collaboration, as implied or required by the JD. Stage: 'oral', Type: 'jd_based' (can also be considered 'behavioral' in essence).
      *   **If Non-Technical Role (from JD):**
          *   All questions are ORAL. Stage: 'oral'.
          *   Mix of 'jd_based' questions covering behavioral, situational, role-specific knowledge, and strategic thinking as required by the JD. Type: 'jd_based' (can also be 'behavioral' or 'conversational').
  *   Number of questions (ensure 'oral' questions come before 'technical_written'):
      *   15 mins: 6-7 questions
      *   30 mins: 10-12 questions
      *   45 mins: 15-16 questions
      (Distribute these counts according to the technical/non-technical JD role breakdown above, respecting stage order).

  Targeted Job Description:
  ---
  {{{jobDescription}}}
  ---

  (Ignore all other profile information below if this Job Description is provided, except for basic context like candidate's target role/field if needed to interpret the JD fully for nuance, but JD is primary):
  Candidate's General Profile (for context with JD, if absolutely needed for nuance, but JD is primary):
  - General Profile Field: {{{profileField}}}
  - General Candidate Role: {{{role}}}

{{else}}
  **PRIORITY 2: BASED ON CANDIDATE'S DETAILED PROFILE (NO SPECIFIC JOB DESCRIPTION PROVIDED FOR THIS SESSION)**

  {{#if resumeProcessedText}}
  *   **CRITICAL INSTRUCTION: The resume content provided below is the ABSOLUTE MOST IMPORTANT source for generating questions in this scenario.**
  *   You MUST generate the majority of your domain-specific, technical, and coding questions *directly and deeply* from the content of this resume.
  *   Probe into specific experiences, skills, projects, and technologies mentioned. Ask "Tell me about X project from your resume," "Explain Y technology you listed," "Describe your role in Z experience."
  *   Mark these questions as type: 'resume_based'.
  *   Behavioral and general conversational questions should be MINIMIZED. They are secondary and should ONLY be used if the resume content is exceptionally sparse and insufficient to meet the required number of questions for the interview duration. Resume-derived, domain-specific questions take STRONG PRECEDENCE.
  - Resume Content (Processed Text from client-side - **PARAMOUNT source within profile**):
  ---
  {{{resumeProcessedText}}}
  ---
  *   If this resume content points to a different field/domain than the general {{{profileField}}} and {{{role}}}, questions MUST predominantly reflect this resume's content.
  {{else}}
  *   **Resume text is not available or is empty.**
  *   **CRITICAL INSTRUCTION: Since resume text is absent or empty, you MUST NOW PRIORITIZE generating domain-specific and technical questions directly from the candidate's structured profile data: Work Experiences, Projects, and Key Skills, if provided.**
  *   These structured details (experiences, projects, skills) are the **PRIMARY SOURCE** for questions in this scenario.
  *   Probe deeply into specific roles, responsibilities, technologies used in projects, and applications of listed skills.
  *   Mark these questions as type: 'profile_based'.
  *   Only if this structured profile data (Experiences, Projects, Key Skills) is also sparse or insufficient to meet the question count for the duration should you then consider more general questions based on the overall Profile Field and Role.
  *   General behavioral or conversational questions should be a **LAST RESORT** if all other specific data sources (resume, experiences, projects, skills) are exhausted.
  {{/if}}

  Candidate's General Profile (used as fallback or for context if resume/structured data is sparse):
  - Profile Field: {{{profileField}}}
  - Candidate Role: {{{role}}}

  {{#if experiences.length}}
  - Work Experiences from Profile (Use these if resume text is unavailable/empty):
    {{#each experiences}}
    - Title: {{this.jobTitle}} at {{this.companyName}} ({{this.startDate}} to {{this.endDate}})
      Description: {{this.description}}
    {{/each}}
  *   Ask about specific roles, responsibilities, challenges, achievements from these experiences. Mark as 'profile_based'.
  {{/if}}

  {{#if projects.length}}
  - Projects from Profile (Use these if resume text is unavailable/empty):
    {{#each projects}}
    - Title: {{this.title}}
      Description: {{this.description}}
      Tech: {{#if this.technologiesUsed}}{{#each this.technologiesUsed}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}N/A{{/if}}
      {{#if this.projectUrl}}URL: {{this.projectUrl}}{{/if}}
    {{/each}}
  *   Inquire about project details, tech used, problems solved from these projects. Mark as 'profile_based'.
  {{/if}}

  {{#if keySkills.length}}
  - Key Skills from Profile (Use these if resume text is unavailable/empty): {{#each keySkills}}{{#each this}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{/each}}
  *   Formulate questions to test depth and application of these skills. Mark as 'profile_based'.
  {{/if}}

  {{#if educationHistory.length}}
  - Education History from Profile (Use for context or relevant academic projects, especially if other data is sparse):
    {{#each educationHistory}}
    - Degree: {{this.degree}} from {{this.institution}} ({{this.yearOfCompletion}})
      Details: {{this.details}}
    {{/each}}
  *   Use for context or relevant academic projects. Mark as 'profile_based'.
  {{/if}}

  *   **Question Stages & Types (when No JD):**
      *   Determine if the role (indicated by Resume (if present) > Structured Profile (Experiences, Projects, Skills) > General Profile Field/Role) is technical. Technical role keywords: ${technicalRolesKeywords.join(', ')}.
      *   **For Non-Technical Roles (if no JD):**
          *   All questions 'oral'.
          *   If resumeProcessedText is available and non-empty, prioritize 'resume_based' questions.
          *   If resumeProcessedText is unavailable/empty, prioritize 'profile_based' questions from structured data (Experiences, Projects, Skills).
          *   Use 'conversational' or 'behavioral' types sparingly only if resume and structured profile data are insufficient.
          *   Number of questions: 15 mins (6-7 oral), 30 mins (10-12 oral), 45 mins (15-16 oral).
      *   **For Technical Roles (if no JD):**
          *   **If resumeProcessedText is available and non-empty, Technical Oral (approx. 45%) and Technical Written (approx. 30%) questions MUST be primarily 'resume_based'.** These questions must be specific, in-depth, and directly relevant to the technologies, projects, and experiences detailed in the resume.
          *   **If resumeProcessedText is unavailable/empty, Technical Oral (approx. 45%) and Technical Written (approx. 30%) questions MUST be primarily 'profile_based'** drawn from structured Experiences, Projects, and Key Skills.
          *   Generic 'technical' or 'coding' questions (not tied to the resume or structured profile) should ONLY be used as a last resort if both resume and structured profile data are extremely sparse and do not offer enough specific topics.
          *   Non-Technical Oral (approx. 25% of total): stage 'oral'. If resume/profile data is rich, these can also be 'resume_based' or 'profile_based' (e.g., "Tell me about a time you led a team, based on X project in your resume/profile."). Otherwise, use 'conversational' or 'behavioral' as a last resort.
          *   Specific counts for Technical Roles (if no JD), ensuring 'oral' questions come before 'technical_written':
              *   15 mins (Total 6-7): Tech Oral: 2-3, Tech Written: 2, Non-Tech Oral: 2
              *   30 mins (Total 10-12): Tech Oral: 4-5, Tech Written: 3-4, Non-Tech Oral: 2-3
              *   45 mins (Total 15-16): Tech Oral: 6-7, Tech Written: 4-5, Non-Tech Oral: 4-5
{{/if}}

**General Guidelines for All Scenarios:**
- The 'id' for each question MUST be unique (q1, q2, q3, etc.).
- Sequence: All 'oral' stage questions must come before all 'technical_written' stage questions.
- For 'technical_written' questions of type 'coding', provide a clear, concise problem statement, ideally related to the primary source (JD or Resume/Profile).
- Each question MUST have a unique 'id', its 'text', its designated 'stage', and its 'type'. The 'answer' field should NOT be part of this generation output.
- Generate the questions array according to these guidelines. Ensure questions are challenging yet appropriate for the experience level implied by the primary data source.
- Ensure your entire output is a single JSON object that strictly adheres to the defined output schema.
`,
});

const generateInterviewQuestionsFlow = ai.defineFlow(
  {
    name: 'generateInterviewQuestionsFlow',
    inputSchema: GenerateInterviewQuestionsInputSchema,
    outputSchema: GenerateInterviewQuestionsOutputSchema,
  },
  async (input) => {
    const isLikelyTechnicalRoleBasedOnProfile = technicalRolesKeywords.some(keyword =>
      input.role.toLowerCase().includes(keyword) || input.profileField.toLowerCase().includes(keyword)
    );

    // Enhanced logging for resume/profile data presence
    console.log("generateInterviewQuestionsFlow INPUT:", {
        profileField: input.profileField,
        role: input.role,
        interviewDuration: input.interviewDuration,
        jobDescriptionProvided: !!input.jobDescription,
        jobDescriptionSnippet: input.jobDescription ? input.jobDescription.substring(0,100) + "..." : "N/A",
        resumeProcessedTextProvidedAndNotEmpty: !!(input.resumeProcessedText && input.resumeProcessedText.trim() !== ""),
        resumeProcessedTextSnippet: input.resumeProcessedText ? (input.resumeProcessedText.trim() === "" ? "[EMPTY STRING]" : input.resumeProcessedText.substring(0, 100) + "...") : "N/A",
        keySkillsProvided: !!(input.keySkills && input.keySkills.length > 0),
        keySkillsCount: input.keySkills?.length || 0,
        experiencesProvided: !!(input.experiences && input.experiences.length > 0),
        experiencesCount: input.experiences?.length || 0,
        projectsProvided: !!(input.projects && input.projects.length > 0),
        projectsCount: input.projects?.length || 0,
        educationHistoryProvided: !!(input.educationHistory && input.educationHistory.length > 0),
        educationHistoryCount: input.educationHistory?.length || 0,
        isLikelyTechnicalRoleBasedOnProfile, // Note: LLM will determine technicality based on JD if provided
    });

    const {output} = await prompt(input);

    if (!output || !output.questions || output.questions.length === 0) {
        console.error("AI did not return any questions for generation. Input was:", input);
        // Fallback to a generic question if AI fails to generate
        return { questions: [{
            id: 'q1',
            text: 'Tell me about yourself and your experience relevant to this field.',
            stage: 'oral',
            type: 'conversational',
        }] };
    }

    // Ensure unique IDs and sort questions: oral first, then technical_written
    const sortedQuestions = output.questions
      .map((q, index) => ({
        ...q,
        id: q.id || `gen_q${index + 1}`, // Ensure ID exists, fallback if AI missed it
      }))
      .sort((a, b) => {
        // Sort by stage: 'oral' before 'technical_written'
        if (a.stage === 'oral' && b.stage === 'technical_written') return -1;
        if (a.stage === 'technical_written' && b.stage === 'oral') return 1;
        
        // If stages are the same, maintain original order or sort by ID if numeric
        const idANum = parseInt((a.id || 'q0').replace( /^\D+/g, ''), 10) || 0;
        const idBNum = parseInt((b.id || 'q0').replace( /^\D+/g, ''), 10) || 0;
        return idANum - idBNum;
    });

    return {
      questions: sortedQuestions as GeneratedQuestion[], // Cast to ensure GeneratedQuestion type
    };
  }
);


    
