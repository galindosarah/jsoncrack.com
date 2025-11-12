import { create } from "zustand";
import useGraph from "../features/editor/views/GraphView/stores/useGraph";
import useFile from "./useFile";

interface JsonActions {
  setJson: (json: string) => void;
  getJson: () => string;
  clear: () => void;
}

const initialStates = {
  json: "{}",
  loading: true,
};

export type JsonStates = typeof initialStates;

const useJson = create<JsonStates & JsonActions>()((set, get) => ({
  ...initialStates,
  getJson: () => get().json,
  setJson: json => {
    set({ json, loading: false });
    // update the editor contents so left-side editor stays in sync
    // set directly to avoid triggering the editor's parsing loop
    try {
      useFile.setState({ contents: json, hasChanges: false });
    } catch (e) {
      // ignore if useFile not available
    }
    useGraph.getState().setGraph(json);
  },
  clear: () => {
    set({ json: "", loading: false });
    useGraph.getState().clearGraph();
  },
}));

export default useJson;
