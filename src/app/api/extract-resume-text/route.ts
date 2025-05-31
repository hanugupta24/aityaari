
import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const LOG_PREFIX = "API_ROUTE_DEBUG (v_FULL_PARSING_RESTORED):";

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

    let buffer;
    try {
      console.log(`${LOG_PREFIX} Attempting to read file into buffer for: ${identifiedFile.name}`);
      buffer = Buffer.from(await identifiedFile.arrayBuffer());
      console.log(`${LOG_PREFIX} File buffer created successfully for: ${identifiedFile.name}. Buffer length: ${buffer.length}`);
    } catch (bufferError: any) {
      console.error(`${LOG_PREFIX} Error reading file into buffer for ${identifiedFile.name}:`, bufferError);
      return NextResponse.json({ message: `Error reading file into buffer: ${bufferError.message}` }, { status: 500 });
    }

    let extractedText = "";

    if (identifiedFile.type === 'application/pdf' || identifiedFile.name.toLowerCase().endsWith('.pdf')) {
      console.log(`${LOG_PREFIX} Attempting PDF parsing for: ${identifiedFile.name}`);
      try {
        const data = await pdf(buffer);
        extractedText = data.text;
        console.log(`${LOG_PREFIX} PDF parsing successful for: ${identifiedFile.name}. Extracted text length: ${extractedText.length}`);
      } catch (pdfError: any) {
        console.error(`${LOG_PREFIX} Error parsing PDF ${identifiedFile.name}:`, pdfError);
        return NextResponse.json({ message: `Failed to parse PDF content: ${pdfError.message}` }, { status: 500 });
      }
    } else if (identifiedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || identifiedFile.name.toLowerCase().endsWith('.docx')) {
      console.log(`${LOG_PREFIX} Attempting DOCX parsing for: ${identifiedFile.name}`);
      try {
        const { value } = await mammoth.extractRawText({ buffer });
        extractedText = value;
        console.log(`${LOG_PREFIX} DOCX parsing successful for: ${identifiedFile.name}. Extracted text length: ${extractedText.length}`);
      } catch (docxError: any) {
        console.error(`${LOG_PREFIX} Error parsing DOCX ${identifiedFile.name}:`, docxError);
        return NextResponse.json({ message: `Failed to parse DOCX content: ${docxError.message}` }, { status: 500 });
      }
    } else if (identifiedFile.type === 'text/plain' || identifiedFile.name.toLowerCase().endsWith('.txt') || identifiedFile.type === 'text/markdown' || identifiedFile.name.toLowerCase().endsWith('.md')) {
      console.log(`${LOG_PREFIX} Attempting direct text reading for: ${identifiedFile.name}`);
      try {
        extractedText = buffer.toString('utf8');
        console.log(`${LOG_PREFIX} Direct text reading successful for: ${identifiedFile.name}. Extracted text length: ${extractedText.length}`);
      } catch (textReadError: any) {
        console.error(`${LOG_PREFIX} Error reading plain text/markdown file ${identifiedFile.name}:`, textReadError);
        return NextResponse.json({ message: `Failed to read text/markdown file: ${textReadError.message}` }, { status: 500 });
      }
    } else {
      console.warn(`${LOG_PREFIX} Unsupported file type: ${identifiedFile.type} for file ${identifiedFile.name}`);
      return NextResponse.json({ message: `Unsupported file type: ${identifiedFile.type}. Please upload .pdf, .docx, .txt, or .md files.` }, { status: 415 });
    }

    console.log(`${LOG_PREFIX} Successfully processed file: ${identifiedFile.name}. Sending extracted text.`);
    return NextResponse.json({ text: extractedText });

  } catch (error: any) {
    let errorDetails = "Unknown error during API request processing.";
    if (error instanceof Error) errorDetails = error.message;
    else if (typeof error === 'string') errorDetails = error;
    
    console.error(`${LOG_PREFIX} CRITICAL UNHANDLED ERROR in POST handler for file: ${identifiedFile?.name || 'N/A'}:`, errorDetails, error?.stack);
    
    // This is a fallback. Ideally, more specific catches above should handle errors.
    // If this point is reached, it implies an unexpected failure.
    return NextResponse.json(
      { message: `Server error processing file: ${errorDetails.substring(0, 300)}` },
      { status: 500 }
    );
  } finally {
    console.log(`${LOG_PREFIX} Exiting /api/extract-resume-text POST handler for file: ${identifiedFile?.name || 'N/A'}.`);
  }
}
