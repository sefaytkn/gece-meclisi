import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const prisma = new PrismaClient();

async function main() {
  await prisma.game.upsert({
    where: { slug: "vampire-village" },
    update: {
      name: "Vampir Köylü",
      description: "İhanet, sezgi ve takım oyununa dayalı sosyal çıkarım oyunu.",
      minPlayers: 4,
      maxPlayers: 16,
      isActive: true
    },
    create: {
      name: "Vampir Köylü",
      slug: "vampire-village",
      description: "İhanet, sezgi ve takım oyununa dayalı sosyal çıkarım oyunu.",
      minPlayers: 4,
      maxPlayers: 16,
      isActive: true
    }
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
