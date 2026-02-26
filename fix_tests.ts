import { Project, SyntaxKind } from "ts-morph";

const project = new Project();
project.addSourceFilesAtPaths(["src/**/*.test.ts"]);

const files = project.getSourceFiles();

for (const sourceFile of files) {
  // Find ClientLayer definition
  const varDecls = sourceFile.getVariableDeclarations();
  for (const varDecl of varDecls) {
    if (varDecl.getName() === "ClientLayer") {
      const initializer = varDecl.getInitializer();
      if (initializer && initializer.getKind() === SyntaxKind.CallExpression) {
        // Change createClient to new SQL
        initializer.replaceWithText(`Layer.effect(
  PgClient,
  Effect.gen(function* () {
    const client = new SQL("postgres://postgres:password@localhost:5432/sinistra");
    return PgClient.of(client);
  })
)`);
      }
    }
  }

  // Remove `import { createClient } from "@libsql/client"` if exists
  const imports = sourceFile.getImportDeclarations();
  for (const imp of imports) {
    if (imp.getModuleSpecifierValue() === "@libsql/client") {
      imp.remove();
    }
  }
}

project.saveSync();
