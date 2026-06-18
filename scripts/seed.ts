import { sqlRun } from "../src/lib/db";
import { seedCampaign } from "../src/lib/seed";

await sqlRun(`UPDATE campaigns SET status = 'archived' WHERE status = 'active'`);

const id = await seedCampaign();
console.log(`Seeded campaign: ${id}`);
