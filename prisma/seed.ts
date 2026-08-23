import { PrismaClient } from "@prisma/client";
import { eseguiSeed } from "../src/lib/setup/seed";

const prisma = new PrismaClient();

eseguiSeed(prisma)
  .then(({ log, emailAdmin }) => {
    log.forEach((riga) => console.log(`[seed] ${riga}`));
    console.log(`[seed] login: ${emailAdmin} / ${process.env.SEED_ADMIN_PASSWORD ?? "molo4punto0!"}`);
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
