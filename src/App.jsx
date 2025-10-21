import { useEffect, useMemo, useState } from "react";

// helpers for search/highlight
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeHtml = (s) => s
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");
const markText = (text, query) => {
  if (!query) return <span>{text}</span>;
  const re = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const parts = String(text).split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="hl">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};
const containsQuery = (val, q) => {
  if (!q) return false;
  const s =
    typeof val === "string"
      ? val
      : typeof val === "number" || typeof val === "boolean"
      ? String(val)
      : null;
  return s ? s.toLowerCase().includes(q.toLowerCase()) : false;
};
const findMatches = (node, q, path = []) => {
  const matches = [];
  const walk = (n, p) => {
    if (Array.isArray(n)) {
      n.forEach((item, i) => {
        if (containsQuery(item, q)) matches.push([...p, i].join("."));
        walk(item, p.concat(i));
      });
    } else if (n && typeof n === "object") {
      Object.entries(n).forEach(([k, v]) => {
        if ((k || "").toLowerCase().includes(q.toLowerCase())) matches.push([...p, k].join("."));
        if (containsQuery(v, q)) matches.push([...p, k].join("."));
        walk(v, p.concat(k));
      });
    } else {
      if (containsQuery(n, q)) matches.push(p.join("."));
    }
  };
  walk(node, path);
  return matches;
};

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

function collectStringifiedStrings(obj, path = []) {
  const found = [];
  const walk = (node, pth) => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, pth.concat(i)));
    } else if (node && typeof node === "object") {
      Object.entries(node).forEach(([k, v]) => walk(v, pth.concat(k)));
    } else if (typeof node === "string") {
      const parsed = safeParseJSON(node);
      if (parsed !== null) {
        found.push({ path: pth, value: node, parsed });
      }
    }
  };
  walk(obj, path);
  return found;
}

function ValueSpan({ v, query }) {
  if (v === null) return <span className="tree-null">null</span>;
  switch (typeof v) {
    case "string": {
      const txt = JSON.stringify(v);
      return <span className="tree-string">{markText(txt, query)}</span>;
    }
    case "number": {
      const txt = String(v);
      return <span className="tree-number">{markText(txt, query)}</span>;
    }
    case "boolean": {
      const txt = String(v);
      return <span className="tree-boolean">{markText(txt, query)}</span>;
    }
    default: {
      const txt = JSON.stringify(v);
      return <span className="tree-value">{markText(txt, query)}</span>;
    }
  }
}

