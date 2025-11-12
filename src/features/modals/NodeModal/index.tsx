import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import useJson from "../../../store/useJson";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const json = useJson(state => state.getJson)();
  const setJson = useJson(state => state.setJson);

  const [editing, setEditing] = React.useState(false);
  const [editorValue, setEditorValue] = React.useState<string>("{}");

  React.useEffect(() => {
    if (nodeData && !editing) {
      setEditorValue(normalizeNodeData(nodeData.text ?? []));
    }
  }, [nodeData, editing]);

  const setValueAtPath = (base: any, path: NodeData["path"] | undefined, value: any) => {
    if (!path || path.length === 0) return value;

    // clone base to avoid mutating original reference
    const obj = JSON.parse(JSON.stringify(base || {}));
    let cur: any = obj;
    for (let i = 0; i < path.length; i++) {
      const seg = path[i] as string | number;
      const isLast = i === path.length - 1;
      if (isLast) {
        cur[seg as any] = value;
      } else {
        if (cur[seg as any] === undefined) {
          // create object for next segment (assume object)
          cur[seg as any] = typeof path[i + 1] === "number" ? [] : {};
        }
        cur = cur[seg as any];
      }
    }
    return obj;
  };

  const getValueAtPath = (base: any, path: NodeData["path"] | undefined) => {
    if (!path || path.length === 0) return base;
    let cur = base;
    for (let i = 0; i < path.length; i++) {
      if (cur === undefined || cur === null) return undefined;
      cur = cur[path[i] as any];
    }
    return cur;
  };

  const deepMerge = (target: any, source: any) => {
    if (typeof target !== "object" || target === null) return source;
    if (typeof source !== "object" || source === null) return source;

    const out = Array.isArray(target) ? [...target] : { ...target };
    Object.keys(source).forEach(key => {
      const s = source[key];
      const t = out[key];
      if (Array.isArray(s)) {
        out[key] = s;
      } else if (typeof s === "object" && s !== null && typeof t === "object" && t !== null) {
        out[key] = deepMerge(t, s);
      } else {
        out[key] = s;
      }
    });
    return out;
  };

  const handleSave = () => {
    try {
      const parsed = JSON.parse(editorValue);
      const base = json ? JSON.parse(json) : {};
      const existing = getValueAtPath(base, nodeData?.path);
      let updatedRoot;

      if (
        existing !== undefined &&
        existing !== null &&
        typeof existing === "object" &&
        !Array.isArray(existing) &&
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        const merged = deepMerge(existing, parsed);
        updatedRoot = setValueAtPath(base, nodeData?.path, merged);
      } else {
        // scalar or arrays or no existing value: replace
        updatedRoot = setValueAtPath(base, nodeData?.path, parsed);
      }
      setJson(JSON.stringify(updatedRoot, null, 2));
      setEditing(false);
      if (onClose) onClose();
    } catch (err) {
      // parsing error - keep editing and surface error via textarea
      // Simple UX: append comment to textarea (Mantine Textarea doesn't support validation easily here)
      // Leave it to user to fix JSON
      // Could add a toast in future.
      // For now just rethrow to surface during development
      console.error("Failed to parse JSON:", err);
    }
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Flex gap="xs" align="center">
              {!editing && (
                <Button size="xs" variant="default" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
              {editing && (
                <>
                  <Button size="xs" color="green" onClick={handleSave}>
                    Save
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </>
              )}
              <CloseButton onClick={onClose} />
            </Flex>
          </Flex>
          <ScrollArea.Autosize mah={250} maw={600}>
            {!editing ? (
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            ) : (
              <Textarea
                value={editorValue}
                onChange={e => setEditorValue(e.currentTarget.value)}
                minRows={4}
                autosize
                styles={{ input: { fontFamily: "monospace" } }}
              />
            )}
          </ScrollArea.Autosize>
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
