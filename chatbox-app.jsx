/**
 * AI Chatbox Application
 * 
 * Architecture:
 * - Redux store (via useReducer + Context as a lightweight Redux pattern for artifacts)
 * - Claude API integration via Anthropic /v1/messages
 * - Async thunk-style dispatch pattern
 * - Responsive design: mobile + desktop
 * - Loading, error, and message state management
 * 
 * State Shape:
 * {
 *   messages: [{ id, role: 'user'|'assistant', content, timestamp }],
 *   loading: boolean,
 *   error: string | null,
 *   apiKey: string
 * }
 */

import { useReducer, useContext, createContext, useRef, useEffect, useState, useCallback } from "react";

// ─────────────────────────────────────────────
// REDUX-STYLE ACTION TYPES
// ─────────────────────────────────────────────
const SEND_MESSAGE      = "SEND_MESSAGE";
const RECEIVE_MESSAGE   = "RECEIVE_MESSAGE";
const SET_LOADING       = "SET_LOADING";
const SET_ERROR         = "SET_ERROR";
const CLEAR_ERROR       = "CLEAR_ERROR";
const CLEAR_CHAT        = "CLEAR_CHAT";
const SET_API_KEY       = "SET_API_KEY";

// ─────────────────────────────────────────────
// ACTION CREATORS
// ─────────────────────────────────────────────
const actions = {
  sendMessage:    (content) => ({ type: SEND_MESSAGE, payload: { id: Date.now(), role: "user", content, timestamp: new Date().toISOString() } }),
  receiveMessage: (content) => ({ type: RECEIVE_MESSAGE, payload: { id: Date.now() + 1, role: "assistant", content, timestamp: new Date().toISOString() } }),
  setLoading:     (loading) => ({ type: SET_LOADING, payload: loading }),
  setError:       (error)   => ({ type: SET_ERROR, payload: error }),
  clearError:     ()        => ({ type: CLEAR_ERROR }),
  clearChat:      ()        => ({ type: CLEAR_CHAT }),
  setApiKey:      (key)     => ({ type: SET_API_KEY, payload: key }),
};

// ─────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────
const initialState = {
  messages: [],
  loading: false,
  error: null,
  apiKey: "",
};

// ─────────────────────────────────────────────
// REDUCER (pure function — Redux pattern)
// ─────────────────────────────────────────────
function chatReducer(state, action) {
  switch (action.type) {
    case SEND_MESSAGE:
      return { ...state, messages: [...state.messages, action.payload], error: null };
    case RECEIVE_MESSAGE:
      return { ...state, messages: [...state.messages, action.payload] };
    case SET_LOADING:
      return { ...state, loading: action.payload };
    case SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    case CLEAR_ERROR:
      return { ...state, error: null };
    case CLEAR_CHAT:
      return { ...state, messages: [], error: null };
    case SET_API_KEY:
      return { ...state, apiKey: action.payload };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────
// STORE CONTEXT (mirrors Redux's Provider pattern)
// ─────────────────────────────────────────────
const StoreContext = createContext(null);
const useStore = () => useContext(StoreContext);

// ─────────────────────────────────────────────
// ASYNC THUNK: sendMessageToAI
// Mirrors redux-thunk: (dispatch, getState) => async () => {}
// ─────────────────────────────────────────────
const sendMessageToAI = (userContent, conversationHistory, apiKey) => async (dispatch) => {
  dispatch(actions.setLoading(true));
  dispatch(actions.clearError());

  // Build messages array for the API (full conversation context)
  const apiMessages = [
    ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: userContent },
  ];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // API key is injected by the Anthropic proxy — not exposed in client code
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: "You are a helpful, friendly AI assistant. Be concise and clear in your responses.",
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const aiContent = data?.content?.[0]?.text;

    if (!aiContent) throw new Error("Received an empty response from the AI.");

    dispatch(actions.receiveMessage(aiContent));
  } catch (err) {
    dispatch(actions.setError(err.message || "An unexpected error occurred. Please try again."));
  } finally {
    dispatch(actions.setLoading(false));
  }
};

