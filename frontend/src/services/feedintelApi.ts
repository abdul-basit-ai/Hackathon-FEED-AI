import { mockFeedintelApi } from "./mockFeedintelApi";
import { httpFeedintelApi } from "./httpFeedintelApi";
import type { FeedIntelApi } from "@/types/analysis";

/** Demo is explicit: a missing or failed live connection never returns fixtures. */
export const feedintelApi: FeedIntelApi = import.meta.env["VITE_FEEDINTEL_MODE"] === "demo" ? mockFeedintelApi : httpFeedintelApi;
export const isDemoMode = feedintelApi.mode === "mock";
