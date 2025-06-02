"use server";
/**
 * @fileOverview This file defines a Genkit flow for generating interview questions.
 * It aims to create a mix of oral and technical/written questions based on user profile, role,
 * interview duration, an optional job description, optional raw resume text, and detailed profile information
 * like structured experiences, projects, skills, and education (all nested under candidateProfile).
 *
 * - generateInterviewQuestions - A function that generates interview questions.
 * - GenerateInterviewQuestionsInput - The input type for the generateInterviewQuestions function.
 * - GenerateInterviewQuestionsOutput - The output type for the generateInterviewQuestions function.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";
import type {
  GeneratedQuestion,
  ExperienceItem,
  ProjectItem,
  EducationItem,
} from "@/types";

// Schemas for structured profile data passed in the input (under candidateProfile)
const ExperienceItemInputSchema = z
  .object({
    id: z.string(),
    jobTitle: z.string(),
    companyName: z.string(),
    startDate: z.string().describe("YYYY-MM format"),
    endDate: z.string().optional().describe("YYYY-MM format or 'Present'"),
    description: z.string().optional(),
  })
  .describe("A specific work experience item from the user's profile.");

const ProjectItemInputSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    technologiesUsed: z.array(z.string()).optional(),
    projectUrl: z.string().optional(),
  })
  .describe("A specific project item from the user's profile.");

const EducationItemInputSchema = z
  .object({
    id: z.string(),
    degree: z.string(),
    institution: z.string(),
    yearOfCompletion: z.string(),
    details: z.string().optional(),
  })
  .describe("A specific education item from the user's profile.");

const GenerateInterviewQuestionsInputSchema = z.object({
  // Top-level context for the flow
  profileField: z
    .string()
    .describe(
      "The user profile field, e.g., Software Engineering, Data Science, Product Management. (This is top-level context for the AI)."
    ),
  role: z
    .string()
    .describe(
      "The user role, e.g., Frontend Developer, Product Manager, Marketing Specialist. (This is top-level context for the AI)."
    ),
  interviewDuration: z
    .enum(["15", "30", "45"])
    .describe("The selected interview duration in minutes."),
  jobDescription: z
    .string()
    .optional()
    .describe(
      "Optional: The targeted job description provided by the user for this specific interview. This should be the primary source for questions if available."
    ),
  resumeRawText: z
    .string()
    .optional()
    .describe(
      "Optional: Full raw text content of the candidate's resume. If provided and no jobDescription, this will be a strong source for questions."
    ),

  // Nested candidate profile object - THIS IS REQUIRED
  candidateProfile: z
    .object({
      name: z.string().optional(),
      profileField: z
        .string()
        .describe(
          "Candidate's primary area of expertise (e.g., Software Engineering) - repetition for context within candidate object."
        ),
      role: z
        .string()
        .describe(
          "Candidate's current or target role (e.g., Senior Frontend Developer) - repetition for context within candidate object."
        ),
      educationHistory: z
        .array(EducationItemInputSchema)
        .optional()
        .describe("Structured education history."),
      keySkills: z
        .array(z.string())
        .optional()
        .describe("List of candidate's key skills."),
      workExperience: z
        .array(ExperienceItemInputSchema)
        .optional()
        .describe(
          "List of candidate's work experiences. (Maps to 'experiences' in UserProfile type)."
        ),
      projects: z
        .array(ProjectItemInputSchema)
        .optional()
        .describe("List of candidate's projects."),
      accomplishments: z
        .string()
        .optional()
        .describe("Summary of candidate's accomplishments."),
    })
    .describe(
      "Comprehensive information about the candidate, manually entered or pre-filled. This entire object is crucial for detailed question generation."
    ),
});

export type GenerateInterviewQuestionsInput = z.infer<
  typeof GenerateInterviewQuestionsInputSchema
>;

const GeneratedQuestionSchemaInternal = z.object({
  id: z.string().describe("A unique ID for the question (e.g., q1, q2)."),
  text: z.string().describe("The question text."),
  stage: z
    .enum(["oral", "technical_written"])
    .describe(
      'The stage of the interview this question belongs to: "oral" for spoken answers, "technical_written" for typed/coding answers.'
    ),
  type: z
    .enum([
      "behavioral",
      "technical",
      "coding",
      "conversational",
      "resume_based",
      "jd_based",
      "profile_based",
      "structured_exp_based",
      "structured_proj_based",
    ])
    .describe(
      'The type of question. "jd_based" from job description. "resume_based" from raw resume_raw_text. "structured_exp_based" or "structured_proj_based" from structured profile data. "profile_based" from general profile fields (skills, education). "conversational", "behavioral" for general. "technical" for conceptual/deep dives. "coding" for coding tasks.'
    ),
  answer: z
    .string()
    .optional()
    .describe(
      "The user's answer to this question, populated during the interview. This field should NOT be part of this generation output."
    ),
});

const GenerateInterviewQuestionsOutputSchema = z.object({
  questions: z
    .array(GeneratedQuestionSchemaInternal.omit({ answer: true }))
    .describe(
      'An array of generated interview questions with stages and types. The "answer" field should not be included in the output of this flow.'
    ),
});
export type GenerateInterviewQuestionsOutput = z.infer<
  typeof GenerateInterviewQuestionsOutputSchema
>;

export async function generateInterviewQuestions(
  input: GenerateInterviewQuestionsInput
): Promise<GenerateInterviewQuestionsOutput> {
  console.log(
    "generateInterviewQuestionsFlow INPUT:",
    JSON.stringify(input, null, 2)
  ); // Keep this for debugging
  return generateInterviewQuestionsFlow(input);
}

const technicalRolesKeywords = [
  "developer",
  "engineer",
  "scientist",
  "analyst",
  "architect",
  "programmer",
  "data",
  "software",
  "backend",
  "frontend",
  "fullstack",
  "flutter",
  "devops",
  "sre",
  "machine learning",
  "ai engineer",
  "cybersecurity",
  "network",
  "database administrator",
  "dba",
];

const prompt = ai.definePrompt({
  name: "generateInterviewQuestionsPrompt",
  input: { schema: GenerateInterviewQuestionsInputSchema },
  output: { schema: GenerateInterviewQuestionsOutputSchema },
  prompt: `You are an expert AI Interview Question Generator. Your primary task is to create a set of the best, most relevant, and frequently asked interview questions.
The interview duration is {{{interviewDuration}}} minutes.

**Strict Order of Priority for Question Generation:**

{{#if jobDescription}}
  **PRIORITY 1: BASED ON PROVIDED TARGETED JOB DESCRIPTION (FOR THIS SESSION)**
  *   The following Job Description is the **PRIMARY SOURCE** for generating questions for this interview.
  *   All questions MUST directly assess skills, experience, and qualifications mentioned in this job description.
  *   Mark all questions with type: 'jd_based'.
  *   Question Distribution for Job Description:
      *   Identify if the role described in the JD is technical (keywords: ${technicalRolesKeywords.join(
        ", "
      )}). The candidate's top-level role ('{{{role}}}') and profile field ('{{{profileField}}}') can provide context for this determination.
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
  (If JD is provided, other profile information below might be used for minor context but JD is primary).

{{else if resumeRawText}}
  **PRIORITY 2: BASED ON PROVIDED RAW RESUME TEXT**
  *   The following Raw Resume Text is the **PRIMARY SOURCE** for generating questions.
  *   Generate questions that probe the experiences, skills, projects, and qualifications mentioned throughout the resume text.
  *   Examples: "Your resume mentions [specific skill/technology from text], can you tell me about a project where you used it?" or "I see you worked at [company name from text], what was your most significant contribution there based on your resume description?"
  *   Mark all questions with type: 'resume_based'.
  *   Question Distribution for Resume Text:
      *   Identify if the candidate's target role ('{{{candidateProfile.role}}}' and '{{{candidateProfile.profileField}}}', or inferred from resume) is technical.
      *   **If Technical Role (from resume/profile):**
          *   Approx. 45% ORAL technical questions (conceptual, tool-specific, based on skills/projects in resume). Stage: 'oral', Type: 'resume_based'.
          *   Approx. 30% WRITTEN technical questions (coding problems based on languages/tools in resume, system design if relevant). Stage: 'technical_written', Type: 'resume_based'.
          *   Approx. 25% ORAL behavioral/situational questions, contextualized by resume content. Stage: 'oral', Type: 'resume_based'.
      *   **If Non-Technical Role (from resume/profile):**
          *   All questions ORAL. Mix of 'resume_based' questions (behavioral, role-specific knowledge, experience deep-dives based on resume). Stage: 'oral'.
  *   Number of questions (ensure 'oral' questions come before 'technical_written'): Same as JD-based distribution.

  Raw Resume Text:
  ---
  {{{resumeRawText}}}
  ---
  (Structured candidate profile data below can be used as secondary context to clarify or augment questions from resume text).

{{else}}
  {{#if candidateProfile.workExperience}}
    **PRIORITY 3A: BASED ON STRUCTURED WORK EXPERIENCES (if no JD and no Resume Text)**
    *   The following structured Work Experiences from the candidate's profile are the **PRIMARY SOURCE** for domain-specific, technical, and coding questions.
    *   Probe deeply into specific roles, responsibilities, challenges, achievements from these experiences.
    *   For example, you might ask about a specific role like "Tell me more about your responsibilities as a [Job Title] at [Company Name]?" or "Describe a challenge you faced during your time at [Company Name mentioned in one of the experiences]."
    *   Mark these questions as type: 'structured_exp_based'.
    - Structured Work Experiences:
      {{#each candidateProfile.workExperience}}
      - Title: {{this.jobTitle}} at {{this.companyName}} ({{this.startDate}} to {{this.endDate}})
        Description: {{this.description}}
      {{/each}}
  {{/if}}

  {{#if candidateProfile.projects}}
    **PRIORITY 3B: BASED ON STRUCTURED PROJECTS (if no JD/Resume, and secondary to Work Experiences if both exist)**
    *   The following structured Projects from the candidate's profile are a **KEY SOURCE** for technical and problem-solving questions.
    *   Inquire about project details, tech used, problems solved.
    *   For example, ask "Can you walk me through the [Project Title] project, highlighting the technologies you used and your key contributions?" or "What was your approach to using [a specific technology listed in a project] in that project?"
    *   Mark these questions as type: 'structured_proj_based'.
    - Structured Projects:
      {{#each candidateProfile.projects}}
      - Title: {{this.title}}
        Description: {{this.description}}
        Tech: {{#if this.technologiesUsed}}{{#each this.technologiesUsed}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}N/A{{/if}}
        {{#if this.projectUrl}}URL: {{this.projectUrl}}{{/if}}
      {{/each}}
  {{/if}}

  **PRIORITY 4: BASED ON GENERAL PROFILE FIELDS (Fallback if JD, Resume, and structured Experiences/Projects are all unavailable/sparse)**
  *   Generate questions based on the candidate's general Profile Field, Role, Key Skills, and Education History (all from within candidateProfile object).
  *   Also consider the top-level context: Overall Role '{{{role}}}' and Overall Profile Field '{{{profileField}}}'.
  *   Mark these as 'profile_based'.
  *   General behavioral or conversational questions are a **LAST RESORT**.
  - Candidate's General Profile (used as fallback):
    - Name: {{candidateProfile.name}}
    - Candidate's Profile Field: {{{candidateProfile.profileField}}}
    - Candidate's Role: {{{candidateProfile.role}}}
    {{#if candidateProfile.keySkills.length}}- Key Skills: {{#each candidateProfile.keySkills}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}
    {{#if candidateProfile.educationHistory.length}}
    - Education History:
      {{#each candidateProfile.educationHistory}}
      - Degree: {{this.degree}} from {{this.institution}} ({{this.yearOfCompletion}})
        Details: {{this.details}}
      {{/each}}
    {{/if}}
    {{#if candidateProfile.accomplishments}}- Accomplishments: {{{candidateProfile.accomplishments}}}{{/if}}

  *   **Question Stages & Types (when No JD and No Resume Text):**
      *   Determine if the candidate's role (indicated by structured Experiences/Projects > General Profile Field/Role within candidateProfile, or fallback to top-level '{{{role}}}' and '{{{profileField}}}') is technical. Technical role keywords: ${technicalRolesKeywords.join(
        ", "
      )}.
      *   **For Non-Technical Roles (if no JD/Resume):**
          *   All questions 'oral'.
          *   Prioritize 'structured_exp_based' / 'structured_proj_based' (if data exists), then 'profile_based'.
          *   Use 'conversational' or 'behavioral' types sparingly.
          *   Number of questions: 15 mins (6-7 oral), 30 mins (10-12 oral), 45 mins (15-16 oral).
      *   **For Technical Roles (if no JD/Resume):**
          *   Technical Oral (approx. 45%) and Technical Written (approx. 30%) questions MUST be primarily from structured Experiences/Projects if available ('structured_exp_based', 'structured_proj_based').
          *   Generic 'technical' or 'coding' questions (not tied to profile specifics) should be a LAST RESORT.
          *   Non-Technical Oral (approx. 25%): stage 'oral'. If profile data is rich, these can also be specific (e.g., 'structured_exp_based'). Otherwise, 'conversational' or 'behavioral' as a last resort.
          *   Specific counts for Technical Roles (if no JD/Resume), ensuring 'oral' questions come before 'technical_written':
              *   15 mins (Total 6-7): Tech Oral: 2-3, Tech Written: 2, Non-Tech Oral: 2
              *   30 mins (Total 10-12): Tech Oral: 4-5, Tech Written: 3-4, Non-Tech Oral: 2-3
              *   45 mins (Total 15-16): Tech Oral: 6-7, Tech Written: 4-5, Non-Tech Oral: 4-5
{{/if}}

**General Guidelines for All Scenarios:**
- The 'id' for each question MUST be unique (q1, q2, q3, etc.).
- Sequence: All 'oral' stage questions must come before all 'technical_written' stage questions.
- For 'technical_written' questions of type 'coding', provide a clear, concise problem statement, ideally related to the primary data source.
- Each question MUST have a unique 'id', its 'text', its designated 'stage', and its 'type'. The 'answer' field should NOT be part of this generation output.
- Generate the questions array according to these guidelines. Ensure questions are challenging yet appropriate for the experience level implied by the primary data source.
- Ensure your entire output is a single JSON object that strictly adheres to the defined output schema.
`,
});

const generateInterviewQuestionsFlow = ai.defineFlow(
  {
    name: "generateInterviewQuestionsFlow",
    inputSchema: GenerateInterviewQuestionsInputSchema,
    outputSchema: GenerateInterviewQuestionsOutputSchema,
  },
  async (input) => {
    // This console.log is already present from previous change.
    // console.log("generateInterviewQuestionsFlow INPUT:", JSON.stringify(input, null, 2));

    const { output } = await prompt(input);

    if (!output || !output.questions || output.questions.length === 0) {
      console.error(
        "AI did not return any questions for generation. Input was:",
        input
      );
      // Fallback to a generic question if AI fails
      return {
        questions: [
          {
            id: "q1",
            text: "Tell me about yourself and your experience relevant to this field.",
            stage: "oral",
            type: "conversational",
          },
        ],
      };
    }

    // Ensure questions are sorted: oral first, then technical_written
    // Also ensure IDs are unique if the LLM fails to provide them or provides duplicates.
    const sortedQuestions = output.questions
      .map((q, index) => ({
        ...q,
        id: q.id || `gen_q${index + 1}`,
      }))
      .sort((a, b) => {
        if (a.stage === "oral" && b.stage === "technical_written") return -1;
        if (a.stage === "technical_written" && b.stage === "oral") return 1;
        const idANum = parseInt((a.id || "q0").replace(/^\D+/g, ""), 10) || 0;
        const idBNum = parseInt((b.id || "q0").replace(/^\D+/g, ""), 10) || 0;
        return idANum - idBNum;
      });

    return {
      questions: sortedQuestions as GeneratedQuestion[],
    };
  }
);
