import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveProjectRoot() {
  let current = __dirname;
  const root = path.parse(current).root;

  while (current !== root) {
    const pkgPath = path.join(current, "package.json");
    if (existsSync(pkgPath)) {
      return current;
    }

    current = path.dirname(current);
  }

  return process.cwd();
}

export const projectRoot = resolveProjectRoot();
export const dataDir = path.join(projectRoot, "data");
export const runtimeStatePath = path.join(dataDir, "runtime.json");

export async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

export async function writeTextFile(fileName: string, content: string) {
  await fs.writeFile(path.join(projectRoot, fileName), content, "utf8");
}

export async function readDataJson<T>(
  fileName: string,
  fallback: T,
): Promise<T> {
  await ensureDataDir();
  const filePath = path.join(dataDir, fileName);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeDataJson(fileName: string, value: unknown) {
  await ensureDataDir();
  const filePath = path.join(dataDir, fileName);
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}
