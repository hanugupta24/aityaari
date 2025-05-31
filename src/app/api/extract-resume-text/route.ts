
import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const LOG_PREFIX = "API_ROUTE_DEBUG (v3):"; // Versioned log prefix

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
      console.warn(`${LOG_PREFIX} No file found in formData. Available keys:`, Array.from(formData.keys()).join(', '));
      return NextResponse.json({ message: 'No file uploaded under the "file" key.' }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
        console.warn(`${LOG_PREFIX} Uploaded entry is not a File instance. Type: ${typeof fileEntry}`);
        return NextResponse.json({ message: 'Invalid file upload. Expected a File object.' }, { status: 400 });
    }

    const file = fileEntry as File;
    console.log(`${LOG_PREFIX} File received: ${file.name}, Type: ${file.type}, Size: ${file.size} bytes`);

    if (file.size === 0) {
        console.warn(`${LOG_PREFIX} File is empty (0 bytes).`);
        return NextResponse.json({ message: 'Uploaded file is empty.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        console.warn(`${LOG_PREFIX} File size ${file.size} exceeds limit of ${MAX_FILE_SIZE_BYTES}.`);
        return NextResponse.json({ message: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.` }, { status: 413 });
    }

    let fileBuffer;
    try {
        console.log(`${LOG_PREFIX} Attempting to read file into ArrayBuffer...`);
        const arrayBuffer = await file.arrayBuffer();
        console.log(`${LOG_PREFIX} ArrayBuffer read successfully. Length: ${arrayBuffer.byteLength}`);
        fileBuffer = Buffer.from(arrayBuffer);
        console.log(`${LOG_PREFIX} File buffer created successfully. Length: ${fileBuffer.length}`);
    } catch (bufferError: any) {
        console.error(`${LOG_PREFIX} CRITICAL ERROR reading file to buffer:`, bufferError.message, bufferError.stack);
        return NextResponse.json({ message: `Error reading file content: ${bufferError.message}` }, { status: 500 });
    }

    let extractedText = "";

    if (file.type === 'application/pdf') {
      console.log(`${LOG_PREFIX} Processing PDF file: ${file.name}`);
      try {
        const data = await pdf(fileBuffer);
        extractedText = data && data.text ? data.text.trim() : "";
        if (!extractedText && data) {
          console.log(`${LOG_PREFIX} PDF processed, but no text content found (MIME type: ${file.type}, Name: ${file.name}). Possibly image-only PDF or parsing issue.`);
        } else if (extractedText) {
          console.log(`${LOG_PREFIX} Text extracted from PDF successfully. Length: ${extractedText.length}`);
        } else {
          console.log(`${LOG_PREFIX} PDF processing failed to yield data object from pdf-parse (MIME type: ${file.type}, Name: ${file.name}).`);
        }
      } catch (pdfError: any) {
        console.error(`${LOG_PREFIX} ERROR during PDF parsing for ${file.name}:`, pdfError.message, pdfError.stack);
        return NextResponse.json({ message: `Error parsing PDF file '${file.name}': ${pdfError.message}` }, { status: 500 });
      }
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
      console.log(`${LOG_PREFIX} Processing DOCX file: ${file.name}`);
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result && result.value ? result.value.trim() : "";
        if (!extractedText && result) {
          console.log(`${LOG_PREFIX} DOCX processed, but no text content found (MIME type: ${file.type}, Name: ${file.name}).`);
        } else if (extractedText) {
          console.log(`${LOG_PREFIX} Text extracted from DOCX successfully. Length: ${extractedText.length}`);
        } else {
           console.log(`${LOG_PREFIX} DOCX processing failed to yield result object from mammoth (MIME type: ${file.type}, Name: ${file.name}).`);
        }
      } catch (docxError: any) {
        console.error(`${LOG_PREFIX} ERROR during DOCX parsing for ${file.name}:`, docxError.message, docxError.stack);
        return NextResponse.json({ message: `Error parsing DOCX file '${file.name}': ${docxError.message}` }, { status: 500 });
      }
    } else {
      console.warn(`${LOG_PREFIX} Unsupported file type: ${file.type}. Name: ${file.name}`);
      return NextResponse.json({ message: `Unsupported file type: '${file.type}'. Please upload PDF or DOCX.` }, { status: 415 });
    }

    console.log(`${LOG_PREFIX} Returning extracted text. Length: ${extractedText.length}`);
    return NextResponse.json({ text: extractedText });

  } catch (error: any) {
    // This is the outermost catch block.
    let errorDetails = "Unknown error occurred during file processing.";
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
    console.error(`${LOG_PREFIX} CRITICAL UNHANDLED ERROR in API route: ${errorDetails}`, errorStack);
    return NextResponse.json(
      { message: `Server error during file processing. Please check server logs. Details: ${errorDetails.substring(0, 250)}` },
      { status: 500 }
    );
  } finally {
    console.log(`${LOG_PREFIX} Exiting /api/extract-resume-text POST handler.`);
  }
}
