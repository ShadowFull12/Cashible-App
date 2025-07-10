
import { sendSalesScribeBetaNotification } from '@/services/notificationService';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Simple check to ensure this isn't triggered by random browsers
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await sendSalesScribeBetaNotification();
    return NextResponse.json({ success: true, message: 'Notifications sent.' });
  } catch (error: any) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
