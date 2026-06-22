const targets = [
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3000/admin/materials",
  "http://127.0.0.1:3000/admin/products",
  "http://127.0.0.1:3000/partner",
  "http://127.0.0.1:8787/health",
  "http://127.0.0.1:8787/materials?limit=1"
];

let hasFailure = false;

for (const target of targets) {
  try {
    const response = await fetch(target);
    if (!response.ok) {
      hasFailure = true;
      console.error(`${target} -> ${response.status}`);
      continue;
    }
    console.log(`${target} -> ${response.status}`);
  } catch (error) {
    hasFailure = true;
    console.error(`${target} -> ${error instanceof Error ? error.message : "failed"}`);
  }
}

if (hasFailure) {
  process.exit(1);
}
