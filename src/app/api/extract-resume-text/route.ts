
import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const LOG_PREFIX = "API_ROUTE_DEBUG (v3_restored):"; // New version for clarity
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  console.log(`${LOG_PREFIX} /api/extract-resume-text POST handler INVOKED.`);

  try {
    let formData;
    try {
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
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      console.log(`${LOG_PREFIX} File buffer created successfully for ${file.name}.`);
    } catch (bufferError: any) {
      console.error(`${LOG_PREFIX} Error creating buffer from file ${file.name}:`, bufferError.message, bufferError.stack);
      return NextResponse.json({ message: `Error reading file content for ${file.name}.` }, { status: 500 });
    }

    let extractedText = "";

    if (file.type === "application/pdf") {
      console.log(`${LOG_PREFIX} Attempting PDF parsing for ${file.name}...`);
      try {
        const data = await pdf(fileBuffer);
        extractedText = data.text?.trim() || "";
        if (!extractedText) {
            console.warn(`${LOG_PREFIX} PDF parsing for ${file.name} resulted in empty text. The PDF might be image-based or have no selectable text.`);
            // We still return success but with empty text, client can decide how to handle.
        } else {
            console.log(`${LOG_PREFIX} PDF parsing successful for ${file.name}. Extracted characters: ${extractedText.length}`);
        }
      } catch (pdfError: any) {
        console.error(`${LOG_PREFIX} Error parsing PDF ${file.name} with pdf-parse:`, pdfError.message, pdfError.stack);
        return NextResponse.json({ message: `Error processing PDF file ${file.name}: ${pdfError.message}` }, { status: 500 });
      }
    } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith('.docx')) {
      console.log(`${LOG_PREFIX} Attempting DOCX parsing for ${file.name} with mammoth...`);
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value?.trim() || "";
         if (!extractedText) {
            console.warn(`${LOG_PREFIX} DOCX parsing for ${file.name} resulted in empty text.`);
        } else {
            console.log(`${LOG_PREFIX} DOCX parsing successful for ${file.name}. Extracted characters: ${extractedText.length}`);
        }
      } catch (docxError: any) {
        console.error(`${LOG_PREFIX} Error parsing DOCX ${file.name} with mammoth:`, docxError.message, docxError.stack);
        return NextResponse.json({ message: `Error processing DOCX file ${file.name}: ${docxError.message}` }, { status: 500 });
      }
    } else {
      console.warn(`${LOG_PREFIX} Unsupported file type: ${file.type} for file ${file.name}. Returning empty text.`);
      // For unsupported types, we'll return empty text rather than an error, 
      // as the client expects a 'text' field. The client can then decide how to handle empty text.
      // Alternatively, return status 415 (Unsupported Media Type)
      // return NextResponse.json({ message: `Unsupported file type: ${file.type}. Please upload PDF or DOCX.` }, { status: 415 });
    }
    
    console.log(`${LOG_PREFIX} Successfully processed file ${file.name}. Returning extracted text (length: ${extractedText.length}).`);
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
