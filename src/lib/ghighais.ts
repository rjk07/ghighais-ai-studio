export type DatabaseOption = {
  id: string;
  name: string;
  hint: string;
  recommended?: boolean;
};

export const DATABASES: DatabaseOption[] = [
  { id: "turso", name: "Turso", hint: "Token Turso (libSQL auth token)", recommended: true },
  { id: "supabase", name: "Supabase", hint: "Service / anon key project", recommended: true },
  { id: "neon", name: "Neon", hint: "Connection string / API key" },
  { id: "planetscale", name: "PlanetScale", hint: "Database password / token" },
  { id: "firebase", name: "Firebase", hint: "Web API key" },
  { id: "mongodb", name: "MongoDB Atlas", hint: "Connection URI" },
  { id: "postgres", name: "PostgreSQL", hint: "postgres://user:pass@host/db" },
  { id: "mysql", name: "MySQL", hint: "mysql://user:pass@host/db" },
  { id: "redis", name: "Redis / Upstash", hint: "REST token" },
  { id: "xata", name: "Xata", hint: "API key" },
  { id: "cockroach", name: "CockroachDB", hint: "Connection string" },
];

export const STARTER_CODE = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GHIGHAIS AI</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#0b1020;color:#e6f1ff;
       display:grid;place-items:center;min-height:100vh;text-align:center}
  h1{font-size:clamp(28px,6vw,54px);margin:0 0 12px}
  p{opacity:.7;margin:0}
</style>
</head>
<body>
  <main>
    <h1>Halo, saya GHIGHAIS AI</h1>
    <p>Tulis instruksi di kotak prompt untuk mulai membuat aplikasi.</p>
  </main>
</body>
</html>`;

export function stripFences(text: string) {
  let out = text.trim();
  out = out.replace(/^```[a-zA-Z]*\s*/, "");
  out = out.replace(/```\s*$/, "");
  return out.trim();
}
