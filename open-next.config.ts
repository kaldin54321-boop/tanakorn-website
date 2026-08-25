import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // No special config needed for Winlator Frost
  // News stays on Supabase, Releases use local /data or R2 via external_url
});
