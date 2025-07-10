
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Using the key you provided for freeimage.host
  const apiKey = '6d207e02198a847aa98d0a2a901485a5';

  try {
    const formData = await request.formData();
    const file = formData.get('image');

    if (!file) {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    // freeimage.host expects the file under the 'source' key
    const externalApiFormData = new FormData();
    externalApiFormData.append('source', file);
    
    // API endpoint for freeimage.host with your key
    const response = await fetch(`https://freeimage.host/api/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: externalApiFormData,
    });

    const result = await response.json();

    // Check for success based on the freeimage.host response structure
    if (result.status_code !== 200) {
      console.error('freeimage.host API Error:', result);
      return NextResponse.json(
        { error: result?.error?.message || 'Failed to upload image.' },
        { status: result.status_code || 500 }
      );
    }
    
    // The URL is located in result.image.url
    return NextResponse.json({ success: true, data: { url: result.image.url } }, { status: 200 });

  } catch (error) {
    console.error('Error in upload API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
