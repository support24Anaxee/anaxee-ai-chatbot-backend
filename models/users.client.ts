import { mysqlTable, bigint, varchar, text, timestamp, int } from "drizzle-orm/mysql-core";
import { clientSchema } from "./client.schema";

export const usersClient = clientSchema.table("users", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }),
  email: varchar("email", { length: 255 }),
  role: varchar("role", { length: 45 }),
  logoUrl: text("logo_url"),
  lastLogin: timestamp("last_login").defaultNow().onUpdateNow(),
  organizationId: int("organization_id")
});
