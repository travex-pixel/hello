import "server-only";

export type HumanBackend = "none" | "memory";

/**
 * Real-people mode is off unless the deployment opts in. "memory" is a
 * single-process test store for trying the flow locally with a few browsers;
 * it is not persistent and not for production. See docs/HUMAN_MODE.md.
 */
export function humanBackend(): HumanBackend {
  return process.env.HELLO_HUMAN_MODE === "memory" ? "memory" : "none";
}

export function humanModeEnabled(): boolean {
  return humanBackend() !== "none";
}
