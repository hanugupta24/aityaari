
import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
// Import pdf.js - try the main entry point first
import * as pdfjsLib from 'pdfjs-dist';

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


const LOG_PREFIX = "API_ROUTE_DEBUG (v_PDFJS_IMPORT_FIX):";

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
      console.log(`${LOG_PREFIX} PDF file detected. Proceeding with pdf.js parsing for: ${identifiedFile.name}`);
      let fileBufferArray;
      try {
        console.log(`${LOG_PREFIX} Attempting to read file into ArrayBuffer for PDF: ${identifiedFile.name}`);
        fileBufferArray = await identifiedFile.arrayBuffer();
        console.log(`${LOG_PREFIX} PDF File ArrayBuffer created successfully. Length: ${fileBufferArray.byteLength}`);
      } catch (bufferError: any) {
        console.error(`${LOG_PREFIX} Error reading file into ArrayBuffer for PDF ${identifiedFile.name}:`, bufferError);
        return NextResponse.json({ message: `Error reading file into ArrayBuffer for PDF: ${bufferError.message}` }, { status: 500 });
      }

      try {
        const uint8Array = new Uint8Array(fileBufferArray);
        console.log(`${LOG_PREFIX} Uint8Array created for pdf.js. Length: ${uint8Array.length}`);
        
        console.log(`${LOG_PREFIX} Calling pdfjsLib.getDocument()...`);
        const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
        console.log(`${LOG_PREFIX} PDF document loaded. Number of pages: ${pdfDoc.numPages}`);
        
        const pageTexts = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          console.log(`${LOG_PREFIX} Getting page ${i}...`);
          const page = await pdfDoc.getPage(i);
          console.log(`${LOG_PREFIX} Page ${i} retrieved. Getting text content...`);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => (item as any).str).join(' ');
          pageTexts.push(pageText);
          console.log(`${LOG_PREFIX} Extracted text from page ${i}/${pdfDoc.numPages}. Length: ${pageText.length}`);
        }
        const extractedText = pageTexts.join('\\n\\n'); 
        console.log(`${LOG_PREFIX} PDF.js parsing successful for: ${identifiedFile.name}. Total extracted text length: ${extractedText.length}`);
        return NextResponse.json({ text: extractedText });

      } catch (pdfError: any) {
        console.error(`${LOG_PREFIX} CRITICAL ERROR during pdf.js parsing for ${identifiedFile.name}:`, pdfError.message, pdfError.stack);
        return NextResponse.json({ message: `Failed to parse PDF content using pdf.js: ${pdfError.message}` }, { status: 500 });
      }
    } else {
      console.warn(`${LOG_PREFIX} Non-PDF file type received: ${fileType} for file ${identifiedFile.name}. Not processing in this focused test.`);
      return NextResponse.json({ 
        message: `File type '${fileType || 'unknown'}' (${identifiedFile.name}) not processed. This test is focused on PDF with pdf.js.`,
        status: "file_type_not_processed_in_pdfjs_test" 
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
