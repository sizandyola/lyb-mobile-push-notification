import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Expo } from "expo-server-sdk";

const expo = new Expo();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token: expoPushToken, platform, deviceInfo } = body;

    // Validate the token format
    if (!Expo.isExpoPushToken(expoPushToken)) {
      return NextResponse.json(
        { error: "Invalid Expo push token format" },
        { status: 400 }
      );
    }

    // Check if token already exists
    const existingToken = await prisma.pushToken.findUnique({
      where: { token: expoPushToken },
    });

    if (existingToken) {
      // Update existing token (user might have reinstalled app)
      const updated = await prisma.pushToken.update({
        where: { token: expoPushToken },
        data: {
          platform,
          deviceInfo,
          isActive: true,
          lastUsedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Token updated successfully",
        tokenId: updated.id,
      });
    }

    // Create new token
    const newToken = await prisma.pushToken.create({
      data: {
        token: expoPushToken,
        platform,
        deviceInfo,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Token registered successfully",
      tokenId: newToken.id,
    });
  } catch (error) {
    console.error("[API] Error registering token:", error);
    return NextResponse.json(
      { error: "Failed to register token" },
      { status: 500 }
    );
  }
}
