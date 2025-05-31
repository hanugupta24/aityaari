
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
  *   Use the following candidate profile information. The order of importance within this profile is:
      1.  **Resume Content:** If available, this is the most comprehensive summary.
      2.  **Structured Experiences, Projects, Skills, Education:** Use to supplement resume or if resume is sparse.
      3.  **General Profile Field & Role:** For bridging questions or as a fallback.

  Candidate's General Profile:
  - Profile Field: {{{profileField}}}
  - Candidate Role: {{{role}}}

  {{#if resumeProcessedText}}
  - Resume Content (Processed Text from client-side - Primary source within profile):
  ---
  {{{resumeProcessedText}}}
  ---
  *   Generate specific 'resume_based' questions.
  *   If this resume content points to a different field/domain than the general {{{profileField}}} and {{{role}}}, questions MUST predominantly reflect this resume's content.
  {{else}}
  - No resume text provided. Rely on structured profile data and general role/field.
  {{/if}}

  {{#if experiences.length}}
  - Work Experiences from Profile:
    {{#each experiences}}
    - Title: {{this.jobTitle}} at {{this.companyName}} ({{this.startDate}} to {{this.endDate}})
      Description: {{this.description}}
    {{/each}}
  *   Ask about specific roles, responsibilities, challenges, achievements. Mark as 'profile_based'.
  {{/if}}

  {{#if projects.length}}
  - Projects from Profile:
    {{#each projects}}
    - Title: {{this.title}}
      Description: {{this.description}}
      Tech: {{#if this.technologiesUsed}}{{#each this.technologiesUsed}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}N/A{{/if}}
      {{#if this.projectUrl}}URL: {{this.projectUrl}}{{/if}}
    {{/each}}
  *   Inquire about project details, tech used, problems solved. Mark as 'profile_based'.
  {{/if}}

  {{#if keySkills.length}}
  - Key Skills from Profile: {{#each keySkills}}{{#each this}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{/each}}
  *   Formulate questions to test depth and application. Mark as 'profile_based'.
  {{/if}}

  {{#if educationHistory.length}}
  - Education History from Profile:
    {{#each educationHistory}}
    - Degree: {{this.degree}} from {{this.institution}} ({{this.yearOfCompletion}})
      Details: {{this.details}}
    {{/each}}
  *   Use for context or relevant academic projects. Mark as 'profile_based'.
  {{/if}}

  *   **Question Focus when No JD:**
      *   The candidate's demonstrated experience (from resume and structured profile data like experiences, projects, skills) should be the **main driver** for questions.
      *   Supplement these with a few questions related to their target {{{profileField}}} and {{{role}}} to assess interest, transferable skills, and how their past experiences align (these can be 'profile_based' or 'conversational'/'behavioral').
      *   If resume/structured profile data is sparse or unavailable, generate more questions based on {{{profileField}}} and {{{role}}} (type: 'behavioral', 'technical', 'conversational' as appropriate).

  *   **Question Stages & Types (when No JD):**
      *   Determine if the role (primarily indicated by Resume > Structured Profile > General Profile Field/Role) is technical. Technical role keywords: ${technicalRolesKeywords.join(', ')}.
      *   **For Non-Technical Roles (if no JD):**
          *   All questions 'oral'. Mix of 'conversational', 'behavioral', and 'resume_based'/'profile_based' (from profile data), or general questions based on profile/role.
          *   Number of questions: 15 mins (6-7 oral), 30 mins (10-12 oral), 45 mins (15-16 oral).
      *   **For Technical Roles (if no JD):**
          *   Prioritize questions based on Resume/Profile Data. 'technical' questions must be specific and in-depth, relevant to this data.
          *   Technical Oral (approx. 45% of total): stage 'oral', type 'technical' (deep conceptual from resume/profile), 'resume_based', 'profile_based'.
          *   Technical Written (approx. 30% of total): stage 'technical_written', type 'technical' (explanations, system design from resume/profile), 'coding' (tasks related to resume/profile).
          *   Non-Technical Oral (approx. 25% of total): stage 'oral', type 'conversational', 'behavioral', 'resume_based', 'profile_based' (soft skills from resume/profile).
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

    console.log("generateInterviewQuestionsFlow INPUT:", {
        profileField: input.profileField,
        role: input.role,
        interviewDuration: input.interviewDuration,
        jobDescriptionProvided: !!input.jobDescription,
        jobDescriptionSnippet: input.jobDescription ? input.jobDescription.substring(0,100) + "..." : "N/A",
        resumeProcessedTextProvided: !!input.resumeProcessedText,
        resumeProcessedTextSnippet: input.resumeProcessedText ? input.resumeProcessedText.substring(0, 100) + "..." : "N/A",
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

