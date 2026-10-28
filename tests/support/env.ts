import { config } from "dotenv";

// Always point tests at the dedicated test database, never the development one.
config({ path: ".env.test", override: true, quiet: true });
