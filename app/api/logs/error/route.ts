import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      tokenId,
      platform,
      errorType,
      message,
      stackTrace,
      context,
      appVersion,
    } = body;

    // Validate required fields
    if (!errorType || !message) {
      return NextResponse.json(
        { error: "errorType and message are required" },
        { status: 400 }
      );
    }

    // Create error log entry
    const errorLog = await prisma.errorLog.create({
      data: {
        tokenId: tokenId || null,
        platform: platform || null,
        errorType,
        message,
        stackTrace: stackTrace || null,
        context: context || null,
        appVersion: appVersion || null,
      },
    });

    return NextResponse.json({
      success: true,
      id: errorLog.id,
    });
  } catch (error) {
    console.error("[Error Log API] Failed to create error log:", error);
    return NextResponse.json({ error: "Failed to log error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const errorType = searchParams.get("errorType");
    const platform = searchParams.get("platform");

    // Build where clause
    const where: any = {};
    if (errorType) where.errorType = errorType;
    if (platform) where.platform = platform;

    // Get error logs
    const errorLogs = await prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Get stats
    const total = await prisma.errorLog.count({ where });
    const errorTypes = await prisma.errorLog.groupBy({
      by: ["errorType"],
      _count: true,
      orderBy: { _count: { errorType: "desc" } },
    });

    return NextResponse.json({
      success: true,
      data: errorLogs,
      stats: {
        total,
        errorTypes: errorTypes.map((et) => ({
          type: et.errorType,
          count: et._count,
        })),
      },
    });
  } catch (error) {
    console.error("[Error Log API] Failed to fetch error logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch error logs" },
      { status: 500 }
    );
  }
}
