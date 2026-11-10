import { cookies } from "next/headers";

/** True once after Refresh. The cookie is cleared so the next open can use the short cache. */
export async function consumeFresh(): Promise<boolean> {
  const jar = await cookies();
  if (jar.get("mia_fresh")?.value !== "1") return false;
  jar.delete("mia_fresh");
  return true;
}
