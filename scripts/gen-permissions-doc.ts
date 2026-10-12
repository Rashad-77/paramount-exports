/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { renderPermissionMatrix } from "../src/lib/auth/permissions";

export const START = "<!-- PERMISSION_MATRIX:START (generated from src/lib/auth/permissions.ts — do not edit by hand) -->";
export const END = "<!-- PERMISSION_MATRIX:END -->";

const file = path.join(process.cwd(), "docs", "ROLE_PERMISSIONS.md");
const doc = fs.readFileSync(file, "utf8");
const s = doc.indexOf("<!-- PERMISSION_MATRIX:START");
const e = doc.indexOf(END);
if (s === -1 || e === -1) {
  console.error("Markers not found in docs/ROLE_PERMISSIONS.md");
  process.exit(1);
}
const next = `${doc.slice(0, s)}${START}\n${renderPermissionMatrix()}\n${doc.slice(e)}`;
fs.writeFileSync(file, next);
console.log("docs/ROLE_PERMISSIONS.md matrix regenerated.");
