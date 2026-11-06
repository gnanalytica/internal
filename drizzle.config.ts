import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // The Chat SDK's state tables (src/db/add-slack.ts) aren't in schema.ts;
  // without this, `db:push` would offer to drop them.
  tablesFilter: ["!chat_state_*"],
  verbose: true,
  strict: true,
});
