
// Polyfill for Promise.withResolvers if it doesn't exist
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    console.log("API_ROUTE_DEBUG (POLYFILL APPLIED): Promise.withResolvers polyfill applied.");
    return { promise, resolve, reject };
  };
}

import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { extractResumeSections, type ExtractResumeSectionsOutput } from '@/ai/flows/extract-resume-sections-flow';

const LOG_PREFIX = "API_ROUTE_DEBUG (v_STRUCTURED_EXTRACTION):";

// Configure pdf.js for Node.js environment
if (typeof window === 'undefined') {
  try {
    // Attempt to use a dynamically resolved path for the worker, common for server-side.
    // pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.mjs');
    // Forcing main thread for stability in Node.js server environments for text extraction
     pdfjsLib.GlobalWorkerOptions.workerSrc = null;
    console.log(`${LOG_PREFIX} pdf.js workerSrc set to null (running on main thread for stability).`);
  } catch (e) {
    console.warn(`${LOG_PREFIX} Could not set pdf.js workerSrc via require.resolve. This might be okay if worker is not strictly needed or if using null directly. Error:`, e);
    // Fallback to null, which forces pdf.js to run on the main thread.
    pdfjsLib.GlobalWorkerOptions.workerSrc = null;
    console.log(`${LOG_PREFIX} pdf.js workerSrc set to null as fallback.`);
  }
}


