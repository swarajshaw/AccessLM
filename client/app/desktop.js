'use client';
import { useState, useEffect } from 'react';

export default function DesktopHome() {
  const [status, setStatus] = useState('Connecting to P2P network...');
  const [isRunning, setIsRunning] = useState(false);
  const [modelId, setModelId] = useState('TheBloke/Mistral-7B-v0.1-GGUF');
  const [chatMessages, setChatMessages] = useState([
    { id: 1, role: 'assistant', content: 'Welcome to AccessLM Desktop! I\'m ready to chat. How can I help you today?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [activeFeatures, setActiveFeatures] = useState({
    thinking: false,
    search: false
  });
  const [activeTab, setActiveTab] = useState('chat'); // chat, models, network

  const models = [
    { value: 'TheBloke/Mistral-7B-v0.1-GGUF', label: 'Mistral 7B', size: '4.2GB', ram: '8GB' },
    { value: 'TheBloke/Llama-3-8B-GGUF', label: 'Llama 3 8B', size: '5.2GB', ram: '8GB' },
    { value: 'TheBloke/Phi-3-mini-4k-instruct-GGUF', label: 'Phi-3 Mini', size: '2.7GB', ram: '6GB' },
    { value: 'TheBloke/Qwen1.5-7B-GGUF', label: 'Qwen 7B', size: '4.1GB', ram: '8GB' },
    { value: 'TheBloke/gemma-2-9b-it-GGUF', label: 'Gemma 2 9B', size: '5.5GB', ram: '10GB' },
  ];

  // Initialize P2P network on load
  useEffect(() => {
    initializeP2P();
  }, []);

  const initializeP2P = async () => {
    setStatus('Initializing P2P network...');
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.initializeP2P();
        setStatus('Connected to P2P network. Ready to chat!');
      } else {
        setStatus('Electron API not available.');
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const runModel = async (selectedModelId) => {
    setIsRunning(true);
    setStatus(`Loading ${selectedModelId}...`);

    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.runModel(selectedModelId);
        setStatus(`✅ ${result} - Ready for chatting!`);
        
        // Reset chat with new model
        setChatMessages([
          { 
            id: 1, 
            role: 'assistant', 
            content: `Hello! I'm ${selectedModelId.split('/')[1] || selectedModelId}. I'm ready to chat with you. How can I help you today?` 
          }
        ]);
        // Reset active features
        setActiveFeatures({
          thinking: false,
          search: false
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

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    // Add user message to chat
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage,
      features: { ...activeFeatures }
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    try {
      let response;
      if (typeof window !== 'undefined' && window.electronAPI) {
        response = await window.electronAPI.sendMessage(modelId, inputMessage, activeFeatures);
      } else {
        const featureContext = [];
        if (activeFeatures.thinking) featureContext.push('using deeper reasoning');
        if (activeFeatures.search) featureContext.push('performing web search');
        const contextStr = featureContext.length > 0 ? ` (${featureContext.join(' and ')})` : '';
        
        response = `I received your message: "${inputMessage}".${contextStr} This is a simulated response.`;
      }
      
      const aiResponse = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response
      };
      setChatMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}`
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <div className="w-16 bg-gray-800 flex flex-col items-center py-4 space-y-6">
        <button 
          className={`p-3 rounded-lg ${activeTab === 'chat' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
          onClick={() => setActiveTab('chat')}
          title="Chat"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
          </svg>
        </button>
        
        <button 
          className={`p-3 rounded-lg ${activeTab === 'models' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
          onClick={() => setActiveTab('models')}
          title="Models"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
          </svg>
        </button>
        
        <button 
          className={`p-3 rounded-lg ${activeTab === 'network' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
          onClick={() => setActiveTab('network')}
          title="Network"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center px-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm">{status}</span>
          </div>
          <div className="ml-auto flex items-center space-x-2">
            <select 
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="bg-gray-700 text-white text-sm rounded px-2 py-1"
            >
              {models.map(model => (
                <option key={model.value} value={model.value}>{model.label}</option>
              ))}
            </select>
            <button 
              onClick={() => runModel(modelId)}
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
            >
              {isRunning ? 'Loading...' : 'Load Model'}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' && (
            <div className="h-full flex flex-col">
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-100'
                    }`}>
                      <p>{msg.content}</p>
                      {msg.features && (msg.features.thinking || msg.features.search) && (
                        <div className="flex gap-1 mt-1">
                          {msg.features.thinking && (
                            <span className="text-xs bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded">Thinking</span>
                          )}
                          {msg.features.search && (
                            <span className="text-xs bg-green-500/30 text-green-200 px-1.5 py-0.5 rounded">Search</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-700 p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <button 
                    className={`px-2 py-1 rounded text-xs ${
                      activeFeatures.thinking 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    onClick={() => setActiveFeatures(prev => ({
                      ...prev,
                      thinking: !prev.thinking
                    }))}
                  >
                    Thinking
                  </button>
                  <button 
                    className={`px-2 py-1 rounded text-xs ${
                      activeFeatures.search 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    onClick={() => setActiveFeatures(prev => ({
                      ...prev,
                      search: !prev.search
                    }))}
                  >
                    Search
                  </button>
                </div>
                
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button 
                    onClick={handleSendMessage}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'models' && (
            <div className="p-4">
              <h2 className="text-xl font-bold mb-4">Available Models</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {models.map(model => (
                  <div key={model.value} className="bg-gray-800 rounded-lg p-4">
                    <h3 className="font-semibold">{model.label}</h3>
                    <p className="text-sm text-gray-400">Size: {model.size} | RAM: {model.ram}</p>
                    <button 
                      onClick={() => {
                        setModelId(model.value);
                        setActiveTab('chat');
                      }}
                      className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded"
                    >
                      Load Model
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'network' && (
            <div className="p-4">
              <h2 className="text-xl font-bold mb-4">Network Status</h2>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <span>Active Peers:</span>
                  <span className="font-semibold">247</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span>Shared Models:</span>
                  <span className="font-semibold">1,203</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Your Contributions:</span>
                  <span className="font-semibold">12 models</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}