"use client";
import { useState, useEffect, useMemo, useRef } from "react";

export default function DesktopHome() {
  const [status, setStatus] = useState("Connecting to P2P network...");
  const [isRunning, setIsRunning] = useState(false);
  const [modelId, setModelId] = useState("TheBloke/Mistral-7B-v0.1-GGUF");
  const [customModel, setCustomModel] = useState("");
  const [runtimeInfo, setRuntimeInfo] = useState(null);
  const [selectedRuntime, setSelectedRuntime] = useState("auto");
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      role: "assistant",
      content:
        "Welcome to AccessLM Desktop! I'm ready to chat. How can I help you today?",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showUploads, setShowUploads] = useState(false);
  const [peers, setPeers] = useState([]);
  const [modelIndex, setModelIndex] = useState({});
  const [preferredPeer, setPreferredPeer] = useState(null);
  const [capabilities, setCapabilities] = useState({});
  const [runtimeModels, setRuntimeModels] = useState([]);
  const [lastNetworkRefresh, setLastNetworkRefresh] = useState(null);
  const [localModels, setLocalModels] = useState([]);
  const [modelsTab, setModelsTab] = useState("local");
  const modelIdRef = useRef(modelId);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [lastStats, setLastStats] = useState(null);
  const [modelSearch, setModelSearch] = useState("");
  const [activeFeatures, setActiveFeatures] = useState({
    thinking: false,
    search: false,
  });
  const [activeTab, setActiveTab] = useState("chat");

  const models = [
    {
      value: "TheBloke/Mistral-7B-v0.1-GGUF",
      label: "Mistral 7B",
      size: "4.2GB",
      ram: "8GB",
    },
    {
      value: "TheBloke/Llama-3-8B-GGUF",
      label: "Llama 3 8B",
      size: "5.2GB",
      ram: "8GB",
    },
    {
      value: "TheBloke/Phi-3-mini-4k-instruct-GGUF",
      label: "Phi-3 Mini",
      size: "2.7GB",
      ram: "6GB",
    },
    {
      value: "TheBloke/Qwen1.5-7B-GGUF",
      label: "Qwen 7B",
      size: "4.1GB",
      ram: "8GB",
    },
    {
      value: "TheBloke/gemma-2-9b-it-GGUF",
      label: "Gemma 2 9B",
      size: "5.5GB",
      ram: "10GB",
    },
  ];

  useEffect(() => {
    modelIdRef.current = modelId;
  }, [modelId]);

  const refreshNetwork = async () => {
    if (!window.electronAPI) return;
    let peersSnapshot = [];
    try {
      if (window.electronAPI.getPeerHealth) {
        peersSnapshot = await window.electronAPI.getPeerHealth();
      } else if (window.electronAPI.getPeers) {
        peersSnapshot = await window.electronAPI.getPeers();
      }
    } catch {
      if (window.electronAPI.getPeers) {
        peersSnapshot = await window.electronAPI.getPeers().catch(() => []);
      }
    }
    setPeers(Array.isArray(peersSnapshot) ? peersSnapshot : []);
    if (window.electronAPI.getModelIndex) {
      window.electronAPI
        .getModelIndex()
        .then(setModelIndex)
        .catch(() => {});
    }
    if (window.electronAPI.getPreferredPeer) {
      window.electronAPI
        .getPreferredPeer(modelIdRef.current)
        .then(setPreferredPeer)
        .catch(() => {});
    }
    if (window.electronAPI.getCapabilities) {
      window.electronAPI
        .getCapabilities()
        .then(setCapabilities)
        .catch(() => {});
    }
    setLastNetworkRefresh(Date.now());
  };

  useEffect(() => {
    const desktop = typeof window !== "undefined" && !!window.electronAPI;
    setIsDesktopApp(desktop);
    initializeP2P();
    if (desktop && window.electronAPI?.detectRuntimes) {
      window.electronAPI
        .detectRuntimes()
        .then((info) => {
          setRuntimeInfo(info);
          const allModels = Object.values(info || {}).flatMap(
            (entry) => entry?.models || [],
          );
          const unique = [...new Set(allModels)];
          setRuntimeModels(unique);
          if (!modelId && unique.length) setModelId(unique[0]);
        })
        .catch(() => {});
    }
    if (desktop && window.electronAPI?.getLocalModels) {
      window.electronAPI
        .getLocalModels()
        .then((registry) => {
          const values = Object.keys(registry || {});
          setLocalModels(values);
          if (!modelId && values.length) setModelId(values[0]);
        })
        .catch(() => {});
    }
    if (desktop && window.electronAPI?.onDownloadProgress) {
      window.electronAPI.onDownloadProgress((payload) => {
        if (!payload) return;
        setDownloadProgress(payload);
      });
    }
    if (
      desktop &&
      (window.electronAPI?.getPeers || window.electronAPI?.getPeerHealth)
    ) {
      refreshNetwork();
      const intervalId = setInterval(() => {
        refreshNetwork();
      }, 2000);
      return () => clearInterval(intervalId);
    }
  }, []);

  const mergedLocalModels = Array.from(
    new Set([...localModels, ...runtimeModels]),
  );
  const modelOptions = mergedLocalModels.length
    ? mergedLocalModels.map((value) => ({
        value,
        label: value.includes("/") ? value.split("/").slice(-1)[0] : value,
      }))
    : models;

  const networkModels = useMemo(() => {
    return Object.keys(modelIndex || {})
      .map((key) => key.replace("model:", ""))
      .filter(Boolean);
  }, [modelIndex]);

  const filteredLocalModels = useMemo(() => {
    if (!modelSearch.trim()) return modelOptions;
    const q = modelSearch.toLowerCase();
    return modelOptions.filter(
      (model) =>
        (model.value || "").toLowerCase().includes(q) ||
        (model.label || "").toLowerCase().includes(q),
    );
  }, [modelOptions, modelSearch]);

  const filteredNetworkModels = useMemo(() => {
    if (!modelSearch.trim()) return networkModels;
    const q = modelSearch.toLowerCase();
    return networkModels.filter((modelId) => modelId.toLowerCase().includes(q));
  }, [networkModels, modelSearch]);

  const initializeP2P = async () => {
    setStatus("Initializing P2P network...");
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        await window.electronAPI.initializeP2P();
        setStatus("Connected to P2P network. Ready to chat!");
      } else {
        setStatus(
          "Electron API not available. This should only run in the desktop app.",
        );
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const runModel = async (selectedModelId) => {
    setIsRunning(true);
    setStatus(`Loading ${selectedModelId}...`);

    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        const result = await window.electronAPI.runModel(selectedModelId, {
          runtime: selectedRuntime === "auto" ? null : selectedRuntime,
        });
        setStatus(`✅ ${result} - Ready for chatting!`);

        setChatMessages([
          {
            id: 1,
            role: "assistant",
            content: `Hello! I'm ${selectedModelId.split("/")[1] || selectedModelId}. I'm ready to chat with you. How can I help you today?`,
          },
        ]);
        setActiveFeatures({
          thinking: false,
          search: false,
        });
      } else {
        setStatus(`⚠️ Electron API not available.`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error.message || error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const fetchModelFromPeers = async (selectedModelId) => {
    setIsRunning(true);
    setStatus(`Fetching shards for ${selectedModelId} from peers...`);
    try {
      if (!window.electronAPI?.ensureModelFromShards) {
        setStatus("⚠️ Peer shard sync is only available in the desktop app.");
        return;
      }
      const result =
        await window.electronAPI.ensureModelFromShards(selectedModelId);
      if (result?.ok) {
        setStatus(`✅ Shards assembled at ${result.outputPath}`);
      } else {
        setStatus(`⚠️ ${result?.error || "Unable to assemble shards."}`);
      }
    } catch (error) {
      setStatus(`❌ Shard error: ${error.message || error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: inputMessage,
      features: { ...activeFeatures },
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setInputMessage("");

    try {
      if (activeFeatures.search) {
        setStatus(
          "Search mode is on. Using local knowledge (no live web access).",
        );
      }
      let response;
      if (typeof window !== "undefined" && window.electronAPI) {
        response = await window.electronAPI.sendMessage(
          modelId,
          inputMessage,
          activeFeatures,
        );
      } else {
        const featureContext = [];
        if (activeFeatures.thinking)
          featureContext.push("using deeper reasoning");
        if (activeFeatures.search) featureContext.push("performing web search");
        const contextStr =
          featureContext.length > 0 ? ` (${featureContext.join(" and ")})` : "";
        response = `I received your message: "${inputMessage}".${contextStr} This is a simulated response. In the full implementation, this would connect to the P2P network to get a real response from the AI model.`;
      }

      const aiId = Date.now() + 1;
      const responseText =
        typeof response === "string" ? response : response?.text;
      const responseMeta = typeof response === "string" ? null : response?.meta;
      if (responseMeta) setLastStats(responseMeta);
      setChatMessages((prev) => [
        ...prev,
        { id: aiId, role: "assistant", content: "" },
      ]);
      const tokens = String(responseText || "").split(" ");
      let index = 0;
      const interval = setInterval(() => {
        index += 1;
        const nextChunk = tokens.slice(0, index).join(" ");
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiId ? { ...msg, content: nextChunk } : msg,
          ),
        );
        if (index >= tokens.length) {
          clearInterval(interval);
        }
      }, 35);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleFileUpload = async (file, kind) => {
    if (!file) return;
    try {
      let response;
      if (typeof window !== "undefined" && window.electronAPI) {
        if (kind === "document")
          response = await window.electronAPI.uploadDocument(file);
        if (kind === "image")
          response = await window.electronAPI.uploadImage(file);
        if (kind === "video")
          response = await window.electronAPI.uploadVideo(file);
        if (kind === "audio")
          response = await window.electronAPI.uploadAudio(file);
      } else {
        response = `${kind} ${file.name} selected.`;
      }
      setStatus(response || `${kind} uploaded.`);
    } catch (error) {
      setStatus(`❌ Upload error: ${error.message || error}`);
    }
  };

  const handleRecordVoice = async () => {
    setIsRecording(true);
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        const transcription = await window.electronAPI.recordVoice();
        setInputMessage((prev) => `${prev} ${transcription}`.trim());
      } else {
        setTimeout(() => {
          setInputMessage((prev) =>
            `${prev} [Voice transcription simulated]`.trim(),
          );
        }, 800);
      }
    } catch (error) {
      console.error("Error recording voice:", error);
      setStatus(`❌ Voice error: ${error.message || error}`);
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white overflow-hidden">
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-[#2dd4bf] opacity-20 blur-[120px]"></div>
      <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-[#60a5fa] opacity-20 blur-[140px]"></div>
      <div className="relative flex h-screen overflow-hidden">
        <div className="w-72 bg-white/5 border-r border-white/10 flex flex-col backdrop-blur">
          <div className="p-4 border-b border-white/10">
            <div className="text-lg font-semibold">AccessLM</div>
            <div className="text-xs text-white/50">Desktop</div>
          </div>

          <div className="p-3">
            <button className="w-full bg-white text-black py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white/90">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                ></path>
              </svg>
              New Chat
            </button>
          </div>

          <div className="px-3 pb-2 flex gap-2">
            <button
              className={`flex-1 px-2 py-1 rounded text-xs ${activeTab === "chat" ? "bg-[#22d3ee] text-black" : "bg-white/10 hover:bg-white/20"}`}
              onClick={() => setActiveTab("chat")}
            >
              Chat
            </button>
            <button
              className={`flex-1 px-2 py-1 rounded text-xs ${activeTab === "models" ? "bg-[#22d3ee] text-black" : "bg-white/10 hover:bg-white/20"}`}
              onClick={() => setActiveTab("models")}
            >
              Models
            </button>
            <button
              className={`flex-1 px-2 py-1 rounded text-xs ${activeTab === "network" ? "bg-[#22d3ee] text-black" : "bg-white/10 hover:bg-white/20"}`}
              onClick={() => setActiveTab("network")}
            >
              Network
            </button>
          </div>

          <div className="px-3 pt-2 text-xs text-white/50">RECENT CHATS</div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="p-2 rounded hover:bg-white/10 cursor-pointer text-sm">
              Document Analysis
            </div>
            <div className="p-2 rounded hover:bg-white/10 cursor-pointer text-sm">
              Model Comparison
            </div>
            <div className="p-2 rounded hover:bg-white/10 cursor-pointer text-sm">
              Research Summary
            </div>
            <div className="p-2 rounded hover:bg-white/10 cursor-pointer text-sm">
              Code Review
            </div>
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">
                U
              </div>
              <div>
                <div className="font-medium">You</div>
                <div className="text-xs text-white/50">Local user</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-6 py-6 overflow-hidden">
          <div className="h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center px-4">
            <div className="flex items-center space-x-2 text-white/80 text-sm">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              <span>{status}</span>
            </div>
            <div className="ml-auto flex items-center space-x-2">
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="bg-black/40 text-white text-sm rounded px-2 py-1 border border-white/10"
              >
                {modelOptions.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => runModel(modelId)}
                disabled={isRunning}
                className="bg-white text-black text-sm px-3 py-1 rounded disabled:opacity-50 hover:bg-white/90"
              >
                {isRunning ? "Loading..." : "Load Model"}
              </button>
            </div>
          </div>

          {!isDesktopApp && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              You’re viewing the desktop UI in a browser. Download the app to
              enable model downloads and runtimes.
              <div className="mt-2">
                <a className="underline" href="/downloads">
                  Go to downloads
                </a>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60 mb-2">
                Hugging Face Model ID
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="e.g. TheBloke/Mistral-7B-v0.1-GGUF"
                  className="flex-1 bg-black/40 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#22d3ee] border border-white/10"
                  disabled={!isDesktopApp}
                />
                <button
                  className="bg-white text-black px-3 py-2 rounded hover:bg-white/90 text-sm disabled:opacity-50"
                  disabled={!isDesktopApp}
                  onClick={async () => {
                    if (!customModel.trim()) return;
                    if (window.electronAPI?.downloadModel) {
                      setStatus(`Downloading ${customModel}...`);
                      try {
                        const normalized = customModel.trim();
                        const runtimeHint =
                          selectedRuntime === "mlx" || /-mlx/i.test(normalized)
                            ? "mlx"
                            : undefined;
                        setDownloadProgress({
                          modelId: normalized,
                          percent: 0,
                          received: 0,
                          total: 0,
                        });
                        const result = await window.electronAPI.downloadModel(
                          normalized,
                          {
                            autoShard: true,
                            runtime: runtimeHint,
                          },
                        );
                        if (result?.type === "mlx") {
                          setStatus(
                            `✅ MLX model registered. It will download on first run.`,
                          );
                        } else {
                          setStatus(`✅ Downloaded ${customModel}`);
                        }
                        setLocalModels((prev) =>
                          prev.includes(normalized)
                            ? prev
                            : [...prev, normalized],
                        );
                        setRuntimeModels((prev) =>
                          prev.includes(normalized)
                            ? prev
                            : [...prev, normalized],
                        );
                        setModelId(normalized);
                      } catch (err) {
                        setStatus(`❌ Download failed: ${err.message || err}`);
                      }
                    } else {
                      setStatus("Download not available in this environment.");
                    }
                  }}
                >
                  Download
                </button>
                <button
                  className="bg-white/10 text-white px-3 py-2 rounded hover:bg-white/20 text-sm disabled:opacity-50"
                  disabled={!isDesktopApp}
                  onClick={() => {
                    if (!customModel.trim()) return;
                    fetchModelFromPeers(customModel.trim());
                  }}
                >
                  Fetch from peers
                </button>
                <button
                  className="bg-white/10 text-white px-3 py-2 rounded hover:bg-white/20 text-sm disabled:opacity-50"
                  disabled={!isDesktopApp}
                  onClick={() => {
                    if (customModel.trim()) setModelId(customModel.trim());
                  }}
                >
                  Use
                </button>
                <button
                  className="bg-white/10 text-white px-3 py-2 rounded hover:bg-white/20 text-sm disabled:opacity-50"
                  disabled={!isDesktopApp}
                  onClick={async () => {
                    if (!window.electronAPI?.importLocalModel) {
                      setStatus(
                        "Local import not available in this environment.",
                      );
                      return;
                    }
                    try {
                      const result = await window.electronAPI.importLocalModel(
                        customModel.trim(),
                      );
                      if (result?.ok) {
                        const nextModelId = result.modelId;
                        setLocalModels((prev) =>
                          prev.includes(nextModelId)
                            ? prev
                            : [...prev, nextModelId],
                        );
                        setModelId(nextModelId);
                        setStatus(`✅ Imported ${nextModelId}`);
                      }
                    } catch (err) {
                      setStatus(`❌ Import failed: ${err.message || err}`);
                    }
                  }}
                >
                  Import local
                </button>
              </div>
              <div className="mt-2 text-[11px] text-white/50">
                Downloads are stored in{" "}
                <span className="text-white/70">~/.accesslm/models/</span> and
                added to Local models automatically.
              </div>
              {downloadProgress &&
                downloadProgress.modelId === customModel.trim() && (
                  <div className="mt-3">
                    <div className="text-xs text-white/60 mb-1">
                      Downloading {downloadProgress.modelId}
                      {typeof downloadProgress.percent === "number"
                        ? ` • ${downloadProgress.percent}%`
                        : ""}
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-2 bg-[#22d3ee] transition-all"
                        style={{ width: `${downloadProgress.percent || 5}%` }}
                      />
                    </div>
                  </div>
                )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-white/60">Runtime</div>
                <button
                  className="text-xs text-white/60 hover:text-white"
                  onClick={() => setShowNotes((prev) => !prev)}
                  title="Important notes"
                >
                  i
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <select
                  value={selectedRuntime}
                  onChange={(e) => setSelectedRuntime(e.target.value)}
                  className="bg-black/40 text-white text-sm rounded px-2 py-2 border border-white/10"
                  disabled={!isDesktopApp}
                >
                  <option value="auto">Auto-detect</option>
                  <option value="ollama">Ollama</option>
                  <option value="lmstudio">LM Studio</option>
                  <option value="vllm">vLLM</option>
                  <option value="exo">EXO</option>
                  <option value="llamaCppPy">llama-cpp-python</option>
                  <option value="mlx">MLX</option>
                  <option value="llamaCpp">llama.cpp</option>
                </select>
                <div className="text-xs text-white/60">
                  {runtimeInfo
                    ? "Detected: " +
                        Object.entries(runtimeInfo)
                          .filter(([_, v]) => v.available)
                          .map(([k]) => k)
                          .join(", ") || "none"
                    : "Detecting..."}
                </div>
                {lastStats && (
                  <div className="ml-auto text-[11px] text-white/60 bg-black/40 border border-white/10 rounded px-2 py-1">
                    <div>
                      {lastStats.runtime || "runtime"} • {lastStats.latencyMs}ms
                    </div>
                    <div>{lastStats.tokens} tokens</div>
                  </div>
                )}
              </div>
              {showNotes && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/70 space-y-1">
                  <div>HF download expects GGUF files (e.g. ...-GGUF).</div>
                  <div>
                    On macOS, llama-cpp-python is auto-started when selected.
                  </div>
                  <div>
                    MLX is auto-started on port 8081 (override with
                    ACCESSLM_MLX_SERVER_CMD).
                  </div>
                  <div>llama.cpp works only if `llama-cli` is in PATH.</div>
                  <div>For Ollama, it uses the Ollama API directly.</div>
                  <div>
                    LM Studio / vLLM / EXO are OpenAI‑compatible endpoints (if
                    running).
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === "chat" && (
              <div className="h-full min-h-0 flex flex-col mt-4 rounded-3xl border border-white/10 bg-white/5">
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-[#22d3ee] text-black"
                            : "bg-black/40 text-white/80 border border-white/10"
                        }`}
                      >
                        <p>{msg.content}</p>
                        {msg.features &&
                          (msg.features.thinking || msg.features.search) && (
                            <div className="flex gap-1 mt-1">
                              {msg.features.thinking && (
                                <span className="text-xs bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded">
                                  Thinking
                                </span>
                              )}
                              {msg.features.search && (
                                <span className="text-xs bg-green-500/30 text-green-200 px-1.5 py-0.5 rounded">
                                  Search
                                </span>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 p-4">
                  <div className="rounded-3xl bg-white/5 border border-white/10 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === "Enter" && handleSendMessage()
                        }
                        placeholder="How can I help you today?"
                        className="flex-1 bg-transparent text-white placeholder:text-white/40 outline-none text-sm"
                      />
                      <button
                        onMouseDown={handleRecordVoice}
                        onMouseUp={() => setIsRecording(false)}
                        className={`h-9 w-9 rounded-full border border-white/20 flex items-center justify-center ${isRecording ? "bg-red-600 text-white" : "text-white/70 hover:bg-white/10"}`}
                        title="Record voice"
                        aria-label="Record voice"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                          ></path>
                        </svg>
                      </button>
                      <button
                        onClick={handleSendMessage}
                        className="h-9 w-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90"
                        title="Send"
                      >
                        ↑
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        className="h-8 w-8 rounded-full border border-white/20 text-white/70 hover:bg-white/10"
                        onClick={() => setShowUploads((prev) => !prev)}
                        title="Upload"
                      >
                        +
                      </button>
                      {showUploads && (
                        <div className="flex flex-wrap gap-2">
                          <label className="px-3 py-1.5 rounded-full border border-white/15 text-xs text-white/80 hover:bg-white/10 cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                              onChange={(e) =>
                                handleFileUpload(
                                  e.target.files?.[0],
                                  "document",
                                )
                              }
                            />
                            Doc
                          </label>
                          <label className="px-3 py-1.5 rounded-full border border-white/15 text-xs text-white/80 hover:bg-white/10 cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={(e) =>
                                handleFileUpload(e.target.files?.[0], "image")
                              }
                            />
                            Image
                          </label>
                          <label className="px-3 py-1.5 rounded-full border border-white/15 text-xs text-white/80 hover:bg-white/10 cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept="video/*"
                              onChange={(e) =>
                                handleFileUpload(e.target.files?.[0], "video")
                              }
                            />
                            Video
                          </label>
                          <label className="px-3 py-1.5 rounded-full border border-white/15 text-xs text-white/80 hover:bg-white/10 cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept="audio/*"
                              onChange={(e) =>
                                handleFileUpload(e.target.files?.[0], "audio")
                              }
                            />
                            Audio
                          </label>
                        </div>
                      )}
                      <button
                        className={`px-3 py-1.5 rounded-full text-xs border ${
                          activeFeatures.thinking
                            ? "bg-[#22d3ee] text-black border-[#22d3ee]"
                            : "border-white/15 text-white/70 hover:bg-white/10"
                        }`}
                        onClick={() =>
                          setActiveFeatures((prev) => ({
                            ...prev,
                            thinking: !prev.thinking,
                          }))
                        }
                      >
                        Thinking
                      </button>
                      <button
                        className={`px-3 py-1.5 rounded-full text-xs border ${
                          activeFeatures.search
                            ? "bg-emerald-400 text-black border-emerald-400"
                            : "border-white/15 text-white/70 hover:bg-white/10"
                        }`}
                        onClick={() =>
                          setActiveFeatures((prev) => ({
                            ...prev,
                            search: !prev.search,
                          }))
                        }
                      >
                        Search
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-center text-[11px] text-white/35">
                    AI-generated content may not be accurate.
                  </div>
                </div>
              </div>
            )}

            {activeTab === "models" && (
              <div className="p-4 mt-4 rounded-3xl border border-white/10 bg-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Available Models</h2>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      className={`px-2 py-1 rounded ${modelsTab === "local" ? "bg-white text-black" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
                      onClick={() => setModelsTab("local")}
                    >
                      Local
                    </button>
                    <button
                      className={`px-2 py-1 rounded ${modelsTab === "network" ? "bg-white text-black" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
                      onClick={() => setModelsTab("network")}
                    >
                      Network
                    </button>
                    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-1">
                      <svg
                        className="h-3.5 w-3.5 text-white/50"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      <input
                        type="text"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="Search"
                        className="w-52 bg-transparent text-white/80 text-xs focus:outline-none placeholder:text-white/40"
                      />
                    </div>
                  </div>
                </div>

                {modelsTab === "local" && (
                  <>
                    <div className="text-xs text-white/50 mb-2">
                      Local & downloaded
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredLocalModels.length === 0 && (
                        <div className="text-white/50 text-sm">
                          No local models detected yet.
                        </div>
                      )}
                      {filteredLocalModels.map((model) => (
                        <div
                          key={model.value}
                          className="bg-black/40 rounded-lg p-4 border border-white/10"
                        >
                          <h3 className="font-semibold">{model.label}</h3>
                          {model.size || model.ram ? (
                            <p className="text-sm text-white/60">
                              Size: {model.size || "—"} | RAM:{" "}
                              {model.ram || "—"}
                            </p>
                          ) : (
                            <p className="text-sm text-white/60">
                              {model.value}
                            </p>
                          )}
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => {
                                setModelId(model.value);
                                setActiveTab("chat");
                              }}
                              className="bg-white text-black text-sm px-3 py-1 rounded hover:bg-white/90"
                            >
                              Load Model
                            </button>
                            {localModels.includes(model.value) && (
                              <button
                                onClick={async () => {
                                  if (!window.electronAPI?.deleteLocalModel)
                                    return;
                                  const confirmed = window.confirm(
                                    `Delete local model ${model.label || model.value}?`,
                                  );
                                  if (!confirmed) return;
                                  const result =
                                    await window.electronAPI.deleteLocalModel(
                                      model.value,
                                    );
                                  if (result?.ok) {
                                    setLocalModels((prev) =>
                                      prev.filter((m) => m !== model.value),
                                    );
                                    setStatus(`🗑️ Deleted ${model.value}`);
                                  } else {
                                    setStatus(
                                      `⚠️ ${result?.error || "Unable to delete model."}`,
                                    );
                                  }
                                }}
                                className="bg-white/10 text-white text-sm px-3 py-1 rounded hover:bg-white/20"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {modelsTab === "network" && (
                  <>
                    <div className="text-xs text-white/50 mb-2">
                      Network (peer cache)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredNetworkModels.length === 0 && (
                        <div className="text-white/50 text-sm">
                          No network models indexed yet.
                        </div>
                      )}
                      {filteredNetworkModels.map((modelId) => (
                        <div
                          key={modelId}
                          className="bg-black/40 rounded-lg p-4 border border-white/10"
                        >
                          <h3 className="font-semibold">
                            {modelId.includes("/")
                              ? modelId.split("/").slice(-1)[0]
                              : modelId}
                          </h3>
                          <p className="text-sm text-white/60">{modelId}</p>
                          <button
                            onClick={() => {
                              setModelId(modelId);
                              setActiveTab("chat");
                            }}
                            className="mt-2 bg-white text-black text-sm px-3 py-1 rounded hover:bg-white/90"
                          >
                            Load Model
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "network" && (
              <div className="p-4 mt-4 rounded-3xl border border-white/10 bg-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Network Status</h2>
                  <div className="flex items-center gap-3 text-xs text-white/50">
                    {lastNetworkRefresh ? (
                      <span>
                        Updated{" "}
                        {Math.max(
                          1,
                          Math.round((Date.now() - lastNetworkRefresh) / 1000),
                        )}
                        s ago
                      </span>
                    ) : (
                      <span>Updating…</span>
                    )}
                    <button
                      className="rounded bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20"
                      onClick={() => refreshNetwork()}
                    >
                      Refresh
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                    <div className="text-xs text-white/50">Active Peers</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {peers.length || 0}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                    <div className="text-xs text-white/50">Shared Models</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {Object.keys(modelIndex || {}).length}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                    <div className="text-xs text-white/50">
                      Your Contributions
                    </div>
                    <div className="mt-1 text-base font-semibold text-white/80">
                      Auto-detected
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-white/50">
                  Peers below are discovered on your local network (LAN) using
                  mDNS.
                </div>
                <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
                  <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.6fr_0.6fr] gap-2 text-white/40 pb-2 border-b border-white/10">
                    <span>Peer</span>
                    <span>IP</span>
                    <span>Runtimes</span>
                    <span>Latency</span>
                    <span>Pin</span>
                  </div>
                  <div className="max-h-40 overflow-auto">
                    {peers.length === 0 && (
                      <div className="text-white/50 py-3">
                        No peers discovered yet.
                      </div>
                    )}
                    {peers.slice(0, 10).map((peer) => (
                      <div
                        key={`${peer.peer_id}-${peer.ip}`}
                        className="grid grid-cols-[1.4fr_1fr_0.8fr_0.6fr_0.6fr] gap-2 py-2 border-b border-white/5 last:border-b-0"
                      >
                        <div className="text-white/70">
                          {peer.peer_id?.slice(0, 10)}...
                        </div>
                        <div className="text-white/40">{peer.ip}</div>
                        <div className="text-white/40">
                          {peer.peerRuntimes?.join(", ") || "—"}
                        </div>
                        <div className="text-white/50">
                          {peer.latency_ms ? `${peer.latency_ms}ms` : "n/a"}
                        </div>
                        <div>
                          <button
                            className="rounded bg-white/10 px-2 py-0.5 text-[10px] hover:bg-white/20"
                            onClick={() => {
                              if (!window.electronAPI) return;
                              const action = peer.pinned
                                ? window.electronAPI.unpinPeer
                                : window.electronAPI.pinPeer;
                              action(peer)
                                .then(() =>
                                  window.electronAPI
                                    .getPeerHealth?.()
                                    .then(setPeers),
                                )
                                .catch(() => {});
                            }}
                          >
                            {peer.pinned ? "Pinned" : "Pin"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-white/50">
                  <span>Model availability cache</span>
                  {preferredPeer?.ip ? (
                    <span className="text-white/40">
                      Preferred peer: {preferredPeer.ip}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-white/50">
                  <button
                    className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
                    onClick={() => {
                      if (!window.electronAPI?.clearPreferredPeer) return;
                      window.electronAPI
                        .clearPreferredPeer(modelId)
                        .then(() => setPreferredPeer(null))
                        .catch(() => {});
                    }}
                  >
                    Clear preferred
                  </button>
                  <button
                    className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
                    onClick={() => {
                      if (!window.electronAPI?.clearCapabilities) return;
                      window.electronAPI
                        .clearCapabilities()
                        .then(() => setCapabilities({}))
                        .catch(() => {});
                    }}
                  >
                    Clear capabilities
                  </button>
                </div>
                <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
                  <div className="grid grid-cols-[1.6fr_0.4fr] gap-2 text-white/40 pb-2 border-b border-white/10">
                    <span>Model</span>
                    <span>Peers</span>
                  </div>
                  <div className="max-h-32 overflow-auto">
                    {Object.keys(modelIndex || {}).length === 0 && (
                      <div className="text-white/50 py-3">
                        No models indexed yet.
                      </div>
                    )}
                    {Object.keys(modelIndex || {})
                      .slice(0, 8)
                      .map((key) => (
                        <div
                          key={key}
                          className="grid grid-cols-[1.6fr_0.4fr] gap-2 py-2 border-b border-white/5 last:border-b-0"
                        >
                          <span className="text-white/70">
                            {key.replace("model:", "")}
                          </span>
                          <span className="text-white/40">
                            {modelIndex[key]?.length || 0}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="mt-4 text-xs text-white/50">
                  Peer capability cache
                </div>
                <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
                  <div className="grid grid-cols-[1.4fr_1fr] gap-2 text-white/40 pb-2 border-b border-white/10">
                    <span>Peer</span>
                    <span>Runtimes</span>
                  </div>
                  <div className="max-h-32 overflow-auto">
                    {Object.keys(capabilities || {}).length === 0 && (
                      <div className="text-white/50 py-3">
                        No capabilities cached yet.
                      </div>
                    )}
                    {Object.entries(capabilities || {})
                      .slice(0, 6)
                      .map(([peerId, info]) => (
                        <div
                          key={peerId}
                          className="grid grid-cols-[1.4fr_1fr] gap-2 py-2 border-b border-white/5 last:border-b-0"
                        >
                          <div className="text-white/70">
                            {peerId.slice(0, 10)}...
                          </div>
                          <div className="text-white/40">
                            {(info?.runtimes || []).join(", ") || "No runtimes"}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
