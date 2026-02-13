import { NextRequest, NextResponse } from 'next/server';
import { updateApprovalStatus } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  try {
    const { token, full_name } = await request.json();
    
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }
    
    if (!full_name || full_name.trim().length < 3) {
      return NextResponse.json({ error: 'Geçerli ad soyad girin' }, { status: 400 });
    }
    
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    await updateApprovalStatus(token, ip, full_name.trim());
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json({ error: 'Approval failed' }, { status: 500 });
  }
}
