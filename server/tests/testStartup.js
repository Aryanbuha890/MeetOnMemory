import assert from "assert";

console.log("🧪 Testing server modules load and startup compatibility...");

// Force Redis disabled for deterministic mock testing
delete process.env.REDIS_URI;
delete process.env.REDIS_URL;

// Verify that queueService, webhookDispatcherService can be imported without connecting to Redis immediately
const queueService = await import("../services/queueService.js");
const webhookDispatcherService =
  await import("../services/webhookDispatcherService.js");
const embeddingUtils = await import("../utils/embeddingUtils.js"); // eslint-disable-line no-unused-vars

assert.ok(queueService.aiQueue, "aiQueue should be exported");
assert.ok(queueService.dataExportQueue, "dataExportQueue should be exported");
assert.ok(
  webhookDispatcherService.webhookQueue,
  "webhookQueue should be exported",
);

console.log(
  "✅ All service modules imported successfully without executing eager Redis socket connections.",
);

// Deeply nested modules might call dotenv.config(), repopulating env vars.
// Clear them again right before assertion to guarantee deterministic mock state.
delete process.env.REDIS_URI;
delete process.env.REDIS_URL;

// Verify that all wrappers return null and are marked inactive when Redis is disabled
assert.strictEqual(
  queueService.aiQueue.isActive,
  false,
  "aiQueue should be inactive when Redis is disabled",
);
assert.strictEqual(
  queueService.dataExportQueue.isActive,
  false,
  "dataExportQueue should be inactive when Redis is disabled",
);
assert.strictEqual(
  webhookDispatcherService.webhookQueue.isActive,
  false,
  "webhookQueue should be inactive when Redis is disabled",
);

console.log(
  "✅ All wrappers report isActive as false under unconfigured Redis.",
);

// Test that calling `add` doesn't crash when Redis is disabled/not configured
try {
  const aiRes = await queueService.aiQueue.add("test-job", { data: 1 });
  const exportRes = await queueService.dataExportQueue.add("test-job", {
    data: 1,
  });
  const webhookRes = await webhookDispatcherService.webhookQueue.add(
    "test-job",
    { data: 1 },
  );

  assert.strictEqual(
    aiRes,
    null,
    "aiQueue.add should return null when Redis is unconfigured",
  );
  assert.strictEqual(
    exportRes,
    null,
    "dataExportQueue.add should return null when Redis is unconfigured",
  );
  assert.strictEqual(
    webhookRes,
    null,
    "webhookQueue.add should return null when Redis is unconfigured",
  );

  console.log("✅ Safe wrapper queue no-op operations verified successfully!");
} catch (err) {
  assert.fail(`Queue operations threw an unexpected error: ${err.message}`);
}

// ---------------------------------------------------------------------------
// Composed router graph (Issue #2575)
//
// Everything above imports individual services. Nothing imported
// `routes/index.js`, which is what `server.js` actually loads — so five route
// files reached `main` importing names their controllers do not export, and a
// sixth reached for an ESM-only package through `createRequire`. Each one made
// `node server.js` exit at import time with the API completely down, and none
// of them were visible to a test that only touches services.
//
// Importing the composed router here is cheap (no listener, no database) and
// turns "does the process boot?" into something CI answers on every run.
// ---------------------------------------------------------------------------
const routesModule = await import("../routes/index.js");
const router = routesModule.default;

assert.ok(router, "routes/index.js should export a router");
assert.strictEqual(
  typeof router,
  "function",
  "routes/index.js should export an Express router (a function)",
);
assert.ok(
  Array.isArray(router.stack) && router.stack.length > 0,
  "the composed router should have registered layers",
);

// A layer whose handler is `undefined` is what a bad named import produces
// once Express stops throwing on it. Assert every mounted layer is callable.
for (const layer of router.stack) {
  assert.strictEqual(
    typeof layer.handle,
    "function",
    `route layer ${layer.name || "(anonymous)"} has a non-function handler`,
  );
}

console.log(
  `✅ Composed router graph imported cleanly (${router.stack.length} layers, all handlers callable).`,
);

console.log("\n🎉 ALL STARTUP OPTIMIZATION VERIFICATIONS PASSED!\n");
