import { NextResponse } from "next/server";
import { getBotpressClient } from "@/lib/botpress/client";

export async function GET() {
  try {
    const client = getBotpressClient();
    const response = await client.listKnowledgeBases({});

    return NextResponse.json({
      knowledgeBases: response?.knowledgeBases ?? [],
      meta: response?.meta ?? {},
    });
  } catch (err: any) {
    console.error("Failed to list knowledge bases:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to list knowledge bases" },
      { status: 500 }
    );
  }
}

