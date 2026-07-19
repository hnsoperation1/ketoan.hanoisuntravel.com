import { readFileSync } from "fs";
import { join } from "path";

export const contentType = "image/png";
export const size = { width: 16, height: 16 };

export default function Icon() {
  const buf = readFileSync(join(process.cwd(), "public", "logo-hns-sun.png"));
  return new Response(buf, { headers: { "Content-Type": "image/png" } });
}
