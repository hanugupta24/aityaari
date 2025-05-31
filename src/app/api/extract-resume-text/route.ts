
// Polyfill for Promise.withResolvers if it doesn't exist
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
  console.log("API_ROUTE_DEBUG (POLYFILL): Promise.withResolvers polyfill applied.");
}

import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Set the workerSrc to null in Node.js environments to run on the main thread
// This can help avoid issues with worker script loading in bundled server environments.
if (typeof window === 'undefined') { // Check if running in Node.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = null;
  console.log("API_ROUTE_DEBUG (PDFJS_SETUP): pdf.js workerSrc set to null (running on main thread).");
}

const LOG_PREFIX = "API_ROUTE_DEBUG (v_PDFJS_FOCUSED_TEST):";

export async function POST(request: Request) {
  console.log(`${LOG_PREFIX} POST handler invoked.`);
  let identifiedFile: File | null = null;

  try {
    console.log(`${LOG_PREFIX} Attempting to parse formData...`);
    const formData = await request.formData();
    console.log(`${LOG_PREFIX} formData parsed successfully.`);

    const fileEntry = formData.get('file');

    if (!fileEntry) {
      console.error(`${LOG_PREFIX} 'file' entry not found in formData.`);
      return NextResponse.json({ message: "'file' entry not found. Ensure client sends 'file' key." }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
      console.error(`${LOG_PREFIX} 'file' entry is not a File instance. Type: ${typeof fileEntry}`);
      return NextResponse.json({ message: "'file' entry is not a valid File object." }, { status: 400 });
    }
    
    identifiedFile = fileEntry;
    console.log(`${LOG_PREFIX} File identified: ${identifiedFile.name}, Type: ${identifiedFile.type}, Size: ${identifiedFile.size} bytes.`);

    const fileType = identifiedFile.type;
    const fileNameLower = identifiedFile.name.toLowerCase();
    
    if (fileType === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
      console.log(`${LOG_PREFIX} PDF file detected. Attempting to process with pdf.js: ${identifiedFile.name}`);
      let fileBufferArray: ArrayBuffer;
      try {
        console.log(`${LOG_PREFIX} Attempting to read PDF file into ArrayBuffer for: ${identifiedFile.name}`);
        fileBufferArray = await identifiedFile.arrayBuffer();
        console.log(`${LOG_PREFIX} PDF File ArrayBuffer created. Length: ${fileBufferArray.byteLength}`);
      } catch (bufferError: any) {
        console.error(`${LOG_PREFIX} Error reading PDF file into ArrayBuffer for ${identifiedFile.name}:`, bufferError);
        return NextResponse.json({ message: `Error reading PDF file into ArrayBuffer: ${bufferError.message}` }, { status: 500 });
      }

      try {
        const uint8Array = new Uint8Array(fileBufferArray);
        console.log(`${LOG_PREFIX} Uint8Array created for pdf.js. Length: ${uint8Array.length}`);
        
        console.log(`${LOG_PREFIX} Calling pdfjsLib.getDocument({ data: uint8Array }).promise...`);
        const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
        console.log(`${LOG_PREFIX} PDF document loaded. Number of pages: ${pdfDoc.numPages}`);
        
        const pageTexts = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          console.log(`${LOG_PREFIX} Processing page ${i} of ${pdfDoc.numPages}`);
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => (item as any).str || '').join(' ');
          pageTexts.push(pageText);
          console.log(`${LOG_PREFIX} Page ${i} text extracted. Length: ${pageText.length}`);
        }
        const extractedText = pageTexts.join('\\n\\n'); 
        console.log(`${LOG_PREFIX} PDF.js parsing successful for: ${identifiedFile.name}. Total extracted text length: ${extractedText.length}`);
        if (extractedText.trim().length === 0) {
          console.warn(`${LOG_PREFIX} PDF.js parsing for ${identifiedFile.name} resulted in empty text. File might be image-based or problematic.`);
        }
        return NextResponse.json({ text: extractedText });

      } catch (pdfError: any) {
        console.error(`${LOG_PREFIX} CRITICAL ERROR during pdf.js parsing for ${identifiedFile.name}:`, pdfError.message, pdfError.stack);
        // Attempt to return a JSON error instead of crashing
        return NextResponse.json({ 
            message: `Failed to parse PDF content using pdf.js: ${pdfError.message}. Check server logs for details (filename: ${identifiedFile.name}).`,
            details: pdfError.stack // Include stack trace if available and helpful
        }, { status: 500 });
      }
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileNameLower.endsWith('.docx')) {
      console.log(`${LOG_PREFIX} DOCX file detected, but temporarily disabled for PDF testing: ${identifiedFile.name}`);
      return NextResponse.json({ message: `DOCX processing temporarily disabled for testing. File: ${identifiedFile.name}`, status: "docx_disabled_for_test" }, { status: 400 });
    } else if (fileType === 'text/plain' || fileNameLower.endsWith('.txt') || fileType === 'text/markdown' || fileNameLower.endsWith('.md')) {
      console.log(`${LOG_PREFIX} TXT/MD file detected, but temporarily disabled for PDF testing: ${identifiedFile.name}`);
      return NextResponse.json({ message: `TXT/MD processing temporarily disabled for testing. File: ${identifiedFile.name}`, status: "txt_md_disabled_for_test" }, { status: 400 });
    } else {
      console.warn(`${LOG_PREFIX} Unsupported file type: ${fileType} for file ${identifiedFile.name}.`);
      return NextResponse.json({ 
        message: `Unsupported file type: '${fileType || 'unknown'}'. Please upload a PDF. Other types temporarily disabled for testing.`,
        status: "unsupported_file_type_pdf_test" 
      }, { status: 415 });
    }

  } catch (error: any) {
    // This is the outermost catch block. If an error reaches here and it's still an HTML 500,
    // it means the crash happened before this block could execute properly.
    let errorDetails = "Unknown error during API request processing.";
    if (error instanceof Error) errorDetails = error.message;
    else if (typeof error === 'string') errorDetails = error;
    
    console.error(`${LOG_PREFIX} CRITICAL UNHANDLED ERROR in POST handler for file: ${identifiedFile?.name || 'N/A'}:`, errorDetails, error?.stack);
    
    return NextResponse.json(
      { message: `Server error processing file: ${errorDetails.substring(0, 300)}` },
      { status: 500 }
    );
  } finally {
    console.log(`${LOG_PREFIX} Exiting /api/extract-resume-text POST handler for file: ${identifiedFile?.name || 'N/A'}.`);
  }
}
