
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
// Parsing libraries are intentionally commented out for this diagnostic step
// import * as pdfjsLib from 'pdfjs-dist';
// import mammoth from 'mammoth';

// if (typeof window === 'undefined') {
//   pdfjsLib.GlobalWorkerOptions.workerSrc = null;
//   console.log("API_ROUTE_DEBUG (PDFJS_SETUP): pdf.js workerSrc set to null (running on main thread).");
// }

const LOG_PREFIX = "API_ROUTE_DEBUG (V_BUFFER_ONLY_TEST):";

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

    let fileBufferArray: ArrayBuffer;
    try {
      console.log(`${LOG_PREFIX} Attempting to read file into ArrayBuffer for: ${identifiedFile.name}`);
      fileBufferArray = await identifiedFile.arrayBuffer();
      console.log(`${LOG_PREFIX} File ArrayBuffer created. Length: ${fileBufferArray.byteLength}`);
    } catch (bufferError: any) {
      console.error(`${LOG_PREFIX} Error reading file into ArrayBuffer for ${identifiedFile.name}:`, bufferError);
      return NextResponse.json({ message: `Error reading file into ArrayBuffer: ${bufferError.message}` }, { status: 500 });
    }

    // For this diagnostic, we stop here and don't attempt any parsing.
    return NextResponse.json({ 
        message: `File '${identifiedFile.name}' successfully read into ArrayBuffer. Buffer length: ${fileBufferArray.byteLength}. No parsing attempted in this diagnostic version.`,
        status: "success_buffer_read_only",
        fileName: identifiedFile.name,
        bufferLength: fileBufferArray.byteLength,
        // NO 'text' field is returned here
    });

  } catch (error: any) {
    let errorDetails = "Unknown error during API request processing.";
    if (error instanceof Error) errorDetails = error.message;
    else if (typeof error === 'string') errorDetails = error;
    
    console.error(`${LOG_PREFIX} CRITICAL UNHANDLED ERROR in POST handler for file: ${identifiedFile?.name || 'N/A'}:`, errorDetails, error?.stack);
    
    return NextResponse.json(
      { message: `Server error processing file before parsing libraries: ${errorDetails.substring(0, 300)}` },
      { status: 500 }
    );
  } finally {
    console.log(`${LOG_PREFIX} Exiting /api/extract-resume-text POST handler for file: ${identifiedFile?.name || 'N/A'}.`);
  }
}
