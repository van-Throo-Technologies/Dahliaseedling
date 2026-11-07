import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { PUBLIC_ACTIONS } from "./public-surface";

/*
 * Fail-closed inventory. Every exported server action in a server-action module is either one of the public journey's actions, which must
 * not carry the guard, or it must call the guard as its first statement. A new action without the guard fails this test, so the default is
 * refusal on the public surface.
 */

function serverActionFiles(): string[] {
  return execSync("grep -rl '\"use server\"' src", { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter((file) => file.length > 0 && !file.endsWith(".test.ts"));
}

function exportedActions(file: string) {
  const text = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  return sourceFile.statements.flatMap((statement) => {
    if (!ts.isFunctionDeclaration(statement) || !statement.name || !statement.body) return [];
    const exported = (statement.modifiers ?? []).some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) return [];
    const first = statement.body.statements[0];
    const guarded =
      first !== undefined &&
      ts.isExpressionStatement(first) &&
      ts.isCallExpression(first.expression) &&
      ts.isIdentifier(first.expression.expression) &&
      first.expression.expression.text === "refuseOnPublicSurface";
    return [{ name: statement.name.text, guarded }];
  });
}

describe("the public action guard covers every server action", () => {
  const actions = serverActionFiles().flatMap((file) =>
    exportedActions(file).map((a) => ({ file, ...a })),
  );

  it("inventories the expected number of actions", () => {
    expect(actions.length).toBe(64);
  });

  it("permits exactly the five journey actions, and each of them is unguarded", () => {
    const permitted = actions.filter((a) => PUBLIC_ACTIONS.includes(a.name));
    expect(permitted.map((a) => a.name).sort()).toEqual([...PUBLIC_ACTIONS].sort());
    for (const action of permitted) expect(action.guarded, action.name).toBe(false);
  });

  it("guards every other action as its first statement", () => {
    for (const action of actions.filter((a) => !PUBLIC_ACTIONS.includes(a.name))) {
      expect(action.guarded, `${action.file} ${action.name}`).toBe(true);
    }
  });
});
