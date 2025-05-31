
import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { Readable } from 'stream';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded.' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ message: 'Invalid file type. Only PDF is supported by this endpoint.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Wrap buffer in a custom Readable stream if pdf-parse needs it
    // For pdf-parse, it can often take a Buffer directly.
    // const stream = new Readable();
    // stream.push(fileBuffer);
    // stream.push(null); // Signifies end of the stream

    const data = await pdf(fileBuffer);

    return NextResponse.json({ text: data.text.trim() });

  } catch (error: any) {
    console.error('Error extracting text from PDF:', error);
    // Check for specific pdf-parse errors if any known
    if (error.message && error.message.includes('Invalid PDF')) {
         return NextResponse.json({ message: 'Invalid or corrupted PDF file.' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Error processing PDF file.', error: error.message || 'Unknown error' }, { status: 500 });
  }
}
