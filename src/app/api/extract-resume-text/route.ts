
import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const LOG_PREFIX = "API_ROUTE_DEBUG (v_FULL_PARSING_ENABLED):"; 
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
      const availableKeys = Array.from(formData.keys()).join(', ') || 'none';
      console.warn(`${LOG_PREFIX} No file found in formData under the 'file' key. Available keys: [${availableKeys}]`);
      return NextResponse.json({ message: `No file uploaded under the "file" key. Keys found: [${availableKeys}]` }, { status: 400 });
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
      return NextResponse.json({ message: `Error reading file content for ${file.name}. Could not create buffer.` }, { status: 500 });
    }

    let extractedText = "";

    if (file.type === "application/pdf") {
      console.log(`${LOG_PREFIX} Attempting to parse PDF: ${file.name} (Size: ${fileBuffer.length} bytes)`);
      try {
        const data = await pdf(fileBuffer);
        extractedText = data.text ? data.text.trim() : "";
        console.log(`${LOG_PREFIX} PDF parsing successful for ${file.name}. Text length: ${extractedText.length}`);
      } catch (pdfError: any) {
        console.error(`${LOG_PREFIX} Error parsing PDF ${file.name}:`, pdfError.message, pdfError.stack);
        return NextResponse.json({ message: `Error parsing PDF file '${file.name}'. The file might be corrupted or an unsupported PDF version. Details: ${pdfError.message}` }, { status: 500 });
      }
    } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith('.docx')) {
      console.log(`${LOG_PREFIX} Attempting to parse DOCX: ${file.name} (Size: ${fileBuffer.length} bytes)`);
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value ? result.value.trim() : "";
        console.log(`${LOG_PREFIX} DOCX parsing successful for ${file.name}. Text length: ${extractedText.length}`);
      } catch (docxError: any) {
        console.error(`${LOG_PREFIX} Error parsing DOCX ${file.name}:`, docxError.message, docxError.stack);
        return NextResponse.json({ message: `Error parsing DOCX file '${file.name}'. The file might be corrupted or an unsupported DOCX format. Details: ${docxError.message}` }, { status: 500 });
      }
    } else if (file.type === "text/plain" || file.name.toLowerCase().endsWith('.txt') || file.type === "text/markdown" || file.name.toLowerCase().endsWith('.md')) {
        console.log(`${LOG_PREFIX} Reading plain text/markdown file: ${file.name}`);
        try {
            extractedText = fileBuffer.toString('utf8').trim();
            console.log(`${LOG_PREFIX} Plain text/markdown reading successful for ${file.name}. Text length: ${extractedText.length}`);
        } catch (textReadError: any) {
            console.error(`${LOG_PREFIX} Error reading text file ${file.name}:`, textReadError.message, textReadError.stack);
            return NextResponse.json({ message: `Error reading text file '${file.name}'. Details: ${textReadError.message}` }, { status: 500 });
        }
    } else {
      console.warn(`${LOG_PREFIX} Unsupported file type: ${file.type} for file ${file.name}. Client-side should prevent this, but handling server-side too.`);
      return NextResponse.json({ message: `Unsupported file type: '${file.type}'. Please upload .txt, .md, .pdf, or .docx files.` }, { status: 415 });
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
