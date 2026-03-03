import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fileDir = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(fileDir, "../../../../.env");

dotenv.config();
dotenv.config({ path: rootEnvPath });
