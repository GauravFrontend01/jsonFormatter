import { useEffect, useMemo, useRef, useState, memo } from "react";

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
  const out = new Set();
  const qLower = (q || "").toLowerCase();
  const walk = (n, p) => {
    if (Array.isArray(n)) {
      n.forEach((item, i) => {
        walk(item, p.concat(i));
      });
    } else if (n && typeof n === "object") {
      Object.entries(n).forEach(([k, v]) => {
        if ((k || "").toLowerCase().includes(qLower)) out.add([...p, k].join("."));
        walk(v, p.concat(k));
      });
    } else {
      if (containsQuery(n, q)) out.add(p.join("."));
    }
  };
  walk(node, path);
  return Array.from(out);
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

function TreeNode({ k, v, depth = 0, path = [], expandedSet, query, onFocus }) {
  const pathStr = path.join(".");
  const [open, setOpen] = useState(false);
  const isObj = v && typeof v === "object";
  const isArr = Array.isArray(v);
  const shouldOpen = expandedSet?.has(pathStr);

  useEffect(() => {
    if (shouldOpen) setOpen(true);
  }, [shouldOpen]);

  if (!isObj) {
    return (
      <div className="tree-row" data-path={pathStr} style={{ paddingLeft: depth * 14 }}>
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
      <div className="tree-header" data-path={pathStr}>
        <button className="tree-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? "▼" : "▶"}
        </button>
        {k !== undefined && (
          <span
            className={"tree-key" + (isObj ? " clickable" : "")}
            onClick={isObj ? () => onFocus?.(path) : undefined}
          >
            {markText(`${k}`, query)}:
          </span>
        )}
        <span
          className={"tree-type" + (isObj ? " clickable" : "")}
          onClick={isObj ? () => onFocus?.(path) : undefined}
        >
          {isArr ? `[${count}]` : `{${count}}`}
        </span>
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
              onFocus={onFocus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeView({ data, expandedSet, query, onFocus }) {
  return (
    <div className="tree">
      <TreeNode v={data} depth={0} path={[]} expandedSet={expandedSet} query={query} onFocus={onFocus} />
    </div>
  );
}

export default function App() {
  const initialInput = `\n{\n  \"action\": \"EDIT\",\n  \"data\": \"{\\\"id\\\":\\\"833621db-4c32-445f-ab6b-hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh3aabd163bff4\\\",\\\"name\\\":\\\"IS-NONOP\\\",\\\"rows\\\":[{\\\"id\\\":\\\"6278aa36-ef82-4eab-98de-39bdf002aa9a\\\",\\\"type\\\":\\\"ROW\\\"}]}\"\n}`;

  const [tabs, setTabs] = useState(() => {
    try {
      const saved = localStorage.getItem("tabs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {}
    return [{ id: "main", title: "Main", input: initialInput }];
  });
  const [activeId, setActiveId] = useState(() => {
    try {
      return localStorage.getItem("activeId") || "main";
    } catch {
      return "main";
    }
  });
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  useEffect(() => {
    try { localStorage.setItem("tabs", JSON.stringify(tabs)); } catch {}
  }, [tabs]);
  useEffect(() => {
    try { localStorage.setItem("activeId", activeId); } catch {}
  }, [activeId]);

  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState("raw"); // 'raw' | 'tree'
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Focused subtree navigation
  const [focusPath, setFocusPath] = useState([]);

  // split pane widths
  const [ratio, setRatio] = useState(0.5); // 0..1
  const panesRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const startDrag = (e) => {
    e.preventDefault();
    setDragging(true);
    const onMove = (ev) => {
      const rect = panesRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ev.clientX;
      const left = Math.max(200, Math.min(rect.width - 200, x - rect.left));
      setRatio(left / rect.width);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

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

  // Derived output for focused subtree
  const displayData = useMemo(() => {
    const root = result.data;
    if (!root) return null;
    let cur = root;
    for (const key of focusPath) {
      if (cur == null) break;
      cur = cur[key];
    }
    return cur ?? root;
  }, [result.data, focusPath]);

  const displayText = useMemo(() => {
    return displayData ? JSON.stringify(displayData, null, 2) : "";
  }, [displayData]);

  // compute expanded paths for search
  const expandedSet = useMemo(() => {
    if (!debouncedQuery || !displayData) return new Set();
    const paths = findMatches(displayData, debouncedQuery);
    const set = new Set();
    if (paths.length > 0) set.add("");
    paths.forEach((p) => {
      const parts = p.split(".");
      for (let i = 1; i <= parts.length; i++) {
        set.add(parts.slice(0, i).join("."));
      }
    });
    return set;
  }, [debouncedQuery, displayData]);

  // highlighted raw view html
  const MAX_HL = 200;
  const highlightedRaw = useMemo(() => {
    const text = displayText || "";
    const escaped = escapeHtml(text);
    if (!debouncedQuery) return escaped;
    const re = new RegExp(`(${escapeRegExp(debouncedQuery)})`, "gi");
    let count = 0;
    return escaped.replace(re, (m) => {
      if (count < MAX_HL) {
        count++;
        return `<mark class=\"hl\">${m}</mark>`;
      }
      return m;
    });
  }, [displayText, debouncedQuery]);

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
      await navigator.clipboard.writeText(displayText);
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

  const addTab = () => {
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const title = `Tab ${tabs.length + 1}`;
    setTabs((prev) => [...prev, { id, title, input: "" }]);
    setActiveId(id);
  };

  const renameActiveTab = () => {
    const current = tabs.find((t) => t.id === activeId);
    if (!current) return;
    const next = window.prompt("Rename tab", current.title);
    if (next && next.trim()) {
      setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, title: next.trim() } : t)));
    }
  };

  const closeOthers = () => {
    setTabs((prev) => prev.filter((t) => t.id === activeId || t.id === "main"));
  };

  const closeTab = (id) => {
    if (id === "main") return; // prevent closing main
    setTabs((prev) => prev.filter((t) => t.id !== id));
    if (activeId === id) setActiveId("main");
  };

  // search navigation and refs
  const rawRef = useRef(null);
  const treeRef = useRef(null);
  const treeMatches = useMemo(() => {
    if (!debouncedQuery || !result.data) return [];
    return findMatches(result.data, debouncedQuery);
  }, [debouncedQuery, result.data]);
  const rawMatchCount = useMemo(() => {
    if (!debouncedQuery) return 0;
    const re = new RegExp(`(${escapeRegExp(debouncedQuery)})`, "gi");
    return (result.text || "").match(re)?.length || 0;
  }, [debouncedQuery, result.text]);
  const [matchIndex, setMatchIndex] = useState(0);
  const matchCount = view === "raw" ? rawMatchCount : treeMatches.length;
  const displayCount = matchCount;
  useEffect(() => { setMatchIndex(0); }, [debouncedQuery, view]);
  const nextMatch = () => { if (!matchCount) return; setMatchIndex((i) => (i + 1) % matchCount); };
  const prevMatch = () => { if (!matchCount) return; setMatchIndex((i) => (i - 1 + matchCount) % matchCount); };
  useEffect(() => {
    if (!matchCount) return;
    if (view === "raw") {
      const container = rawRef.current;
      if (!container) return;
      const marks = container.querySelectorAll("mark.hl");
      const el = marks[matchIndex];
      if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center", inline: "nearest" });
    } else {
      const path = treeMatches[matchIndex];
      if (!path) return;
      const container = treeRef.current;
      const el = container?.querySelector(`[data-path="${CSS.escape(path)}"]`);
      if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center", inline: "nearest" });
    }
  }, [matchIndex, matchCount, view, highlightedRaw, treeMatches]);

  const colA = `minmax(0, ${Math.max(0.2, Math.min(0.8, ratio))}fr)`;
  const colB = `minmax(0, ${Math.max(0.2, Math.min(0.8, 1 - ratio))}fr)`;

  return (
    <div className="app">
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
        <button className="tab" onClick={addTab}>+ New Tab</button>
        <button className="btn" onClick={renameActiveTab}>Rename Tab</button>
        <button className="btn" onClick={closeOthers}>Close Others</button>
      </div>
      {error && <div className="error">Parse error: {error}</div>}
      <div className="panes" ref={panesRef} style={{ gridTemplateColumns: `${colA} 8px ${colB}` }}>
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
        {/* divider */}
        <div className={"divider" + (dragging ? " dragging" : "")} onMouseDown={startDrag} />
        <div className="pane">
          <div className="pane-header right">
            <span>Formatted Output</span>
            <div className="spacer" />
            {focusPath.length > 0 && (
              <button className="btn" onClick={() => setFocusPath((p) => p.slice(0, -1))}>Back</button>
            )}
            <input
              className="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
            />
            <div className="search-nav">
              <button className="nav" onClick={prevMatch} disabled={!matchCount}>◀</button>
              <span className="count">{matchCount ? matchIndex + 1 : 0}/{displayCount}</span>
              <button className="nav" onClick={nextMatch} disabled={!matchCount}>▶</button>
            </div>
            <div className="segmented">
              <button className={view === "raw" ? "seg active" : "seg"} onClick={() => setView("raw")}>Raw</button>
              <button className={view === "tree" ? "seg active" : "seg"} onClick={() => setView("tree")}>Tree</button>
            </div>
            <button className="btn" onClick={handleCopy}>{copied ? "Copied" : "Copy"}</button>
          </div>
          {view === "raw" ? (
            <pre className="output" ref={rawRef} dangerouslySetInnerHTML={{ __html: highlightedRaw }} />
          ) : (
            <div className="output" ref={treeRef}><TreeView data={displayData} expandedSet={expandedSet} query={debouncedQuery} onFocus={setFocusPath} /></div>
          )}
        </div>
      </div>
    </div>
  );
}