// ─────────────────────────────────────────────
// STORE PROVIDER
// ─────────────────────────────────────────────
function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Thunk-capable dispatch (mirrors redux-thunk middleware)
  const thunkDispatch = useCallback((action) => {
    if (typeof action === "function") {
      return action(thunkDispatch);
    }
    return dispatch(action);
  }, []);

  return (
    <StoreContext.Provider value={{ state, dispatch: thunkDispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

// ─────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────

/** Typing indicator dots */
function TypingIndicator() {
  return (
    <div style={styles.typingBubble}>
      <span style={{...styles.dot, animationDelay: "0s"}} />
      <span style={{...styles.dot, animationDelay: "0.2s"}} />
      <span style={{...styles.dot, animationDelay: "0.4s"}} />
    </div>
  );
}

/** Single chat message bubble */
function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ ...styles.messageRow, justifyContent: isUser ? "flex-end" : "flex-start" }}>
      {!isUser && (
        <div style={styles.avatar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
        <div style={isUser ? styles.userBubble : styles.aiBubble}>
          {message.content}
        </div>
        <span style={styles.timestamp}>{time}</span>
      </div>
      {isUser && (
        <div style={{...styles.avatar, background: "linear-gradient(135deg, #6366f1, #8b5cf6)"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      )}
    </div>
  );
}

/** Error banner */
function ErrorBanner({ error, onDismiss }) {
  return (
    <div style={styles.errorBanner}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#f87171" strokeWidth="2"/>
          <line x1="12" y1="8" x2="12" y2="12" stroke="#f87171" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="16" r="1" fill="#f87171"/>
        </svg>
        <span style={{ fontSize: 13, color: "#fca5a5", flex: 1 }}>{error}</span>
      </div>
      <button onClick={onDismiss} style={styles.errorDismiss}>✕</button>
    </div>
  );
}

/** Message list with auto-scroll */
function MessageList() {
  const { state } = useStore();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, state.loading]);

  return (
    <div style={styles.messageList}>
      {state.messages.length === 0 && !state.loading && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={styles.emptyTitle}>Start a conversation</p>
          <p style={styles.emptySubtitle}>Ask me anything — I'm here to help.</p>
          <div style={styles.suggestions}>
            {["Explain quantum computing simply", "Write a haiku about code", "Best practices for React"].map(s => (
              <SuggestionChip key={s} text={s} />
            ))}
          </div>
        </div>
      )}
      {state.messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
      {state.loading && (
        <div style={{ ...styles.messageRow, justifyContent: "flex-start" }}>
          <div style={styles.avatar}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <TypingIndicator />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

/** Suggestion chip */
function SuggestionChip({ text }) {
  const { state, dispatch } = useStore();
  const handleClick = () => {
    if (state.loading) return;
    dispatch(actions.sendMessage(text));
    dispatch(sendMessageToAI(text, state.messages, state.apiKey));
  };
  return (
    <button onClick={handleClick} style={styles.chip}>{text}</button>
  );
}

/** Input area */
function InputArea() {
  const { state, dispatch } = useStore();
  const [input, setInput] = useState("");
  const textareaRef = useRef(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || state.loading) return;
    dispatch(actions.sendMessage(trimmed));
    dispatch(sendMessageToAI(trimmed, state.messages, state.apiKey));
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, state.loading, state.messages, dispatch]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; }
  };

  const canSend = input.trim().length > 0 && !state.loading;

  return (
    <div style={styles.inputArea}>
      {state.error && <ErrorBanner error={state.error} onDismiss={() => dispatch(actions.clearError())} />}
      <div style={styles.inputRow}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Message the AI… (Enter to send, Shift+Enter for new line)"
          rows={1}
          style={styles.textarea}
          disabled={state.loading}
          aria-label="Message input"
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{ ...styles.sendBtn, opacity: canSend ? 1 : 0.4, cursor: canSend ? "pointer" : "not-allowed" }}
          aria-label="Send message"
        >
          {state.loading ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" strokeDasharray="31.4" strokeDashoffset="10"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          )}
        </button>
      </div>
      <p style={styles.hint}>Powered by Claude AI · Enter to send · Shift+Enter for new line</p>
    </div>
  );
}

/** Header */
function Header() {
  const { state, dispatch } = useStore();
  return (
    <div style={styles.header}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={styles.headerIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h1 style={styles.headerTitle}>AI Assistant</h1>
          <div style={styles.statusDot}>
            <span style={styles.onlineDot} />
            <span style={{ fontSize: 11, color: "#86efac" }}>{state.loading ? "Thinking…" : "Online"}</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => dispatch(actions.clearChat())}
        style={styles.clearBtn}
        title="Clear conversation"
        aria-label="Clear conversation"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: 12 }}>Clear</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// STYLES (CSS-in-JS, dark editorial theme)
// ─────────────────────────────────────────────
const styles = {
  app: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 40%, #0d0d18 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 720,
    height: "min(85vh, 780px)",
    display: "flex",
    flexDirection: "column",
    background: "#0e0e1a",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 20,
    overflow: "hidden",
    boxShadow: "0 0 0 1px rgba(99,102,241,0.08), 0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.06)",
  },
  header: {
    padding: "16px 20px",
    background: "rgba(15,15,28,0.95)",
    borderBottom: "1px solid rgba(99,102,241,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backdropFilter: "blur(12px)",
  },
  headerIcon: {
    width: 42, height: 42,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
  },
  headerTitle: {
    margin: 0, fontSize: 17, fontWeight: 700,
    color: "#f1f0ff", letterSpacing: "-0.3px",
  },
  statusDot: { display: "flex", alignItems: "center", gap: 5, marginTop: 2 },
  onlineDot: {
    width: 7, height: 7, borderRadius: "50%",
    background: "#4ade80",
    boxShadow: "0 0 6px #4ade80",
    display: "inline-block",
  },
  clearBtn: {
    display: "flex", alignItems: "center", gap: 6,
    background: "rgba(99,102,241,0.08)",
    border: "1px solid rgba(99,102,241,0.2)",
    color: "#a78bfa",
    borderRadius: 8,
    padding: "6px 12px",
    cursor: "pointer",
    transition: "all 0.15s",
    fontSize: 13,
  },
  messageList: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    scrollbarWidth: "thin",
    scrollbarColor: "rgba(99,102,241,0.2) transparent",
  },
  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    animation: "fadeSlideIn 0.25s ease-out",
  },
  avatar: {
    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
    background: "rgba(99,102,241,0.12)",
    border: "1px solid rgba(99,102,241,0.2)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  userBubble: {
    background: "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)",
    color: "#fff",
    borderRadius: "18px 18px 4px 18px",
    padding: "10px 15px",
    fontSize: 14.5,
    lineHeight: 1.55,
    boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  aiBubble: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#e2e0f7",
    borderRadius: "18px 18px 18px 4px",
    padding: "10px 15px",
    fontSize: 14.5,
    lineHeight: 1.55,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  timestamp: {
    fontSize: 10.5, color: "rgba(255,255,255,0.28)", marginTop: 4,
  },
  typingBubble: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "18px 18px 18px 4px",
    padding: "12px 18px",
    display: "flex", gap: 5, alignItems: "center",
  },
  dot: {
    width: 7, height: 7, borderRadius: "50%",
    background: "#a78bfa",
    display: "inline-block",
    animation: "bounce 1s ease-in-out infinite",
  },
  emptyState: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    textAlign: "center", padding: "40px 20px", gap: 10,
    margin: "auto",
  },
  emptyIcon: {
    width: 72, height: 72,
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 20,
    display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { margin: 0, fontSize: 20, fontWeight: 700, color: "#e2e0f7" },
  emptySubtitle: { margin: 0, fontSize: 14, color: "rgba(255,255,255,0.4)" },
  suggestions: {
    display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center",
    marginTop: 16,
  },
  chip: {
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.25)",
    color: "#a78bfa",
    borderRadius: 20,
    padding: "7px 14px",
    fontSize: 12.5,
    cursor: "pointer",
    transition: "all 0.15s",
    fontFamily: "inherit",
  },
  inputArea: {
    borderTop: "1px solid rgba(99,102,241,0.15)",
    background: "rgba(10,10,20,0.8)",
    padding: "12px 16px 14px",
    backdropFilter: "blur(12px)",
  },
  inputRow: {
    display: "flex", alignItems: "flex-end", gap: 10,
  },
  textarea: {
    flex: 1,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 14,
    padding: "11px 14px",
    fontSize: 14.5,
    color: "#e2e0f7",
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.5,
    minHeight: 44,
    maxHeight: 140,
    transition: "border-color 0.2s",
    caretColor: "#a78bfa",
  },
  sendBtn: {
    width: 44, height: 44, flexShrink: 0,
    background: "linear-gradient(135deg, #6366f1, #7c3aed)",
    border: "none", borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
    transition: "all 0.15s",
  },
  hint: {
    margin: "8px 0 0", fontSize: 11,
    color: "rgba(255,255,255,0.2)", textAlign: "center",
  },
  errorBanner: {
    background: "rgba(220,38,38,0.12)",
    border: "1px solid rgba(220,38,38,0.3)",
    borderRadius: 10,
    padding: "10px 14px",
    marginBottom: 10,
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
  },
  errorDismiss: {
    background: "none", border: "none", color: "#fca5a5",
    cursor: "pointer", fontSize: 14, padding: 2, flexShrink: 0,
  },
};

