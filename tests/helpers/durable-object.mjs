import { registerHooks } from "node:module";

const durableObjectModule = "data:text/javascript," + encodeURIComponent(
  "export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }"
);

registerHooks({
  resolve(specifier, context, nextResolve) {
    return specifier === "cloudflare:workers"
      ? { url: durableObjectModule, shortCircuit: true }
      : nextResolve(specifier, context);
  },
});

export function memoryStorage() {
  const records = new Map();
  let alarm = null;
  return {
    records,
    async get(key) { return structuredClone(records.get(key)); },
    async put(key, value) { records.set(key, structuredClone(value)); },
    async delete(key) { return records.delete(key); },
    async deleteAll() { records.clear(); },
    async getAlarm() { return alarm; },
    async setAlarm(value) { alarm = value; },
    async list({ prefix = "" } = {}) {
      return new Map([...records].filter(([key]) => key.startsWith(prefix)));
    },
    async transaction(callback) { return callback(this); },
  };
}
