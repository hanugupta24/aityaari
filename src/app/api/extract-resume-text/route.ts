
import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  console.log("API_ROUTE_DEBUG (v2): /api/extract-resume-text POST handler INVOKED.");
  try {
    console.log("API_ROUTE_DEBUG (v2): Attempting to parse formData.");
    const formData = await request.formData();
    console.log("API_ROUTE_DEBUG (v2): formData parsed successfully.");

    const fileEntry = formData.get('file');

    if (!fileEntry) {
      console.warn("API_ROUTE_DEBUG (v2): No file found in formData.");
      return NextResponse.json({ message: 'No file uploaded.' }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
        console.warn("API_ROUTE_DEBUG (v2): Uploaded entry is not a File instance.");
        return NextResponse.json({ message: 'Invalid file upload. Expected a File.' }, { status: 400 });
    }

    const file = fileEntry as File;
    console.log(`API_ROUTE_DEBUG (v2): File received: ${file.name}, Type: ${file.type}, Size: ${file.size} bytes`);

    if (file.size > MAX_FILE_SIZE_BYTES) {
        console.warn(`API_ROUTE_DEBUG (v2): File size ${file.size} exceeds limit of ${MAX_FILE_SIZE_BYTES}.`);
        return NextResponse.json({ message: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.` }, { status: 413 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    console.log("API_ROUTE_DEBUG (v2): File buffer created.");

    let extractedText = "";

    if (file.type === 'application/pdf') {
      console.log("API_ROUTE_DEBUG (v2): Processing PDF file.");
      const data = await pdf(fileBuffer);
      extractedText = data && data.text ? data.text.trim() : "";
      if (!extractedText && data) { // data might exist even if text is empty (e.g. image-only PDF)
        console.log("API_ROUTE_DEBUG (v2): PDF processed, but no text content found (possibly image-only PDF or parsing issue).");
      } else if (extractedText) {
        console.log("API_ROUTE_DEBUG (v2): Text extracted from PDF successfully.");
      } else {
        console.log("API_ROUTE_DEBUG (v2): PDF processing failed to yield data object from pdf-parse.");
      }
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
      console.log("API_ROUTE_DEBUG (v2): Processing DOCX file.");
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      extractedText = result && result.value ? result.value.trim() : "";
      if (!extractedText && result) {
        console.log("API_ROUTE_DEBUG (v2): DOCX processed, but no text content found.");
      } else if (extractedText) {
        console.log("API_ROUTE_DEBUG (v2): Text extracted from DOCX successfully.");
      } else {
         console.log("API_ROUTE_DEBUG (v2): DOCX processing failed to yield result object from mammoth.");
      }
    } else {
      console.warn(`API_ROUTE_DEBUG (v2): Unsupported file type: ${file.type}. Name: ${file.name}`);
      return NextResponse.json({ message: `Unsupported file type: ${file.type}. Please upload PDF or DOCX.` }, { status: 415 });
    }

    console.log("API_ROUTE_DEBUG (v2): Returning extracted text (or empty string if none found). Length:", extractedText.length);
    return NextResponse.json({ text: extractedText });

  } catch (error: any) {
    let errorDetails = "Unknown error occurred during file processing.";
    if (error instanceof Error) {
        errorDetails = error.message;
    } else if (typeof error === 'string') {
        errorDetails = error;
    } else {
        try {
            errorDetails = JSON.stringify(error);
        } catch (stringifyError) {
            errorDetails = "Could not stringify error object.";
        }
    }
    // Log the full error object in case message is not descriptive enough
    console.error(`API_ROUTE_DEBUG (v2): CRITICAL ERROR: ${errorDetails.substring(0, 500)}`, error); 
    return NextResponse.json(
      { message: `Server error during file processing. Please check server logs. Details: ${errorDetails.substring(0, 200)}` },
      { status: 500 }
    );
  } finally {
    console.log("API_ROUTE_DEBUG (v2): Exiting /api/extract-resume-text POST handler (v2).");
  }
}
