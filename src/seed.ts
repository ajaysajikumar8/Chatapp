import { prisma } from "./lib/prisma.js";
import bcrypt from "bcrypt";

async function main() {
  console.log("Seeding database...");

  // Find user1
  const user1 = await prisma.user.findUnique({
    where: { username: "user1" }
  });

  if (!user1) {
    console.error("user1 not found! Register user1 first.");
    return;
  }

  // Create user2 if not exists
  let user2 = await prisma.user.findUnique({
    where: { username: "user2" }
  });

  if (!user2) {
    const passwordHash = await bcrypt.hash("password123", 10);
    user2 = await prisma.user.create({
      data: {
        username: "user2",
        displayName: "User Two",
        email: "user2@example.com",
        passwordHash,
        status: "ONLINE"
      }
    });
    console.log("Created user2");
  } else {
    console.log("user2 already exists");
  }

  // Find or create conversation between user1 and user2
  let conversation = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: user1.id } } },
        { participants: { some: { userId: user2.id } } }
      ]
    }
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: user1.id },
            { userId: user2.id }
          ]
        }
      }
    });
    console.log("Created conversation");
  } else {
    console.log("Conversation already exists");
  }

  // Clear existing messages to start fresh
  await prisma.message.deleteMany({
    where: { conversationId: conversation.id }
  });

  // Create 60 messages
  const now = new Date();
  const messagesData = [];
  for (let i = 1; i <= 60; i++) {
    // Alternate senders
    const senderId = i % 2 === 0 ? user1.id : user2.id;
    // Create slightly different times
    const createdAt = new Date(now.getTime() - (60 - i) * 60 * 1000); // 1 hour intervals
    messagesData.push({
      conversationId: conversation.id,
      senderId,
      content: `Message #${i} in the conversation from ${i % 2 === 0 ? "User One" : "User Two"}. This is some dummy text to populate the chat area.`,
      createdAt
    });
  }

  await prisma.message.createMany({
    data: messagesData
  });

  console.log(`Created 60 messages in conversation ${conversation.id}`);

  // Update conversation participant lastReadAt to be older so we have unread messages
  // Let's set User One's lastReadAt to be before the last 5 messages
  const lastMessages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 6
  });

  if (lastMessages.length >= 6) {
    const sixthLastMessageTime = lastMessages[5].createdAt;
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: user1.id
        }
      },
      data: {
        lastReadAt: sixthLastMessageTime
      }
    });
    console.log("Set user1 lastReadAt to have unread messages.");
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
