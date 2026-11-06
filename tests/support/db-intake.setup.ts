import { beforeAll } from "vitest";
import { installIntakeKey } from "./invitation-intake";

// Every database test file starts with this process's intake key in the local database.
beforeAll(async () => {
  await installIntakeKey();
}, 30_000);
