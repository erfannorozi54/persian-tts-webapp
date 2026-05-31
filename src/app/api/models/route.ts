import { MODELS } from "@/lib/models";
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET() {
  const modelsWithStatus = MODELS.map((model) => {
    const localPath = path.join(process.cwd(), model.localDir);
    const downloaded = fs.existsSync(localPath) && fs.readdirSync(localPath).length > 0;

    return {
      id: model.id,
      name: model.name,
      description: model.description,
      huggingfaceId: model.huggingfaceId,
      vramRequired: model.vramRequired,
      languages: model.languages,
      capabilities: model.capabilities,
      downloaded,
    };
  });

  return NextResponse.json(modelsWithStatus);
}
