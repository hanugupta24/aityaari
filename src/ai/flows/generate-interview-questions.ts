
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
  startDate: z.string().describe("YYYY-MM format"),
  endDate: z.string().optional().describe("YYYY-MM format or 'Present'"),
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
  
  experiences: z.array(ExperienceItemInputSchema).optional().describe("Optional: Structured list of work experiences from the user's profile. Prioritized over raw resume text if no JD."),
  projects: z.array(ProjectItemInputSchema).optional().describe("Optional: Structured list of projects from the user's profile. Prioritized over raw resume text if no JD."),
  
  resumeRawText: z.string().optional().describe('Optional: The raw text content of the candidate\'s resume, extracted and saved to their profile. Use this if structured experiences/projects are not available and no JD is provided.'),
  // resumeProcessedText is deprecated in favor of resumeRawText from UserProfile
  
  keySkills: z.array(z.string()).optional().describe("Optional: A list of key skills from the user's profile. Used as context or fallback."),
  educationHistory: z.array(EducationItemInputSchema).optional().describe("Optional: A list of education items from the user's profile. Used as context or fallback."),
});
export type GenerateInterviewQuestionsInput = z.infer<
  typeof GenerateInterviewQuestionsInputSchema
>;

const GeneratedQuestionSchemaInternal = z.object({
  id: z.string().describe('A unique ID for the question (e.g., q1, q2).'),
  text: z.string().describe('The question text.'),
  stage: z.enum(['oral', 'technical_written']).describe('The stage of the interview this question belongs to: "oral" for spoken answers, "technical_written" for typed/coding answers.'),
  type: z.enum(['behavioral', 'technical', 'coding', 'conversational', 'resume_based', 'jd_based', 'profile_based', 'structured_exp_based', 'structured_proj_based']).describe('The type of question. "jd_based" from job description. "structured_exp_based" or "structured_proj_based" from structured profile data. "resume_based" from raw resume text. "profile_based" from general profile fields (skills, education). "conversational", "behavioral" for general. "technical" for conceptual/deep dives. "coding" for coding tasks.'),
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
          *   Approximately 45% of questions: Deep domain-specific ORAL questions (conceptual, tool-specific, algorithmic, methodology-based, directly from JD requirements). Stage: 'oral', Type: 'jd_based'.
          *   Approximately 30% of questions: Deep technical WRITTEN questions (coding tasks, system design scenarios, detailed explanations of complex topics, directly from JD requirements). Stage: 'technical_written', Type: 'jd_based'.
          *   Approximately 25% of questions: Domain-specific ORAL questions related to management, behavioral aspects, problem-solving, or collaboration, as implied or required by the JD. Stage: 'oral', Type: 'jd_based'.
      *   **If Non-Technical Role (from JD):**
          *   All questions are ORAL. Stage: 'oral'. Mix of 'jd_based' questions covering behavioral, situational, role-specific knowledge, and strategic thinking as required by the JD.
  *   Number of questions (ensure 'oral' questions come before 'technical_written'):
      *   15 mins: 6-7 questions
      *   30 mins: 10-12 questions
      *   45 mins: 15-16 questions
      (Distribute counts according to technical/non-technical JD role breakdown, respecting stage order).

  Targeted Job Description:
  ---
  {{{jobDescription}}}
  ---
  (Ignore all other profile information below if this Job Description is provided, except for basic context like candidate's target role/field if needed to interpret the JD fully, but JD is primary).

{{else}}
  {{#if experiences.length}}
    **PRIORITY 2A: BASED ON STRUCTURED WORK EXPERIENCES FROM PROFILE**
    *   The following structured Work Experiences are the **PRIMARY SOURCE** for generating domain-specific, technical, and coding questions.
    *   Probe deeply into specific roles, responsibilities, challenges, achievements from these experiences. Ask "Tell me about your role as {{experiences.0.jobTitle}} at {{experiences.0.companyName}}." or "Describe a challenge you faced during your time at {{experiences.1.companyName}}."
    *   Mark these questions as type: 'structured_exp_based'.
    - Structured Work Experiences:
      {{#each experiences}}
      - Title: {{this.jobTitle}} at {{this.companyName}} ({{this.startDate}} to {{this.endDate}})
        Description: {{this.description}}
      {{/each}}
  {{/if}}

  {{#if projects.length}}
    **PRIORITY 2B: BASED ON STRUCTURED PROJECTS FROM PROFILE**
    *   The following structured Projects are a **KEY SOURCE** (secondary to Work Experiences if both exist, otherwise primary if only projects exist) for technical and problem-solving questions.
    *   Inquire about project details, tech used, problems solved. Ask "Can you walk me through the {{projects.0.title}} project?" or "What was your approach to using {{projects.0.technologiesUsed.0}} in that project?"
    *   Mark these questions as type: 'structured_proj_based'.
    - Structured Projects:
      {{#each projects}}
      - Title: {{this.title}}
        Description: {{this.description}}
        Tech: {{#if this.technologiesUsed}}{{#each this.technologiesUsed}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}N/A{{/if}}
        {{#if this.projectUrl}}URL: {{this.projectUrl}}{{/if}}
      {{/each}}
  {{/if}}

  {{#if resumeRawText}}
    **PRIORITY 3: BASED ON RAW RESUME TEXT (Fallback if no JD, and no/sparse structured Experiences/Projects)**
    *   **CRITICAL INSTRUCTION: If Job Description (Priority 1) AND structured Experiences/Projects (Priority 2) are NOT available or are very sparse, then the raw resume content provided below is the NEXT MOST IMPORTANT source.**
    *   Generate domain-specific, technical, and coding questions *directly and deeply* from this resume text.
    *   Probe into specific experiences, skills, projects, and technologies mentioned. Mark as 'resume_based'.
    *   Behavioral and general conversational questions should be MINIMIZED.
    - Resume Content (Raw Text):
    ---
    {{{resumeRawText}}}
    ---
  {{else}}
    {{#unless experiences.length}}{{#unless projects.length}}
      *   **Raw resume text is not available or is empty, AND no structured experiences/projects were provided.**
    {{/unless}}{{/unless}}
  {{/if}}

  **PRIORITY 4: BASED ON GENERAL PROFILE FIELDS (Fallback if JD, structured data, and raw resume text are all unavailable/sparse)**
  *   If all higher priority data sources are missing or insufficient, generate questions based on the general Profile Field, Role, Key Skills, and Education.
  *   Mark these as 'profile_based'.
  *   General behavioral or conversational questions are a **LAST RESORT**.
  - Candidate's General Profile (used as fallback):
    - Profile Field: {{{profileField}}}
    - Candidate Role: {{{role}}}
    {{#if keySkills.length}}- Key Skills: {{#each keySkills}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}
    {{#if educationHistory.length}}
    - Education History:
      {{#each educationHistory}}
      - Degree: {{this.degree}} from {{this.institution}} ({{this.yearOfCompletion}})
        Details: {{this.details}}
      {{/each}}
    {{/if}}


  *   **Question Stages & Types (when No JD):**
      *   Determine if the role (indicated by structured Experiences/Projects > Resume Raw Text > General Profile Field/Role) is technical. Technical role keywords: ${technicalRolesKeywords.join(', ')}.
      *   **For Non-Technical Roles (if no JD):**
          *   All questions 'oral'.
          *   Prioritize 'structured_exp_based' / 'structured_proj_based', then 'resume_based', then 'profile_based'.
          *   Use 'conversational' or 'behavioral' types sparingly.
          *   Number of questions: 15 mins (6-7 oral), 30 mins (10-12 oral), 45 mins (15-16 oral).
      *   **For Technical Roles (if no JD):**
          *   Technical Oral (approx. 45%) and Technical Written (approx. 30%) questions MUST be primarily from structured Experiences/Projects if available ('structured_exp_based', 'structured_proj_based'), then from raw Resume Text ('resume_based').
          *   Generic 'technical' or 'coding' questions (not tied to profile specifics) should be a LAST RESORT.
          *   Non-Technical Oral (approx. 25%): stage 'oral'. If profile data is rich, these can also be specific (e.g., 'structured_exp_based'). Otherwise, 'conversational' or 'behavioral' as a last resort.
          *   Specific counts for Technical Roles (if no JD), ensuring 'oral' questions come before 'technical_written':
              *   15 mins (Total 6-7): Tech Oral: 2-3, Tech Written: 2, Non-Tech Oral: 2
              *   30 mins (Total 10-12): Tech Oral: 4-5, Tech Written: 3-4, Non-Tech Oral: 2-3
              *   45 mins (Total 15-16): Tech Oral: 6-7, Tech Written: 4-5, Non-Tech Oral: 4-5
{{/if}}

**General Guidelines for All Scenarios:**
- The 'id' for each question MUST be unique (q1, q2, q3, etc.).
- Sequence: All 'oral' stage questions must come before all 'technical_written' stage questions.
- For 'technical_written' questions of type 'coding', provide a clear, concise problem statement, ideally related to the primary source.
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
    console.log("generateInterviewQuestionsFlow INPUT:", {
        profileField: input.profileField,
        role: input.role,
        interviewDuration: input.interviewDuration,
        jobDescriptionProvided: !!input.jobDescription,
        experiencesProvided: !!(input.experiences && input.experiences.length > 0),
        experiencesCount: input.experiences?.length || 0,
        projectsProvided: !!(input.projects && input.projects.length > 0),
        projectsCount: input.projects?.length || 0,
        resumeRawTextProvidedAndNotEmpty: !!(input.resumeRawText && input.resumeRawText.trim() !== ""),
        keySkillsProvided: !!(input.keySkills && input.keySkills.length > 0),
        educationHistoryProvided: !!(input.educationHistory && input.educationHistory.length > 0),
    });

    const {output} = await prompt(input);

    if (!output || !output.questions || output.questions.length === 0) {
        console.error("AI did not return any questions for generation. Input was:", input);
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
