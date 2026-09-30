// Reset the MythicalMind workspace to a clean first-run state
// (keeps schema + settings, clears all test data).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.activityEvent.deleteMany({});
  await db.generation.deleteMany({});
  await db.message.deleteMany({});
  await db.conversation.deleteMany({});
  await db.model.deleteMany({});
  await db.provider.deleteMany({});
  await db.agent.deleteMany({});
  await db.segment.deleteMany({});
  await db.rundown.deleteMany({});
  console.log("workspace reset — clean first-run state");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
