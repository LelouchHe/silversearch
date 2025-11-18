#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
/// <reference lib="deno.ns" />

const command = new Deno.Command("git", {
  args: ["describe", "--tags", "--exact-match", "HEAD", "--exclude", "edge"],
  stdout: "piped",
  stderr: "piped",
});

let version: string;

try {
  const { code, stdout } = await command.output();
  if (code === 0) {
    version = new TextDecoder().decode(stdout).trim();
  } else {
    throw new Error("No exact tag match");
  }
} catch {
  // Fallback to short commit hash
  const fallbackCommand = new Deno.Command("git", {
    args: ["rev-parse", "--short", "HEAD"],
    stdout: "piped",
  });
  const { stdout } = await fallbackCommand.output();
  version = new TextDecoder().decode(stdout).trim();
}

console.log(`Building the version file with version: ${version}`);

const content = `export const version = "${version}";\n`;
await Deno.writeTextFile("./dist/version.ts", content);