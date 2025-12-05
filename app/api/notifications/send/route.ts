import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

interface SendNotificationRequest {
  // Notification content
  title: string;
  body: string;
  data?: Record<string, any>;

  // Options
  sound?: string;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

export async function POST(request: NextRequest) {
  try {
    const requestBody: SendNotificationRequest = await request.json();
    const {
      title,
      body,
      data,
      sound = 'default',
      badge,
      priority = 'high',
    } = requestBody;

    // Validate required fields
    if (!title || !body) {
      return NextResponse.json(
        { error: 'title and body are required' },
        { status: 400 }
      );
    }

    console.log('[Notifications] Broadcasting to all active tokens');

    // Get all active tokens from database
    const tokens = await prisma.pushToken.findMany({
      where: { isActive: true },
    });

    if (tokens.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active tokens found',
        sent: 0,
      });
    }

    console.log(`[Notifications] Found ${tokens.length} active tokens`);

    // Build Expo push messages
    const messages: ExpoPushMessage[] = tokens
      .filter(t => Expo.isExpoPushToken(t.token))
      .map(tokenRecord => ({
        to: tokenRecord.token,
        sound,
        title,
        body,
        data: data || {},
        badge,
        priority,
      }));

    // Send notifications in chunks (Expo recommends max 100 per request)
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    const errors = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        console.log(`[Notifications] Sent chunk of ${chunk.length} notifications`);
      } catch (error) {
        console.error('[Notifications] Error sending chunk:', error);
        errors.push(error);
      }
    }

    // Log notifications to database
    const logPromises = tokens.map(tokenRecord =>
      prisma.notificationLog.create({
        data: {
          tokenId: tokenRecord.id,
          title,
          body,
          data: data || {},
          status: 'sent',
          ticketId: null,
        },
      })
    );

    await Promise.allSettled(logPromises);

    // Update lastUsedAt for tokens
    await prisma.pushToken.updateMany({
      where: { id: { in: tokens.map(t => t.id) } },
      data: { lastUsedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: `Sent ${messages.length} notifications`,
      sent: messages.length,
      tickets,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('[API] Error sending notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
