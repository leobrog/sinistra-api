import { join } from "node:path";

const run = async () => {
  const envPath = join(process.cwd(), ".env");
  const examplePath = join(process.cwd(), ".env.example");

  const envFile = Bun.file(envPath);

  if (!(await envFile.exists())) {
    console.error(".env file not found at", envPath);
    process.exit(1);
  }

  const content = await envFile.text();
  const lines = content.split("\n");

  const exampleLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return line;
    }

    const firstEqual = line.indexOf("=");
    if (firstEqual === -1) {
      return line;
    }

    const key = line.substring(0, firstEqual);
    return `${key}=`;
  });

  await Bun.write(examplePath, exampleLines.join("\n"));
  console.log("Created .env.example");
};

run();

