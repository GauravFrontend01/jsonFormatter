import { useEffect, useMemo, useState } from "react";

function tryParseJSON(str) {
  if (typeof str !== "string") return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  const looksJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));
  if (!looksJson) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function unstringifyDataFields(value) {
  if (Array.isArray(value)) {
    return value.map(unstringifyDataFields);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (typeof val === "string" && key.toLowerCase() === "data") {
        const parsed = tryParseJSON(val);
        out[key] = parsed !== null ? unstringifyDataFields(parsed) : val;
      } else if (typeof val === "string") {
        // Also try to parse JSON-looking strings anywhere, to be helpful
        const parsed = tryParseJSON(val);
        out[key] = parsed !== null ? unstringifyDataFields(parsed) : val;
      } else {
        out[key] = unstringifyDataFields(val);
      }
    }
    return out;
  }
  // For strings not inside objects/arrays
  if (typeof value === "string") {
    const parsed = tryParseJSON(value);
    return parsed !== null ? unstringifyDataFields(parsed) : value;
  }
  return value;
}

export default function App() {
  const [input, setInput] = useState(`{\n  "action": "EDIT",\n  "data": "{\\"id\\":\\"833621db-4c32-445f-ab6b-33abd163bff4\\",\\"name\\":\\"IS-NONOP\\",\\"rows\\":[{\\"id\\":\\"6278aa36-ef82-4eab-98de-39bdf002aa9a\\",\\"type\\":\\"ROW\\"}]}"\n}`);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    try {
      const parsed = JSON.parse(input);
      const transformed = unstringifyDataFields(parsed);
      setError("");
      return JSON.stringify(transformed, null, 2);
    } catch (e) {
      setError(e.message || "Invalid JSON");
      return "";
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
      await navigator.clipboard.writeText(output);
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
            <button className="btn" onClick={handleCopy}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <pre className="output">{output}</pre>
        </div>
      </div>

      <footer className="footer">
        <span>Dark theme enabled</span>
      </footer>
    </div>
  );
}
