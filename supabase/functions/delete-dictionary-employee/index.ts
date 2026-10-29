import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createDeleteEmployeeHandler } from "./handler.mjs";

Deno.serve(createDeleteEmployeeHandler({
  createClient,
  getEnv: (name) => Deno.env.get(name)
}));
