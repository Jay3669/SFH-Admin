import { useSyncExternalStore } from "react";
import {
  getApiLoadingSnapshot,
  subscribeToApiLoading,
} from "../utils/apiLoadingStore";

export default function useApiLoader() {
  return useSyncExternalStore(
    subscribeToApiLoading,
    getApiLoadingSnapshot,
    getApiLoadingSnapshot
  );
}