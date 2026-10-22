"use client";

import { useEffect, useState } from "react";
import { modelAvailable } from "./client";

/** "model" when the server has a language model configured, "local" otherwise, null while checking. */
export function useModelStatus(): "model" | "local" | null {
  const [status, setStatus] = useState<"model" | "local" | null>(null);
  useEffect(() => {
    let alive = true;
    void modelAvailable().then((ok) => alive && setStatus(ok ? "model" : "local"));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
