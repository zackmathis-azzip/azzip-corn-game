#!/usr/bin/env node
// Reaps whatever's on the dev port before startup — self-healing for orphaned
// process trees (e.g. Switchboard closed abnormally). Honors Switchboard's
// PORT env override; falls back to this project's conventional default
// (passed as argv[2]).
import { execSync } from "node:child_process";

const port = process.env.PORT || process.argv[2];
try {
  execSync(`npx --yes kill-port ${port}`, { stdio: "inherit" });
} catch {
  // best-effort; a stubborn or already-free port shouldn't block startup
}
