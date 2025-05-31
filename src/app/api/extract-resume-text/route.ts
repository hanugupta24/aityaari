
// src/app/api/extract-resume-text/route.ts
import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
import pdf from 'pdf-parse'; // For server-side PDF parsing
import { extractResumeSections, type ExtractResumeSectionsOutput, type ExtractResumeSectionsInput } from '@/ai/flows/extract-resume-sections-flow';

// Polyfill for Promise.withResolvers if needed by dependencies in Node environment
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
  console.log("Polyfill for Promise.withResolvers applied in API route.");
}


export async function POST(request: Request) {
  console.log("API_ROUTE_PROCESS_RESUME: Received request to process resume.");
  const formData = await request.formData();
  const file = formData.get('resume') as File | null;

  if (!file) {
    console.error("API_ROUTE_PROCESS_RESUME: No file found in formData.");
    return NextResponse.json({ success: false, message: 'No file uploaded.' }, { status: 400 });
  }

  console.log(`API_ROUTE_PROCESS_RESUME: Processing file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);

  let rawText: string | null = null;
  let structuredExtractionError: string | null = null;
  let structuredData: ExtractResumeSectionsOutput | null = null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === 'application/pdf') {
      console.log("API_ROUTE_PROCESS_RESUME: Attempting to parse PDF using pdf-parse.");
      try {
        const data = await pdf(buffer);
        rawText = data.text;
        console.log(`API_ROUTE_PROCESS_RESUME: PDF parsed successfully. Text length: ${rawText?.length}`);
      } catch (pdfError: any) {
        console.error("API_ROUTE_PROCESS_RESUME: Error parsing PDF with pdf-parse:", pdfError);
        return NextResponse.json({ success: false, message: `Failed to parse PDF content: ${pdfError.message}` }, { status: 500 });
      }
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
      console.log("API_ROUTE_PROCESS_RESUME: Attempting to parse DOCX using mammoth.");
      try {
        const result = await mammoth.extractRawText({ buffer });
        rawText = result.value;
        console.log(`API_ROUTE_PROCESS_RESUME: DOCX parsed successfully. Text length: ${rawText?.length}`);
      } catch (docxError: any) {
        console.error("API_ROUTE_PROCESS_RESUME: Error parsing DOCX with mammoth:", docxError);
        return NextResponse.json({ success: false, message: `Failed to parse DOCX content: ${docxError.message}` }, { status: 500 });
      }
    } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
      console.log("API_ROUTE_PROCESS_RESUME: Attempting to parse TXT/MD.");
      rawText = buffer.toString('utf8');
      console.log(`API_ROUTE_PROCESS_RESUME: TXT/MD parsed successfully. Text length: ${rawText?.length}`);
    } else {
      console.warn(`API_ROUTE_PROCESS_RESUME: Unsupported file type: ${file.type}`);
      return NextResponse.json({ success: false, message: `Unsupported file type: ${file.type}. Please upload PDF, DOCX, TXT, or MD.` }, { status: 415 });
    }

    if (rawText && rawText.trim().length > 0) {
      console.log("API_ROUTE_PROCESS_RESUME: Raw text extracted. Now calling Genkit flow for structured data.");
      try {
        const extractInput: ExtractResumeSectionsInput = { resumeText: rawText };
        structuredData = await extractResumeSections(extractInput);
        console.log("API_ROUTE_PROCESS_RESUME: Genkit flow successful. Experiences found:", structuredData.experiences.length, "Projects found:", structuredData.projects.length);
      } catch (aiError: any) {
        console.error("API_ROUTE_PROCESS_RESUME: Error during AI structured extraction:", aiError);
        structuredExtractionError = `AI extraction failed: ${aiError.message}`;
        // Continue without structured data, but return the raw text.
      }
    } else {
      console.warn("API_ROUTE_PROCESS_RESUME: No raw text extracted or text is empty. Skipping AI structuring.");
      rawText = ""; // Ensure rawText is an empty string if null or only whitespace
    }

    return NextResponse.json({
      success: true,
      message: 'Resume processed.',
      rawText: rawText,
      experiences: structuredData?.experiences || [],
      projects: structuredData?.projects || [],
      structuredExtractionError: structuredExtractionError,
    });

  } catch (error: any) {
    console.error("API_ROUTE_PROCESS_RESUME: General error processing file:", error);
    let errorMessage = "An unexpected error occurred while processing the resume.";
    if (error.message) {
        errorMessage = error.message;
    }
    // Distinguish between a hard crash (which might result in HTML error) and a caught error
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        errorMessage = "File processing was aborted, possibly due to a timeout or network issue.";
    } else if (error.message?.includes('file type')) { // More specific error for type issues not caught above
        errorMessage = `Unsupported or problematic file type encountered: ${file.type || file.name}.`;
    }
    
    return NextResponse.json({ success: false, message: errorMessage, rawText: null, experiences: [], projects: [] }, { status: 500 });
  }
}
