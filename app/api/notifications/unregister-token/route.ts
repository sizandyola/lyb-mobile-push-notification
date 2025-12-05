import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { expoPushToken } = body;

    if (!expoPushToken) {
      return NextResponse.json(
        { error: 'expoPushToken is required' },
        { status: 400 }
      );
    }

    // Mark token as inactive (don't delete for audit trail)
    const updated = await prisma.pushToken.updateMany({
      where: { token: expoPushToken },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Token unregistered successfully',
      count: updated.count,
    });

  } catch (error) {
    console.error('[API] Error unregistering token:', error);
    return NextResponse.json(
      { error: 'Failed to unregister token' },
      { status: 500 }
    );
  }
}
