import { prisma } from "./lib/prisma.js";
import bcrypt from "bcrypt";

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  let user1 = await prisma.user.findFirst({
    where: {
      profile: {
        username: "user1"
      }
    }
  });

  if (user1) {
    await prisma.user.update({
      where: { id: user1.id },
      data: { passwordHash }
    });
  } else {
    user1 = await prisma.user.create({
      data: {
        email: "user1@example.com",
        passwordHash,
        profile: {
          create: {
            username: "user1",
            displayName: "User One",
            status: "ONLINE"
          }
        },
        settings: {
          create: {}
        }
      }
    });
  }
  console.log("Upserted user1:", "user1");
  await prisma.$disconnect();
}

main().catch(console.error);
