const BASE_URL = import.meta.env.VITE_BACKEND_URL || '';

export async function fetchLineageGraph() {
  const res = await fetch(`${BASE_URL}/api/lineage/graph`);
  if (!res.ok) throw new Error(`Failed to fetch lineage graph: ${res.statusText}`);
  return res.json();
}

export async function fetchDatabases() {
  const res = await fetch(`${BASE_URL}/api/databases`);
  if (!res.ok) throw new Error(`Failed to fetch databases: ${res.statusText}`);
  return res.json();
}

export async function testDatabase(dbConfig) {
  const res = await fetch(`${BASE_URL}/api/databases/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dbConfig)
  });
  if (!res.ok) throw new Error(`Failed to test connection: ${res.statusText}`);
  return res.json();
}

export async function addDatabase(dbConfig) {
  const res = await fetch(`${BASE_URL}/api/databases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dbConfig)
  });
  if (!res.ok) throw new Error(`Failed to add database: ${res.statusText}`);
  return res.json();
}

export async function deleteDatabase(name) {
  const res = await fetch(`${BASE_URL}/api/databases/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(`Failed to delete database: ${res.statusText}`);
  return res.json();
}

export async function fetchHbaRules() {
  const res = await fetch(`${BASE_URL}/api/lineage/hba`);
  if (!res.ok) throw new Error(`Failed to fetch HBA rules: ${res.statusText}`);
  return res.json();
}

export async function fetchForeignServers() {
  const res = await fetch(`${BASE_URL}/api/lineage/servers`);
  if (!res.ok) throw new Error(`Failed to fetch foreign servers: ${res.statusText}`);
  return res.json();
}
