
import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
// Import pdf.js - try the main entry point first
import * as pdfjsLib from 'pdfjs-dist';

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


// Set the workerSrc for Node.js environments. This is crucial.
// The 'pdfjs-dist/build/pdf.worker.js' path should resolve correctly if the package is installed.
if (typeof window === 'undefined') { // Check if running in Node.js
  try {
    // Attempt to require.resolve to get the absolute path to the worker script
    const workerSrcPath = require.resolve('pdfjs-dist/build/pdf.worker.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrcPath;
    console.log(`API_ROUTE_DEBUG (PDFJS_SETUP): pdf.js workerSrc set to: ${workerSrcPath}`);
  } catch (e) {
    console.error("API_ROUTE_DEBUG (PDFJS_SETUP): Failed to resolve 'pdfjs-dist/build/pdf.worker.js'. pdf.js might not work correctly on the server.", e);
    // Fallback or alternative, though less ideal if the above fails:
    // pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    // console.warn("API_ROUTE_DEBUG (PDFJS_SETUP): Using CDN fallback for pdf.js worker. This is not ideal for server-side rendering.");
  }
}


const LOG_PREFIX = "API_ROUTE_DEBUG (v_PDFJS_POLYFILL):";

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
    let fileBufferArray: ArrayBuffer;

    try {
      console.log(`${LOG_PREFIX} Attempting to read file into ArrayBuffer for: ${identifiedFile.name}`);
      fileBufferArray = await identifiedFile.arrayBuffer();
      console.log(`${LOG_PREFIX} File ArrayBuffer created successfully. Length: ${fileBufferArray.byteLength}`);
    } catch (bufferError: any) {
      console.error(`${LOG_PREFIX} Error reading file into ArrayBuffer for ${identifiedFile.name}:`, bufferError);
      return NextResponse.json({ message: `Error reading file into ArrayBuffer: ${bufferError.message}` }, { status: 500 });
    }

    if (fileType === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
      console.log(`${LOG_PREFIX} PDF file detected. Proceeding with pdf.js parsing for: ${identifiedFile.name}`);
      try {
        const uint8Array = new Uint8Array(fileBufferArray);
        console.log(`${LOG_PREFIX} Uint8Array created for pdf.js. Length: ${uint8Array.length}`);
        
        console.log(`${LOG_PREFIX} Calling pdfjsLib.getDocument()...`);
        const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
        console.log(`${LOG_PREFIX} PDF document loaded. Number of pages: ${pdfDoc.numPages}`);
        
        const pageTexts = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          // console.log(`${LOG_PREFIX} Getting page ${i}...`); // Can be very verbose
          const page = await pdfDoc.getPage(i);
          // console.log(`${LOG_PREFIX} Page ${i} retrieved. Getting text content...`);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => (item as any).str).join(' '); // Type assertion for item.str
          pageTexts.push(pageText);
          // console.log(`${LOG_PREFIX} Extracted text from page ${i}/${pdfDoc.numPages}. Length: ${pageText.length}`);
        }
        const extractedText = pageTexts.join('\\n\\n'); 
        console.log(`${LOG_PREFIX} PDF.js parsing successful for: ${identifiedFile.name}. Total extracted text length: ${extractedText.length}`);
        return NextResponse.json({ text: extractedText });

      } catch (pdfError: any) {
        console.error(`${LOG_PREFIX} CRITICAL ERROR during pdf.js parsing for ${identifiedFile.name}:`, pdfError.message, pdfError.stack);
        return NextResponse.json({ message: `Failed to parse PDF content using pdf.js: ${pdfError.message}` }, { status: 500 });
      }
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileNameLower.endsWith('.docx')) {
      console.log(`${LOG_PREFIX} DOCX file detected. Proceeding with mammoth.js parsing for: ${identifiedFile.name}`);
      try {
        const result = await mammoth.extractRawText({ arrayBuffer: fileBufferArray });
        console.log(`${LOG_PREFIX} Mammoth.js parsing successful for: ${identifiedFile.name}. Extracted text length: ${result.value.length}`);
        return NextResponse.json({ text: result.value });
      } catch (docxError: any) {
        console.error(`${LOG_PREFIX} CRITICAL ERROR during mammoth.js parsing for ${identifiedFile.name}:`, docxError.message, docxError.stack);
        return NextResponse.json({ message: `Failed to parse DOCX content using mammoth.js: ${docxError.message}` }, { status: 500 });
      }
    } else if (fileType === 'text/plain' || fileNameLower.endsWith('.txt') || fileType === 'text/markdown' || fileNameLower.endsWith('.md')) {
      console.log(`${LOG_PREFIX} Plain text or Markdown file detected. Reading directly for: ${identifiedFile.name}`);
      try {
        const text = Buffer.from(fileBufferArray).toString('utf8');
        console.log(`${LOG_PREFIX} Direct text read successful for: ${identifiedFile.name}. Text length: ${text.length}`);
        return NextResponse.json({ text });
      } catch (textReadError: any) {
        console.error(`${LOG_PREFIX} Error reading plain text/markdown file ${identifiedFile.name}:`, textReadError);
        return NextResponse.json({ message: `Error reading text file: ${textReadError.message}` }, { status: 500 });
      }
    } else {
      console.warn(`${LOG_PREFIX} Unsupported file type: ${fileType} for file ${identifiedFile.name}.`);
      return NextResponse.json({ 
        message: `Unsupported file type: '${fileType || 'unknown'}'. Please upload a PDF, DOCX, TXT, or MD file.`,
        status: "unsupported_file_type" 
      }, { status: 415 });
    }

  } catch (error: any) {
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
