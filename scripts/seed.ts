import { getDb } from "../src/lib/db";
import { seedCampaign } from "../src/lib/seed";

const db = getDb();
db.prepare(`UPDATE campaigns SET status = 'archived' WHERE status = 'active'`).run();

const id = seedCampaign();
console.log(`Seeded campaign: ${id}`);
