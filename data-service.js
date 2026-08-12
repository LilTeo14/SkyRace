import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("TU-PROYECTO") &&
  !supabaseAnonKey.includes("TU_CLAVE")
);

const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } }
    })
  : null;

function ensureSuccess(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}

export async function loadRemoteData() {
  if (!supabase) return null;

  const [pilotsResult, runsResult] = await Promise.all([
    supabase.from("pilots").select("id,name,drone").order("created_at", { ascending: true }),
    supabase.from("runs").select("id,pilot_id,splits,total,created_at").order("created_at", { ascending: false })
  ]);

  const pilots = ensureSuccess(pilotsResult, "No se pudieron cargar los pilotos");
  const remoteRuns = ensureSuccess(runsResult, "No se pudieron cargar los tiempos");

  return {
    pilots,
    runs: remoteRuns.map((run) => ({
      id: run.id,
      pilotId: run.pilot_id,
      splits: run.splits,
      total: run.total,
      createdAt: new Date(run.created_at).getTime()
    }))
  };
}

export async function saveRemotePilot(pilot) {
  if (!supabase) return;
  ensureSuccess(
    await supabase.from("pilots").insert({ id: pilot.id, name: pilot.name, drone: pilot.drone }),
    "No se pudo guardar el piloto"
  );
}

export async function saveRemoteRun(run) {
  if (!supabase) return;
  ensureSuccess(
    await supabase.from("runs").insert({
      id: run.id,
      pilot_id: run.pilotId,
      splits: run.splits,
      total: run.total,
      created_at: new Date(run.createdAt).toISOString()
    }),
    "No se pudo guardar el tiempo"
  );
}

export async function clearRemoteRuns() {
  if (!supabase) return;
  ensureSuccess(
    await supabase.from("runs").delete().gte("created_at", "1970-01-01T00:00:00.000Z"),
    "No se pudieron borrar los resultados"
  );
}

export function subscribeToRemoteChanges(onChange) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel("skyrace-live-results")
    .on("postgres_changes", { event: "*", schema: "public", table: "pilots" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, onChange)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