// ─────────────────────────────────────────────
// CSS KEYFRAMES (injected into <head>)
// ─────────────────────────────────────────────
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { margin: 0; }
  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-6px); }
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  textarea:focus {
    border-color: rgba(99,102,241,0.5) !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
  }
  textarea::placeholder { color: rgba(255,255,255,0.25); }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 4px; }

  /* Redux State Debug Panel */
  .debug-panel {
    position: fixed; bottom: 16px; right: 16px;
    background: rgba(10,10,20,0.95);
    border: 1px solid rgba(99,102,241,0.25);
    border-radius: 12px;
    padding: 12px 16px;
    font-family: 'SF Mono', monospace;
    font-size: 11px;
    color: #a78bfa;
    max-width: 240px;
    z-index: 1000;
  }
  .debug-panel h4 { color: #e2e0f7; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .debug-row { display: flex; justify-content: space-between; gap: 12px; margin: 3px 0; }
  .debug-val { color: #86efac; }

  /* Responsive */
  @media (max-width: 500px) {
    .chat-card { border-radius: 0 !important; height: 100vh !important; max-width: 100% !important; }
    .app-wrapper { padding: 0 !important; align-items: stretch !important; }
  }
`;

// ─────────────────────────────────────────────
// DEBUG PANEL (Redux DevTools-lite)
// ─────────────────────────────────────────────
function DebugPanel() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <div className="debug-panel" style={{ cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
      <h4>🔧 Redux State {open ? "▲" : "▼"}</h4>
      {open && (
        <>
          <div className="debug-row"><span>messages</span><span className="debug-val">{state.messages.length}</span></div>
          <div className="debug-row"><span>loading</span><span className="debug-val">{String(state.loading)}</span></div>
          <div className="debug-row"><span>error</span><span className="debug-val" style={{ color: state.error ? "#f87171" : "#86efac" }}>{state.error ? "yes" : "null"}</span></div>
          <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Click to collapse</div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
export default function App() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = globalCSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <StoreProvider>
      <div style={styles.app} className="app-wrapper">
        <div style={styles.card} className="chat-card">
          <Header />
          <MessageList />
          <InputArea />
        </div>
        <DebugPanel />
      </div>
    </StoreProvider>
  );
}