export async function POST(request: Request) {
  console.log(`${LOG_PREFIX} POST handler invoked.`);
  let identifiedFile: File | null = null;
  let rawText: string | null = null;
  let extractedSections: ExtractResumeSectionsOutput | null = null;
  let structuredExtractionError: string | null = null;

  try {
    console.log(`${LOG_PREFIX} Attempting to parse formData...`);
    const formData = await request.formData();
    console.log(`${LOG_PREFIX} formData parsed successfully.`);

    const fileEntry = formData.get('file');

    if (!fileEntry) {
      console.error(`${LOG_PREFIX} 'file' entry not found in formData.`);
      return NextResponse.json({ success: false, message: "'file' entry not found." }, { status: 400 });
    }
    if (!(fileEntry instanceof File)) {
      console.error(`${LOG_PREFIX} 'file' entry is not a File instance. Type: ${typeof fileEntry}`);
      return NextResponse.json({ success: false, message: "'file' entry is not a valid File object." }, { status: 400 });
    }
    
    identifiedFile = fileEntry;
    console.log(`${LOG_PREFIX} File identified: ${identifiedFile.name}, Type: ${identifiedFile.type}, Size: ${identifiedFile.size} bytes.`);

    let fileBuffer: ArrayBuffer;
    try {
      console.log(`${LOG_PREFIX} Attempting to read file into ArrayBuffer for: ${identifiedFile.name}`);
      fileBuffer = await identifiedFile.arrayBuffer();
      console.log(`${LOG_PREFIX} File ArrayBuffer created. Length: ${fileBuffer.byteLength}`);
    } catch (bufferError: any) {
      console.error(`${LOG_PREFIX} Error reading file into ArrayBuffer for ${identifiedFile.name}:`, bufferError);
      return NextResponse.json({ success: false, message: `Error reading file into ArrayBuffer: ${bufferError.message}` }, { status: 500 });
    }

    // Text extraction logic
    if (identifiedFile.type === 'application/pdf') {
      console.log(`${LOG_PREFIX} Processing PDF file: ${identifiedFile.name} using pdf.js`);
      try {
        const typedArray = new Uint8Array(fileBuffer);
        const pdfDoc = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let textContent = '';
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const pageTextContent = await page.getTextContent();
          pageTextContent.items.forEach((item: any) => { // item is TextItem
            textContent += item.str + (item.hasEOL ? '\\n' : ' ');
          });
          textContent += '\\n'; // Add a newline after each page's content
        }
        rawText = textContent.trim();
        console.log(`${LOG_PREFIX} PDF content extracted successfully using pdf.js. Length: ${rawText.length}`);
      } catch (pdfError: any) {
        console.error(`${LOG_PREFIX} Error parsing PDF with pdf.js for ${identifiedFile.name}:`, pdfError);
        return NextResponse.json({ success: false, message: `Failed to parse PDF content using pdf.js: ${pdfError.message}` }, { status: 500 });
      }
    } else if (identifiedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || identifiedFile.name.toLowerCase().endsWith('.docx')) {
      console.log(`${LOG_PREFIX} Processing DOCX file: ${identifiedFile.name}`);
      try {
        const result = await mammoth.extractRawText({ buffer: Buffer.from(fileBuffer) });
        rawText = result.value;
        console.log(`${LOG_PREFIX} DOCX content extracted successfully. Length: ${rawText.length}`);
      } catch (docxError: any) {
        console.error(`${LOG_PREFIX} Error parsing DOCX for ${identifiedFile.name}:`, docxError);
        return NextResponse.json({ success: false, message: `Failed to parse DOCX content: ${docxError.message}` }, { status: 500 });
      }
    } else if (identifiedFile.type === 'text/plain' || identifiedFile.name.toLowerCase().endsWith('.txt') || identifiedFile.type === 'text/markdown' || identifiedFile.name.toLowerCase().endsWith('.md')) {
      console.log(`${LOG_PREFIX} Processing TXT/MD file: ${identifiedFile.name}`);
      try {
        rawText = Buffer.from(fileBuffer).toString('utf8');
        console.log(`${LOG_PREFIX} TXT/MD content extracted successfully. Length: ${rawText.length}`);
      } catch (textError: any) {
        console.error(`${LOG_PREFIX} Error reading TXT/MD for ${identifiedFile.name}:`, textError);
        return NextResponse.json({ success: false, message: `Failed to read text file content: ${textError.message}` }, { status: 500 });
      }
    } else {
      console.warn(`${LOG_PREFIX} Unsupported file type: ${identifiedFile.type} for file ${identifiedFile.name}`);
      return NextResponse.json({ success: false, message: `Unsupported file type: ${identifiedFile.type}. Please upload PDF, DOCX, TXT, or MD.` }, { status: 400 });
    }

    if (rawText && rawText.trim().length > 0) {
        console.log(`${LOG_PREFIX} Raw text extracted. Length: ${rawText.length}. Attempting structured extraction...`);
        try {
            extractedSections = await extractResumeSections({ resumeText: rawText });
            console.log(`${LOG_PREFIX} Structured extraction successful. Experiences: ${extractedSections.experiences.length}, Projects: ${extractedSections.projects.length}`);
        } catch (aiError: any) {
            console.error(`${LOG_PREFIX} Error during AI structured extraction:`, aiError);
            structuredExtractionError = `AI extraction failed: ${aiError.message}`;
            // We will still return the raw text even if structured extraction fails
        }
    } else if (rawText === null || rawText.trim().length === 0) {
        console.warn(`${LOG_PREFIX} Raw text extraction resulted in empty or null text for file ${identifiedFile.name}.`);
         // No need to call AI if rawText is empty
    }


    return NextResponse.json({ 
        success: true, 
        rawText: rawText, // Send rawText even if null/empty so client can decide
        extractedSections: extractedSections, 
        structuredExtractionError: structuredExtractionError,
        fileName: identifiedFile.name,
    });

  } catch (error: any) {
    let errorDetails = "Unknown error during API request processing.";
    if (error instanceof Error) errorDetails = error.message;
    else if (typeof error === 'string') errorDetails = error;
    
    console.error(`${LOG_PREFIX} CRITICAL UNHANDLED ERROR in POST handler for file: ${identifiedFile?.name || 'N/A'}:`, errorDetails, error?.stack);
    
    return NextResponse.json(
      { success: false, message: `Server error processing file: ${errorDetails.substring(0, 300)}` },
      { status: 500 }
    );
  } finally {
    console.log(`${LOG_PREFIX} Exiting /api/extract-resume-text POST handler for file: ${identifiedFile?.name || 'N/A'}.`);
  }
}
