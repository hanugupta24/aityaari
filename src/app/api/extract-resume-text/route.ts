
import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export async function POST(request: Request) {
  console.log("API: /api/extract-resume-text POST request received.");
  try {
    console.log("API: Attempting to parse formData.");
    const formData = await request.formData();
    console.log("API: formData parsed successfully.");

    const file = formData.get('file') as File | null;

    if (!file) {
      console.warn('API: No file uploaded.');
      return NextResponse.json({ message: 'No file uploaded.' }, { status: 400 });
    }

    console.log(`API: File received: ${file.name}, type: ${file.type}, size: ${file.size} bytes.`);

    // Check for excessively large files early, before arrayBuffer
    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit for server processing
    if (file.size > MAX_SIZE_BYTES) {
        console.warn(`API: File too large: ${file.name}, size: ${file.size} bytes. Limit is ${MAX_SIZE_BYTES} bytes.`);
        return NextResponse.json({ message: `File is too large. Maximum size is ${MAX_SIZE_BYTES / (1024*1024)}MB.` }, { status: 413 }); // Payload Too Large
    }

    // Inner try-catch for file content processing
    try {
      console.log(`API: Attempting to read file buffer for ${file.name}.`);
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      console.log(`API: File buffer read successfully for ${file.name}. Buffer length: ${fileBuffer.length}`);
      let textContent = '';

      if (file.type === 'application/pdf') {
        console.log(`API: Parsing PDF: ${file.name}`);
        const data = await pdf(fileBuffer);
        textContent = data.text.trim();
        if (!textContent) {
            console.warn(`API: PDF parsed but no text content found for ${file.name}. The PDF might be image-based or empty.`);
        }
        console.log(`API: PDF parsing successful for ${file.name}. Text length: ${textContent.length}`);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
        console.log(`API: Processing DOCX: ${file.name}`);
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        textContent = result.value.trim();
        if (!textContent && result.messages && result.messages.length > 0) {
            console.warn(`API: DOCX processed with messages for ${file.name}:`, result.messages);
            // Potentially add result.messages to response if helpful
        }
        console.log(`API: DOCX processing successful for ${file.name}. Text length: ${textContent.length}`);
      } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
         console.log(`API: Processing plain text: ${file.name}`);
         textContent = fileBuffer.toString('utf8').trim();
         console.log(`API: Plain text processing successful for ${file.name}. Text length: ${textContent.length}`);
      } else {
        console.warn(`API: Unsupported file type received: ${file.type} for file ${file.name}`);
        return NextResponse.json({ message: `Unsupported file type: ${file.type}. Please upload PDF, DOCX, TXT, or MD files.` }, { status: 400 });
      }

      console.log(`API: Successfully extracted text from ${file.name}.`);
      return NextResponse.json({ text: textContent });

    } catch (parsingError: any) {
      console.error(`API: Error during specific file parsing for ${file.name}:`, parsingError);
      return NextResponse.json({ message: `Error parsing file content: ${parsingError.message || 'Unknown parsing error.'}` }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API: General error in /api/extract-resume-text (outer catch):', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    // Ensure errorDetails is always a string and truncated
    const errorDetailsString = (typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage)).substring(0, 500);

    console.log("API: Attempting to return JSON error response from a critical outer catch block.");
    return NextResponse.json(
      {
        message: "An unexpected server error occurred during file processing. Please check server logs for more details.",
        errorDetails: errorDetailsString
      },
      { status: 500 }
    );
  }
}
