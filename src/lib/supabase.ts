import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  "https://oyrtozixzntcdgcqsfpo.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_B2t15bqMR9Frk97Me8W4ew_Zq1pMubp";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

export { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };
