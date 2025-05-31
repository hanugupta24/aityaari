
import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
// Import pdf.js using the legacy build for Node.js compatibility for text extraction
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

// It's good practice to set the workerSrc to null in Node.js if you're not using workers,
// though for text extraction with the legacy build it might not be strictly necessary.
if (typeof window === 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = null;
}


const LOG_PREFIX = "API_ROUTE_DEBUG (v_PDFJS_ENABLED):";

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

    let fileBufferArray;
    try {
      console.log(`${LOG_PREFIX} Attempting to read file into ArrayBuffer for: ${identifiedFile.name}`);
      fileBufferArray = await identifiedFile.arrayBuffer();
      console.log(`${LOG_PREFIX} File ArrayBuffer created successfully for: ${identifiedFile.name}. Length: ${fileBufferArray.byteLength}`);
    } catch (bufferError: any) {
      console.error(`${LOG_PREFIX} Error reading file into ArrayBuffer for ${identifiedFile.name}:`, bufferError);
      return NextResponse.json({ message: `Error reading file into ArrayBuffer: ${bufferError.message}` }, { status: 500 });
    }

    let extractedText = "";
    const fileType = identifiedFile.type;
    const fileNameLower = identifiedFile.name.toLowerCase();

    if (fileType === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
      console.log(`${LOG_PREFIX} Attempting PDF parsing with pdf.js for: ${identifiedFile.name}`);
      try {
        const uint8Array = new Uint8Array(fileBufferArray);
        const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
        console.log(`${LOG_PREFIX} PDF document loaded. Number of pages: ${pdfDoc.numPages}`);
        
        const pageTexts = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => (item as any).str).join(' ');
          pageTexts.push(pageText);
          // Optional: Log progress per page
          // console.log(`${LOG_PREFIX} Extracted text from page ${i}/${pdfDoc.numPages}. Length: ${pageText.length}`);
        }
        extractedText = pageTexts.join('\\n\\n'); // Separate pages clearly
        console.log(`${LOG_PREFIX} PDF.js parsing successful for: ${identifiedFile.name}. Total extracted text length: ${extractedText.length}`);
      } catch (pdfError: any) {
        console.error(`${LOG_PREFIX} Error parsing PDF with pdf.js for ${identifiedFile.name}:`, pdfError);
        return NextResponse.json({ message: `Failed to parse PDF content using pdf.js: ${pdfError.message}` }, { status: 500 });
      }
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileNameLower.endsWith('.docx')) {
      console.log(`${LOG_PREFIX} Attempting DOCX parsing with mammoth for: ${identifiedFile.name}`);
      try {
        // Mammoth expects a Buffer for the buffer option
        const bufferForMammoth = Buffer.from(fileBufferArray);
        const { value } = await mammoth.extractRawText({ buffer: bufferForMammoth });
        extractedText = value;
        console.log(`${LOG_PREFIX} DOCX parsing successful for: ${identifiedFile.name}. Extracted text length: ${extractedText.length}`);
      } catch (docxError: any) {
        console.error(`${LOG_PREFIX} Error parsing DOCX ${identifiedFile.name}:`, docxError);
        return NextResponse.json({ message: `Failed to parse DOCX content: ${docxError.message}` }, { status: 500 });
      }
    } else if (fileType === 'text/plain' || fileNameLower.endsWith('.txt') || fileType === 'text/markdown' || fileNameLower.endsWith('.md')) {
      console.log(`${LOG_PREFIX} Attempting direct text reading for: ${identifiedFile.name}`);
      try {
        extractedText = Buffer.from(fileBufferArray).toString('utf8');
        console.log(`${LOG_PREFIX} Direct text reading successful for: ${identifiedFile.name}. Extracted text length: ${extractedText.length}`);
      } catch (textReadError: any) {
        console.error(`${LOG_PREFIX} Error reading plain text/markdown file ${identifiedFile.name}:`, textReadError);
        return NextResponse.json({ message: `Failed to read text/markdown file: ${textReadError.message}` }, { status: 500 });
      }
    } else {
      console.warn(`${LOG_PREFIX} Unsupported file type: ${fileType} for file ${identifiedFile.name}`);
      return NextResponse.json({ message: `Unsupported file type: ${fileType}. Please upload .pdf, .docx, .txt, or .md files.` }, { status: 415 });
    }

    console.log(`${LOG_PREFIX} Successfully processed file: ${identifiedFile.name}. Sending extracted text.`);
    return NextResponse.json({ text: extractedText });

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
