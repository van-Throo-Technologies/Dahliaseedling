import { installIntakeKey } from "./invitation-intake";

// Before the browser tests, the local database holds the intake key the test server was started with.
export default async function globalSetup(): Promise<void> {
  await installIntakeKey();
}
