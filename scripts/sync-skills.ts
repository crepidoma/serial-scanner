// .agents/skills を正本として、Claude Code向けの .claude/skills に参照用のSKILL.mdを作る。
// 使い方: node scripts/sync-skills.ts [--check]
// --check では書き換えず、内容がずれていれば失敗する（CIで使う）。
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const source = ".agents/skills";
const target = ".claude/skills";
const check = process.argv.includes("--check");

function frontmatter(text: string, key: string): string {
  const match = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(text);
  if (!match?.[1]) throw new Error(`${key} がありません`);
  return match[1].trim();
}

function pointer(name: string, description: string): string {
  const path = `../../../${source}/${name}/SKILL.md`;
  return [
    "---",
    `name: ${name}`,
    `description: ${description}`,
    "---",
    "",
    `本文は [${source}/${name}/SKILL.md](${path}) にある。読んでから、その手順に従う。`,
    "",
  ].join("\n");
}

const names = readdirSync(source, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const problems: string[] = [];

for (const name of names) {
  const text = readFileSync(join(source, name, "SKILL.md"), "utf8");
  const expected = pointer(frontmatter(text, "name"), frontmatter(text, "description"));
  const file = join(target, name, "SKILL.md");
  const actual = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (actual === expected) continue;
  if (check) problems.push(`${file} が ${source}/${name} と一致しません`);
  else {
    mkdirSync(join(target, name), { recursive: true });
    writeFileSync(file, expected);
  }
}

for (const entry of existsSync(target) ? readdirSync(target) : []) {
  if (names.includes(entry)) continue;
  if (check) problems.push(`${join(target, entry)} に対応する正本がありません`);
  else rmSync(join(target, entry), { recursive: true });
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error("node scripts/sync-skills.ts で作り直してください");
  process.exit(1);
}
