import { prisma } from "./lib/prisma.js";
import bcrypt from "bcrypt";

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  const user1 = await prisma.user.upsert({
    where: { username: "user1" },
    update: { passwordHash },
    create: {
      username: "user1",
      displayName: "User One",
      email: "user1@example.com",
      passwordHash,
      status: "ONLINE"
    }
  });
  console.log("Upserted user1:", user1.username);
  await prisma.$disconnect();
}

main().catch(console.error);
