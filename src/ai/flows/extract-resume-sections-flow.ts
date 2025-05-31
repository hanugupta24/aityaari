
'use server';
/**
 * @fileOverview Extracts structured Experience and Project sections from resume text.
 *
 * - extractResumeSections - A function that parses resume text into structured data.
 * - ExtractResumeSectionsInput - The input type for the extractResumeSections function.
 * - ExtractResumeSectionsOutput - The return type for the extractResumeSections function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { v4 as uuidv4 } from 'uuid';

// Schemas for structured data (matching types in src/types/index.d.ts)
const ExperienceItemSchema = z.object({
  id: z.string().default(() => uuidv4()).describe("A unique ID for the experience item, generated upon extraction."),
  jobTitle: z.string().describe("The job title."),
  companyName: z.string().describe("The name of the company."),
  startDate: z.string().regex(/^\d{4}-\d{2}$/, "Start date must be in YYYY-MM format.").describe("The start date of the employment in YYYY-MM format (e.g., 2020-08). Infer the month if only year is provided (e.g., use 01 for January)."),
  endDate: z.string().regex(/^\d{4}-\d{2}$/, "End date must be in YYYY-MM format.").optional().describe("The end date of the employment in YYYY-MM format (e.g., 2022-05), or omit if it seems to be the current job based on terms like 'Present', 'Current', or very recent dates."),
  description: z.string().optional().describe("A description of responsibilities, achievements, and tasks, typically bullet points combined into a single string."),
}).describe("A single work experience item.");

const ProjectItemSchema = z.object({
  id: z.string().default(() => uuidv4()).describe("A unique ID for the project item, generated upon extraction."),
  title: z.string().describe("The title of the project."),
  description: z.string().describe("A description of the project, including its purpose and key features."),
  technologiesUsed: z.array(z.string()).optional().describe("An array of key technologies, tools, or programming languages used in the project."),
  projectUrl: z.string().url().optional().describe("An optional URL link to the project if mentioned."),
}).describe("A single project item.");

const ExtractResumeSectionsInputSchema = z.object({
  resumeText: z.string().describe('The full raw text content of a resume.'),
});
export type ExtractResumeSectionsInput = z.infer<typeof ExtractResumeSectionsInputSchema>;

const ExtractResumeSectionsOutputSchema = z.object({
  experiences: z.array(ExperienceItemSchema).describe('An array of extracted work experience items.'),
  projects: z.array(ProjectItemSchema).describe('An array of extracted project items.'),
});
export type ExtractResumeSectionsOutput = z.infer<typeof ExtractResumeSectionsOutputSchema>;

export async function extractResumeSections(
  input: ExtractResumeSectionsInput
): Promise<ExtractResumeSectionsOutput> {
  return extractResumeSectionsFlow(input);
}

const extractPrompt = ai.definePrompt({
  name: 'extractResumeSectionsPrompt',
  input: {schema: ExtractResumeSectionsInputSchema},
  output: {schema: ExtractResumeSectionsOutputSchema},
  prompt: `You are an expert resume parser. Your task is to analyze the provided resume text and extract structured information for "Work Experience" and "Projects" sections.

Resume Text:
\`\`\`
{{{resumeText}}}
\`\`\`

Please identify all relevant work experiences and personal/academic projects.

For each Work Experience, extract:
- jobTitle: The title of the role.
- companyName: The name of the company.
- startDate: The start date in YYYY-MM format. If only a year is given, assume January (e.g., '2019' becomes '2019-01'). If a month and year are given, use them (e.g., 'June 2019' becomes '2019-06').
- endDate: The end date in YYYY-MM format. If the role is current (e.g., "Present", "Current", or a very recent date that implies ongoing work), omit this field. If only a year is given, assume December if it's an end year (e.g. '2018-2019', end is '2019-12'), or specific month if provided.
- description: A combined string of all responsibilities, achievements, and tasks, often listed as bullet points. Concatenate them.

For each Project, extract:
- title: The name or title of the project.
- description: A summary of the project, its purpose, and key features.
- technologiesUsed: An array of strings listing key technologies, programming languages, or tools used.
- projectUrl: If a URL for the project is explicitly mentioned, extract it.

Important Instructions:
- Adhere strictly to the YYYY-MM format for dates.
- If a section (Experience or Projects) is not found or is empty, return an empty array for that section.
- Do not hallucinate information. Only extract what is present in the text.
- Ensure the output is a single JSON object matching the defined schema, including 'experiences' and 'projects' arrays. Each item in these arrays must have a unique 'id' (you can generate one or let the schema default handle it if that's how it's set up, but ensure it's present in the final JSON output for each item).
- If a date range is like "2018-2019", startDate is "2018-01" and endDate is "2019-12" unless specific months are mentioned.
- Combine multi-line descriptions or bullet points into a single string for the 'description' field.
- If a field is optional and not found, omit it from the item's JSON.
`,
});

const extractResumeSectionsFlow = ai.defineFlow(
  {
    name: 'extractResumeSectionsFlow',
    inputSchema: ExtractResumeSectionsInputSchema,
    outputSchema: ExtractResumeSectionsOutputSchema,
  },
  async (input) => {
    if (!input.resumeText || input.resumeText.trim() === "") {
      return { experiences: [], projects: [] };
    }
    const {output} = await extractPrompt(input);
    if (!output) {
      console.error("AI failed to extract resume sections. Input text was:", input.resumeText.substring(0, 500) + "...");
      // Return empty arrays if AI output is null/undefined to prevent downstream errors
      return { experiences: [], projects: [] };
    }
    // Ensure IDs are present, even if the LLM forgets (though Zod default should handle it)
    const experiencesWithIds = output.experiences.map(exp => ({ ...exp, id: exp.id || uuidv4() }));
    const projectsWithIds = output.projects.map(proj => ({ ...proj, id: proj.id || uuidv4() }));

    return { experiences: experiencesWithIds, projects: projectsWithIds };
  }
);
