import { useEffect, useMemo, useState } from "react";

function safeParseJSON(str) {
  if (typeof str !== "string") return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function deepUnstringify(value) {
  if (Array.isArray(value)) {
    return value.map(deepUnstringify);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = deepUnstringify(val);
    }
    return out;
  }
  if (typeof value === "string") {
    const parsed = safeParseJSON(value);
    return parsed !== null ? deepUnstringify(parsed) : value;
  }
  return value;
}

function ValueSpan({ v }) {
  if (v === null) return <span className="tree-null">null</span>;
  switch (typeof v) {
    case "string":
      return <span className="tree-string">{JSON.stringify(v)}</span>;
    case "number":
      return <span className="tree-number">{String(v)}</span>;
    case "boolean":
      return <span className="tree-boolean">{String(v)}</span>;
    default:
      return <span className="tree-value">{JSON.stringify(v)}</span>;
  }
}

function TreeNode({ k, v, depth = 0 }) {
  const [open, setOpen] = useState(true);
  const isObj = v && typeof v === "object";
  const isArr = Array.isArray(v);

  if (!isObj) {
    return (
      <div className="tree-row" style={{ paddingLeft: depth * 14 }}>
        {k !== undefined && <span className="tree-key">{k}:</span>}
        <ValueSpan v={v} />
      </div>
    );
  }

  const entries = isArr ? v.map((item, idx) => [idx, item]) : Object.entries(v);
  const count = entries.length;

  return (
    <div className="tree-group" style={{ paddingLeft: depth * 14 }}>
      <div className="tree-header">
        <button className="tree-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? "▼" : "▶"}
        </button>
        {k !== undefined && <span className="tree-key">{k}:</span>}
        <span className="tree-type">{isArr ? `[${count}]` : `{${count}}`}</span>
      </div>
      {open && (
        <div className="tree-children">
          {entries.map(([ck, cv]) => (
            <TreeNode key={ck} k={ck} v={cv} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeView({ data }) {
  return (
    <div className="tree">
      <TreeNode v={data} depth={0} />
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState(`{\n  \"action\": \"EDIT\",\n  \"data\": \"{\\\"id\\\":\\\"833621db-4c32-445f-ab6b-hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh3aabd163bff4\\\",\\\"name\\\":\\\"IS-NONOP\\\",\\\"rows\\\":[{\\\"id\\\":\\\"6278aa36-ef82-4eab-98de-39bdf002aa9a\\\",\\\"type\\\":\\\"ROW\\\"}]}\"\n}`);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState("raw"); // 'raw' | 'tree'

  const result = useMemo(() => {
    try {
      const parsed = JSON.parse(input);
      const transformed = deepUnstringify(parsed);
      setError("");
      return { data: transformed, text: JSON.stringify(transformed, null, 2) };
    } catch (e) {
      const maybe = safeParseJSON(input);
      if (maybe !== null) {
        const transformed = deepUnstringify(maybe);
        setError("");
        return { data: transformed, text: JSON.stringify(transformed, null, 2) };
      }
      setError(e.message || "Invalid JSON");
      return { data: null, text: "" };
    }
  }, [input]);

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 1200);
      return () => clearTimeout(t);
    }
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="title">JSON Formatter</div>
        <div className="subtitle">Auto unstringifies nested JSON in <code>data</code> and formats</div>
      </header>

      {error && <div className="error">Parse error: {error}</div>}

      <div className="panes">
        <div className="pane">
          <div className="pane-header">Input</div>
          <textarea
            className="editor"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder="Paste JSON here"
          />
        </div>
        <div className="pane">
          <div className="pane-header right">
            <span>Formatted Output</span>
            <div className="spacer" />
            <div className="segmented">
              <button className={view === "raw" ? "seg active" : "seg"} onClick={() => setView("raw")}>Raw</button>
              <button className={view === "tree" ? "seg active" : "seg"} onClick={() => setView("tree")}>Tree</button>
            </div>
            <button className="btn" onClick={handleCopy}>{copied ? "Copied" : "Copy"}</button>
          </div>
          {view === "raw" ? (
            <pre className="output">{result.text}</pre>
          ) : (
            <div className="output"><TreeView data={result.data} /></div>
          )}
        </div>
      </div>

      <footer className="footer">
        <span>Dark theme enabled</span>
      </footer>
    </div>
  );
}
