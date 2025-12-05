import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Total active tokens
    const totalActive = await prisma.pushToken.count({
      where: { isActive: true },
    });

    // Total inactive tokens
    const totalInactive = await prisma.pushToken.count({
      where: { isActive: false },
    });

    // Tokens by platform
    const byPlatform = await prisma.pushToken.groupBy({
      by: ['platform'],
      where: { isActive: true },
      _count: true,
    });

    // Recent notifications sent (last 24 hours)
    const recentNotifications = await prisma.notificationLog.count({
      where: {
        sentAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    // Total notifications sent (all time)
    const totalNotifications = await prisma.notificationLog.count();

    return NextResponse.json({
      success: true,
      stats: {
        totalActiveTokens: totalActive,
        totalInactiveTokens: totalInactive,
        platformBreakdown: byPlatform.map(p => ({
          platform: p.platform,
          count: p._count,
        })),
        notificationsSent24h: recentNotifications,
        totalNotificationsSent: totalNotifications,
      },
    });

  } catch (error) {
    console.error('[API] Error getting stats:', error);
    return NextResponse.json(
      { error: 'Failed to get statistics' },
      { status: 500 }
    );
  }
}
