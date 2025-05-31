
import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const LOG_PREFIX = "API_ROUTE_DEBUG (v_SIMPLIFIED_PARSING):"; 
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  console.log(`${LOG_PREFIX} /api/extract-resume-text POST handler INVOKED.`);

  try {
    let formData;
    try {
      console.log(`${LOG_PREFIX} Attempting to parse formData...`);
      formData = await request.formData();
      console.log(`${LOG_PREFIX} formData parsed successfully.`);
    } catch (formDataError: any) {
      console.error(`${LOG_PREFIX} CRITICAL ERROR parsing formData:`, formDataError.message, formDataError.stack);
      return NextResponse.json({ message: `Error processing request data: ${formDataError.message}. Ensure the request is multipart/form-data.` }, { status: 400 });
    }

    const fileEntry = formData.get('file');

    if (!fileEntry) {
      console.warn(`${LOG_PREFIX} No file found in formData. Keys available:`, Array.from(formData.keys()).join(', '));
      return NextResponse.json({ message: 'No file uploaded under the "file" key.' }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
      console.warn(`${LOG_PREFIX} Uploaded entry is not a File instance. Type: ${typeof fileEntry}`);
      return NextResponse.json({ message: 'Invalid file upload. Expected a File object.' }, { status: 400 });
    }
    
    const file = fileEntry as File;
    console.log(`${LOG_PREFIX} Received file: ${file.name}, Type: ${file.type}, Size: ${file.size} bytes`);

    if (file.size === 0) {
      console.warn(`${LOG_PREFIX} Uploaded file is empty: ${file.name}`);
      return NextResponse.json({ message: 'Uploaded file is empty.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      console.warn(`${LOG_PREFIX} File too large: ${file.name}, Size: ${file.size} bytes. Limit: ${MAX_FILE_SIZE_BYTES} bytes.`);
      return NextResponse.json({ message: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024*1024)}MB.` }, { status: 413 });
    }

    let fileBuffer;
    try {
      console.log(`${LOG_PREFIX} Attempting to create ArrayBuffer for file ${file.name}...`);
      const arrayBuffer = await file.arrayBuffer();
      console.log(`${LOG_PREFIX} ArrayBuffer created for ${file.name}. Size: ${arrayBuffer.byteLength}. Attempting to create Buffer...`);
      fileBuffer = Buffer.from(arrayBuffer);
      console.log(`${LOG_PREFIX} File buffer created successfully for ${file.name}. Buffer size: ${fileBuffer.length}`);
    } catch (bufferError: any) {
      console.error(`${LOG_PREFIX} Error creating buffer from file ${file.name}:`, bufferError.message, bufferError.stack);
      return NextResponse.json({ message: `Error reading file content for ${file.name}.` }, { status: 500 });
    }

    let extractedText = "";

    // --- PARSING LOGIC TEMPORARILY COMMENTED OUT FOR DEBUGGING ---
    console.log(`${LOG_PREFIX} Bypassing actual PDF/DOCX parsing for this diagnostic version.`);
    if (file.type === "application/pdf") {
      extractedText = `Dummy PDF text for ${file.name}. Actual parsing disabled.`;
      console.log(`${LOG_PREFIX} Pretended to parse PDF: ${file.name}`);
    } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith('.docx')) {
      extractedText = `Dummy DOCX text for ${file.name}. Actual parsing disabled.`;
      console.log(`${LOG_PREFIX} Pretended to parse DOCX: ${file.name}`);
    } else {
      console.warn(`${LOG_PREFIX} Unsupported file type: ${file.type} for file ${file.name}. Returning placeholder text as server cannot process this type.`);
      extractedText = `File type ${file.type} is not supported for direct text extraction in this diagnostic version.`;
    }
    // --- END OF TEMPORARILY COMMENTED OUT PARSING LOGIC ---
    
    console.log(`${LOG_PREFIX} Successfully processed file ${file.name} (DIAGNOSTIC - NO ACTUAL PARSING). Returning placeholder text (length: ${extractedText.length}).`);
    return NextResponse.json({ text: extractedText });

  } catch (error: any) {
    let errorDetails = "Unknown error occurred in API route.";
    let errorStack = error && error.stack ? error.stack : "No stack trace available.";

    if (error instanceof Error) {
        errorDetails = error.message;
    } else if (typeof error === 'string') {
        errorDetails = error;
    } else {
        try {
            errorDetails = JSON.stringify(error);
        } catch (stringifyError: any) {
            errorDetails = `Could not stringify error object: ${stringifyError.message}`;
        }
    }
    console.error(`${LOG_PREFIX} CRITICAL UNHANDLED ERROR in API route (outermost catch): ${errorDetails}`, errorStack);
    return NextResponse.json(
      { message: `Server error during file processing. Please check server logs. Details: ${errorDetails.substring(0, 250)}` },
      { status: 500 }
    );
  } finally {
    console.log(`${LOG_PREFIX} Exiting /api/extract-resume-text POST handler.`);
  }
}
