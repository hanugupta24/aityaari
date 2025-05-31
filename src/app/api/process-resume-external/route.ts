
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import mammoth from 'mammoth';
import pdf from 'pdf-parse'; // For server-side PDF parsing
import type { ExtractedResumeData, ExperienceItem, ProjectItem, EducationItem } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  console.log("API_ROUTE_PROCESS_RESUME_EXTERNAL: Received request.");

  try {
    const formData = await request.formData();
    const file = formData.get('resumeFile') as File | null;

    if (!file) {
      console.log("API_ROUTE_PROCESS_RESUME_EXTERNAL: No file found in form data.");
      return NextResponse.json({ success: false, message: 'No file uploaded.' }, { status: 400 });
    }

    console.log(`API_ROUTE_PROCESS_RESUME_EXTERNAL: Processing file: ${file.name}, Type: ${file.type}, Size: ${file.size}`);
    const arrayBuffer = await file.arrayBuffer();
    let rawText = "";

    // Server-side raw text extraction
    if (file.type === 'application/pdf') {
      const data = await pdf(Buffer.from(arrayBuffer));
      rawText = data.text;
      console.log("API_ROUTE_PROCESS_RESUME_EXTERNAL: PDF raw text extracted using pdf-parse.");
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
      const result = await mammoth.extractRawText({ arrayBuffer });
      rawText = result.value;
      console.log("API_ROUTE_PROCESS_RESUME_EXTERNAL: DOCX raw text extracted using mammoth.");
    } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
      rawText = Buffer.from(arrayBuffer).toString('utf-8');
      console.log("API_ROUTE_PROCESS_RESUME_EXTERNAL: TXT/MD raw text extracted.");
    } else {
      console.log(`API_ROUTE_PROCESS_RESUME_EXTERNAL: Unsupported file type: ${file.type}. Only raw text will be empty.`);
      // For unsupported files, rawText remains empty, but we can still proceed to the (mock) Python call.
    }

    // --- START: Placeholder for calling your external Python service ---
    //
    // You would replace this section with an actual HTTP call (e.g., using fetch)
    // to your Python service endpoint.
    //
    // Example:
    //
    // const pythonServiceUrl = 'YOUR_PYTHON_SERVICE_ENDPOINT_HERE';
    // const pythonServiceHeaders = {
    //   // 'Authorization': 'Bearer YOUR_API_KEY_IF_NEEDED',
    //   'Content-Type': 'application/json' // Or whatever your Python service expects
    // };
    //
    // // If sending the file directly to Python service (modify if Python service expects raw text):
    // // const pythonFormData = new FormData();
    // // pythonFormData.append('resume_file', file);
    // // const pythonResponse = await fetch(pythonServiceUrl, {
    // //   method: 'POST',
    // //   body: pythonFormData,
    // //   // headers: pythonServiceHeaders (omit Content-Type if sending FormData)
    // // });
    //
    // // If sending rawText to Python service:
    // const pythonResponse = await fetch(pythonServiceUrl, {
    //    method: 'POST',
    //    headers: pythonServiceHeaders,
    //    body: JSON.stringify({ resume_text: rawText, file_name: file.name })
    // });
    //
    // if (!pythonResponse.ok) {
    //   const errorText = await pythonResponse.text();
    //   console.error(`API_ROUTE_PROCESS_RESUME_EXTERNAL: Error from Python service: ${pythonResponse.status}`, errorText);
    //   throw new Error(`Python service failed: ${pythonResponse.status} - ${errorText}`);
    // }
    //
    // const extractedDataFromPython: ExtractedResumeData = await pythonResponse.json();
    // console.log("API_ROUTE_PROCESS_RESUME_EXTERNAL: Successfully received structured data from Python service.");
    //
    // --- END: Placeholder for calling your external Python service ---

    // For now, returning MOCK structured data:
    console.log("API_ROUTE_PROCESS_RESUME_EXTERNAL: USING MOCK DATA as Python service call is a placeholder.");
    const mockExperiences: ExperienceItem[] = [
      { id: uuidv4(), jobTitle: "Mock Software Engineer", companyName: "Tech Solutions Inc.", startDate: "2022-01", endDate: "2023-12", description: "Developed mock features and fixed mock bugs. (Extracted by placeholder)" },
    ];
    const mockProjects: ProjectItem[] = [
      { id: uuidv4(), title: "Mock Resume Parser Project", description: "A project to demonstrate mock data extraction. (Extracted by placeholder)", technologiesUsed: ["MockTech1", "MockTech2"] },
    ];
    const mockEducation: EducationItem[] = [
      { id: uuidv4(), degree: "Mock Bachelor of Science", institution: "University of Mocking", yearOfCompletion: "2021", details: "Major in Mock Computer Science. (Extracted by placeholder)" },
    ];

    const extractedData: ExtractedResumeData = {
      name: "Mock John Doe (from API)",
      email: "mock.john.doe@example.com (from API)",
      phoneNumber: "+15550001111 (from API)",
      profileField: "Mock Data Science (from API)",
      role: "Mock Data Analyst (from API)",
      keySkills: ["Mock Python", "Mock SQL", "Mock Data Viz (from API)"],
      experiences: mockExperiences,
      projects: mockProjects,
      educationHistory: mockEducation,
      accomplishments: "Successfully completed several mock projects. (Extracted by placeholder)",
      rawText: rawText || "Mock raw text if extraction failed or was skipped.", // Include the extracted raw text
    };
    // --- END MOCK DATA ---

    return NextResponse.json({
      success: true,
      message: 'Resume processed (mock data). Replace mock call with your Python service.',
      data: extractedData,
    }, { status: 200 });

  } catch (error: any) {
    console.error('API_ROUTE_PROCESS_RESUME_EXTERNAL: Error processing resume:', error);
    return NextResponse.json({
      success: false,
      message: `Server error: ${error.message}`,
      data: null,
    }, { status: 500 });
  }
}
