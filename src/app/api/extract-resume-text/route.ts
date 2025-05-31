
import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
// @ts-ignore
import pdf from 'pdf-parse';

const LOG_PREFIX = "API_ROUTE_DEBUG (TXT_MD_ONLY_TEST):";

export async function POST(request: Request) {
  console.log(`${LOG_PREFIX} /api/extract-resume-text POST handler INVOKED.`);

  let file: File | null = null;
  let fileBuffer: Buffer | null = null;

  try {
    console.log(`${LOG_PREFIX} Attempting to parse formData...`);
    const formData = await request.formData();
    console.log(`${LOG_PREFIX} formData parsed successfully.`);

    const fileEntry = formData.get('file');

    if (!fileEntry) {
      console.error(`${LOG_PREFIX} 'file' entry not found in formData. Available keys: ${Array.from(formData.keys()).join(', ')}`);
      return NextResponse.json({ message: "'file' entry not found in formData." }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
      console.error(`${LOG_PREFIX} 'file' entry is not a File instance. Type received: ${typeof fileEntry}`);
      return NextResponse.json({ message: "'file' entry is not a valid File." }, { status: 400 });
    }
    file = fileEntry;
    console.log(`${LOG_PREFIX} File identified: ${file.name}, Type: ${file.type}, Size: ${file.size} bytes.`);

    if (file.size === 0) {
      console.error(`${LOG_PREFIX} File is empty: ${file.name}`);
      return NextResponse.json({ message: "Uploaded file is empty." }, { status: 400 });
    }

    console.log(`${LOG_PREFIX} Attempting to read file into ArrayBuffer...`);
    const arrayBuffer = await file.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
    console.log(`${LOG_PREFIX} File buffer created successfully. Buffer size: ${fileBuffer.length} bytes.`);

    let extractedText = "";

    if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
      console.log(`${LOG_PREFIX} Processing TXT file: ${file.name}`);
      extractedText = fileBuffer.toString("utf-8").trim();
      console.log(`${LOG_PREFIX} TXT processing successful for: ${file.name}. Extracted text length: ${extractedText.length}`);
    } else if (file.type === "text/markdown" || file.name.toLowerCase().endsWith(".md")) {
      console.log(`${LOG_PREFIX} Processing MD file: ${file.name}`);
      extractedText = fileBuffer.toString("utf-8").trim();
      console.log(`${LOG_PREFIX} MD processing successful for: ${file.name}. Extracted text length: ${extractedText.length}`);
    } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      console.warn(`${LOG_PREFIX} PDF parsing temporarily disabled for testing: ${file.name}`);
      return NextResponse.json({ message: `PDF parsing for '${file.name}' is temporarily disabled for testing. Please try a .txt or .md file.`, text: "" }, { status: 200 }); // Return 200 so client doesn't throw !response.ok immediately
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx")
    ) {
      console.warn(`${LOG_PREFIX} DOCX parsing temporarily disabled for testing: ${file.name}`);
      return NextResponse.json({ message: `DOCX parsing for '${file.name}' is temporarily disabled for testing. Please try a .txt or .md file.`, text: "" }, { status: 200 }); // Return 200
    } else {
      console.warn(`${LOG_PREFIX} Unsupported file type: ${file.type} for file ${file.name}`);
      return NextResponse.json(
        { message: `Unsupported file type: '${file.type || 'unknown'}'. Please upload a TXT, or MD file for current testing.` },
        { status: 415 }
      );
    }

    if (!extractedText && file.size > 0 && (file.name.toLowerCase().endsWith(".txt") || file.name.toLowerCase().endsWith(".md"))) {
      console.warn(`${LOG_PREFIX} Text extraction resulted in empty string for non-empty TXT/MD file: ${file.name}.`);
    }

    console.log(`${LOG_PREFIX} Returning successfully processed text for TXT/MD: ${file.name}. Length: ${extractedText.length}`);
    return NextResponse.json({ text: extractedText });

  } catch (error: any) {
    let errorDetails = "Unknown error occurred.";
    let errorStack = error?.stack || "No stack trace available.";

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
    console.error(`${LOG_PREFIX} CRITICAL UNHANDLED ERROR in POST handler: ${errorDetails}`, errorStack);
    console.error(`${LOG_PREFIX} File context: Name: ${file?.name || 'N/A'}, Type: ${file?.type || 'N/A'}, Size: ${file?.size || 'N/A'}`);
    console.error(`${LOG_PREFIX} Buffer context: Created: ${!!fileBuffer}, Size: ${fileBuffer?.length || 'N/A'}`);

    // This error might still be overridden by Next.js HTML 500 if the crash is too severe.
    return NextResponse.json(
      { message: `Server error during file processing: ${errorDetails.substring(0,250)}` },
      { status: 500 }
    );
  } finally {
    console.log(`${LOG_PREFIX} Exiting /api/extract-resume-text POST handler.`);
  }
}
