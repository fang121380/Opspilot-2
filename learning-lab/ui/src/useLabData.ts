import { useEffect, useRef, useState } from "react";
import { fetchLabQuery, type LabQuery } from "./api";
import { parseEvents, parseNodes, parseResources } from "./resources";

export type Channel = {
  output: string | null;
  updatedAt: string | null;
  loading: boolean;
  error: string | null;
};
export type LabData = Record<LabQuery, Channel>;
const queries: LabQuery[] = ["resources", "events", "logs", "nodes"];
const blank: Channel = {
  output: null,
  updatedAt: null,
  loading: false,
  error: null,
};

export function useLabData() {
  const [data, setData] = useState<LabData>({
    resources: { ...blank },
    events: { ...blank },
    logs: { ...blank },
    nodes: { ...blank },
  });
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  const refresh = async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setData(
      (current) =>
        Object.fromEntries(
          queries.map((query) => [
            query,
            { ...current[query], loading: true, error: null },
          ]),
        ) as LabData,
    );
    await Promise.allSettled(
      queries.map(async (query) => {
        try {
          const output = await fetchLabQuery(query, controller.signal);
          if (query === "resources") parseResources(output);
          if (query === "events") parseEvents(output);
          if (query === "nodes") parseNodes(output);
          if (controller.signal.aborted) return;
          setData((current) => ({
            ...current,
            [query]: {
              output,
              updatedAt: new Date().toISOString(),
              loading: false,
              error: null,
            },
          }));
        } catch (error) {
          if (controller.signal.aborted) return;
          setData((current) => ({
            ...current,
            [query]: {
              ...current[query],
              loading: false,
              error:
                error instanceof Error ? error.message : "读取失败，请重试。",
            },
          }));
        }
      }),
    );
    if (active.current === controller) active.current = null;
  };
  return {
    data,
    refresh,
    loading: queries.some((query) => data[query].loading),
  };
}