function TreeNode({ k, v, depth = 0, path = [], expandedSet, query }) {
  const [open, setOpen] = useState(true);
  const isObj = v && typeof v === "object";
  const isArr = Array.isArray(v);
  const pathStr = path.join(".");
  const shouldOpen = expandedSet?.has(pathStr);

  useEffect(() => {
    if (shouldOpen) setOpen(true);
  }, [shouldOpen]);

  if (!isObj) {
    return (
      <div className="tree-row" style={{ paddingLeft: depth * 14 }}>
        {k !== undefined && (
          <span className="tree-key">
            {markText(`${k}`, query)}:
          </span>
        )}
        <ValueSpan v={v} query={query} />
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
        {k !== undefined && (
          <span className="tree-key">{markText(`${k}`, query)}:</span>
        )}
        <span className="tree-type">{isArr ? `[${count}]` : `{${count}}`}</span>
      </div>
      {open && (
        <div className="tree-children">
          {entries.map(([ck, cv]) => (
            <TreeNode
              key={ck}
              k={ck}
              v={cv}
              depth={depth + 1}
              path={path.concat(ck)}
              expandedSet={expandedSet}
              query={query}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeView({ data, expandedSet, query }) {
  return (
    <div className="tree">
      <TreeNode v={data} depth={0} path={[]} expandedSet={expandedSet} query={query} />
    </div>
  );
}

export default function App() {
  const initialInput = `\n{\n  \"action\": \"EDIT\",\n  \"data\": \"{\\\"id\\\":\\\"833621db-4c32-445f-ab6b-hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh3aabd163bff4\\\",\\\"name\\\":\\\"IS-NONOP\\\",\\\"rows\\\":[{\\\"id\\\":\\\"6278aa36-ef82-4eab-98de-39bdf002aa9a\\\",\\\"type\\\":\\\"ROW\\\"}]}\"\n}`;

  const [tabs, setTabs] = useState([
    { id: "main", title: "Main", input: initialInput }
  ]);
  const [activeId, setActiveId] = useState("main");
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState("raw"); // 'raw' | 'tree'
  const [query, setQuery] = useState("");

  const result = useMemo(() => {
    const input = activeTab?.input ?? "";
    try {
      const parsed = JSON.parse(input);
      const transformed = deepUnstringify(parsed);
      setError("");
      return { data: transformed, text: JSON.stringify(transformed, null, 2), parsedOriginal: parsed };
    } catch (e) {
      const maybe = safeParseJSON(input);
      if (maybe !== null) {
        const transformed = deepUnstringify(maybe);
        setError("");
        return { data: transformed, text: JSON.stringify(transformed, null, 2), parsedOriginal: maybe };
      }
      setError(e.message || "Invalid JSON");
      return { data: null, text: "", parsedOriginal: null };
    }
  }, [activeTab]);

  const stringifiedList = useMemo(() => {
    if (!result.parsedOriginal) return [];
    return collectStringifiedStrings(result.parsedOriginal).map((item) => ({
      pathText: item.path.join("."),
      value: item.value,
      parsed: item.parsed,
    }));
  }, [result.parsedOriginal]);

  // compute expanded paths for search
  const expandedSet = useMemo(() => {
    if (!query || !result.data) return new Set();
    const paths = findMatches(result.data, query);
    const set = new Set();
    // Ensure root opens when there are matches
    if (paths.length > 0) set.add("");
    paths.forEach((p) => {
      const parts = p.split(".");
      for (let i = 1; i <= parts.length; i++) {
        set.add(parts.slice(0, i).join("."));
      }
    });
    return set;
  }, [query, result.data]);

  // highlighted raw view html
  const highlightedRaw = useMemo(() => {
    const text = result.text || "";
    const escaped = escapeHtml(text);
    if (!query) return escaped;
    const re = new RegExp(`(${escapeRegExp(query)})`, "gi");
    return escaped.replace(re, '<mark class="hl">$1</mark>');
  }, [result.text, query]);

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 1200);
      return () => clearTimeout(t);
    }
  }, [copied]);

  const setActiveInput = (next) => {
    setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, input: next } : t)));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const openNestedAsTab = (title, parsed) => {
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const content = JSON.stringify(parsed, null, 2);
    setTabs((prev) => [...prev, { id, title, input: content }]);
    setActiveId(id);
  };

  const closeTab = (id) => {
    if (id === "main") return; // prevent closing main
    setTabs((prev) => prev.filter((t) => t.id !== id));
    if (activeId === id) setActiveId("main");
  };

  return (
    <div className="app">
      <header className="header">
        <div className="title">JSON Formatter</div>
        <div className="subtitle">Auto unstringifies nested JSON in <code>data</code> and formats</div>
      </header>

      {/* Tabs Bar */}
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={"tab" + (t.id === activeId ? " active" : "")}
            onClick={() => setActiveId(t.id)}
          >
            <span className="tab-title">{t.title}</span>
            {t.id !== "main" && (
              <span className="tab-close" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}>×</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="error">Parse error: {error}</div>}

      <div className="panes">
        <div className="pane">
          <div className="pane-header">Input</div>
          <textarea
            className="editor"
            value={activeTab?.input ?? ""}
            onChange={(e) => setActiveInput(e.target.value)}
            spellCheck={false}
            placeholder="Paste JSON here"
          />

          {/* Nested stringified JSON finder */}
          {stringifiedList.length > 0 && (
            <div className="nested-list">
              <div className="nested-title">Stringified JSON found:</div>
              {stringifiedList.map((item, i) => (
                <div key={i} className="nested-item">
                  <span className="nested-path">{item.pathText || "(root)"}</span>
                  <button className="mini-btn" onClick={() => openNestedAsTab(item.pathText || "Nested", item.parsed)}>Open in new tab</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pane">
          <div className="pane-header right">
            <span>Formatted Output</span>
            <div className="spacer" />
            <input
              className="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
            />
            <div className="segmented">
              <button className={view === "raw" ? "seg active" : "seg"} onClick={() => setView("raw")}>Raw</button>
              <button className={view === "tree" ? "seg active" : "seg"} onClick={() => setView("tree")}>Tree</button>
            </div>
            <button className="btn" onClick={handleCopy}>{copied ? "Copied" : "Copy"}</button>
          </div>
          {view === "raw" ? (
            <pre className="output" dangerouslySetInnerHTML={{ __html: highlightedRaw }} />
          ) : (
            <div className="output"><TreeView data={result.data} expandedSet={expandedSet} query={query} /></div>
          )}
        </div>
      </div>

      <footer className="footer">
        <span>Dark theme enabled</span>
      </footer>
    </div>
  );
}
