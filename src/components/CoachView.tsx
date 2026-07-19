import React, { useState, useRef, useEffect } from "react";
import { 
  Send, Sparkles, MessageSquare, ShieldAlert, Brain, Coffee, Calendar, HelpCircle,
  Paperclip, Camera, X, FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatMessage, StudySession } from "../types";
import { resizeImage } from "../utils/imageResize";

interface CoachViewProps {
  chatHistory: ChatMessage[];
  onSendMessage: (text: string, fileData?: string, fileMime?: string, fileName?: string) => void;
  isLoading: boolean;
  activeSession: StudySession | null;
}

const COACH_SUGGESTIONS = [
  { text: "Appliquer la méthode Pomodoro ⏱️", value: "Comment puis-je intégrer la méthode Pomodoro pour réviser mon cours ?" },
  { text: "Répétition espacée 🔄", value: "Explique-moi comment planifier des séances de répétition espacée pour ne rien oublier." },
  { text: "Astuces anti-stress 🧘", value: "Je stresse pour mes examens, as-tu des techniques rapides de relaxation ?" },
  { text: "Méthode Feynman 🧠", value: "C'est quoi la méthode Feynman d'apprentissage et comment l'utiliser ?" },
  { text: "Résumer une notion complexe 💡", value: "Peux-tu m'expliquer une notion complexe de mon cours actuel avec une analogie simple ?" }
];

export default function CoachView({
  chatHistory,
  onSendMessage,
  isLoading,
  activeSession
}: CoachViewProps) {
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; base64: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat pane when new messages are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading]);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      resizeImage(file)
        .then((base64) => {
          setAttachedFile({
            name: file.name,
            type: file.type,
            base64
          });
        })
        .catch((err) => {
          console.error("Erreur de traitement de photo coach:", err);
          const reader = new FileReader();
          reader.onload = (event) => {
            setAttachedFile({
              name: file.name,
              type: file.type,
              base64: event.target?.result as string
            });
          };
          reader.readAsDataURL(file);
        });
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedFile({
          name: file.name,
          type: file.type,
          base64: event.target?.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const messageText = input.trim();
    
    // Allow sending just the attached document without companion text (using default prompt request)
    if (!messageText && !attachedFile) return;
    if (isLoading) return;

    onSendMessage(
      messageText,
      attachedFile?.base64,
      attachedFile?.type,
      attachedFile?.name
    );

    setInput("");
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSuggestionClick = (value: string) => {
    if (isLoading) return;
    onSendMessage(value);
  };

  return (
    <div className="flex flex-col h-[490px] bg-slate-50 rounded-2xl overflow-hidden border border-slate-100" id="coach-view-container">
      {/* Dynamic Header */}
      <div className="bg-gradient-to-r from-teal-600 to-indigo-600 p-3.5 px-4 text-white flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg text-teal-300">
            🤖
          </div>
          <div>
            <h3 className="font-bold text-xs font-display">Mon Coach IA</h3>
            <p className="text-[10px] text-teal-100 font-medium">Tuteur & Productivité H24</p>
          </div>
        </div>
        <div className="bg-white/10 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-sm">
          Actif
        </div>
      </div>

      {/* Dynamic Conversation Bubble Pane */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5"
        id="coach-chat-bubble-pane"
      >
        {chatHistory.length === 0 && (
          <div className="space-y-4 py-4 text-center">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1.5 max-w-xs mx-auto">
              <span className="text-[10px] bg-indigo-100/70 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-display">
                Incroyablement Utile
              </span>
              <p className="text-xs text-slate-700 font-medium">
                Bonjour ! Je suis Ton Coach IA, le tuteur universitaire disponible à tout instant.
              </p>
              <p className="text-[10px] text-slate-400">
                Joignez une photo, un PDF de cours, ou posez n'importe quelle question pour obtenir une analyse de niveau Enseignant-Chercheur !
              </p>
            </div>
          </div>
        )}

        {chatHistory.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div 
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {/* Bot Avatar */}
              {!isUser && (
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold font-display flex-shrink-0 mt-0.5">
                  🎓
                </div>
              )}
              
              <div className={`max-w-[80%] rounded-xl p-3 text-xs leading-relaxed shadow-sm ${
                isUser 
                  ? "bg-slate-800 text-white rounded-tr-none" 
                  : "bg-white text-slate-800 border border-slate-100 rounded-tl-none font-medium"
              }`}>
                {/* Visual Thumbnail representation within chat bubble */}
                {msg.attachedFile && (
                  <div className={`mb-2 p-2 rounded-lg flex items-center gap-2 border ${
                    isUser 
                      ? 'bg-slate-750 border-slate-700 text-slate-100' 
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    {msg.attachedFile.type.startsWith("image/") ? (
                      <img 
                        src={msg.attachedFile.base64} 
                        alt="Aperçu" 
                        className="w-12 h-12 object-cover rounded border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded flex items-center justify-center text-md font-bold">
                        📄
                      </div>
                    )}
                    <div className="overflow-hidden min-w-0 flex-1">
                      <p className="text-[10px] font-bold truncate">{msg.attachedFile.name}</p>
                      <p className="text-[8px] opacity-70 uppercase font-mono">{msg.attachedFile.type.split("/")[1] || "Document"}</p>
                    </div>
                  </div>
                )}
                <span className="whitespace-pre-line">{msg.text}</span>
                <span className="block text-[8px] text-right mt-1 opacity-60 font-mono">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}

        {/* Loading state indicator */}
        {isLoading && (
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold font-display flex-shrink-0 mt-0.5">
              🎓
            </div>
            <div className="bg-white border border-slate-100 rounded-xl rounded-tl-none p-3.5 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      {/* Suggestion list for easy quick replies */}
      <div className="bg-slate-100 border-t border-slate-200 overflow-x-auto whitespace-nowrap p-2 flex gap-1.5 scrollbar-thin">
        {COACH_SUGGESTIONS.map((sug, i) => (
          <button
            key={i}
            onClick={() => handleSuggestionClick(sug.value)}
            disabled={isLoading}
            className="text-[10px] bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 font-semibold border border-slate-200/60 rounded-full px-2.5 py-1 transition cursor-pointer flex-shrink-0 disabled:opacity-50"
          >
            {sug.text}
          </button>
        ))}
      </div>

      {/* Selected file preview inside Chat Bar */}
      {attachedFile && (
        <div className="bg-indigo-50 border-t border-indigo-100 px-3.5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {attachedFile.type.startsWith("image/") ? (
              <img 
                src={attachedFile.base64} 
                alt="Miniature" 
                className="w-8 h-8 object-cover rounded border border-indigo-200 shadow-xs" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded flex items-center justify-center text-xs font-bold font-mono">
                📄
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-indigo-950 truncate max-w-[200px]">{attachedFile.name}</p>
              <p className="text-[8px] text-indigo-600 uppercase font-bold">{attachedFile.type.split("/")[1] || "DOC"}</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={removeAttachedFile}
            className="p-1 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="p-2.5 bg-white border-t border-slate-200 flex gap-1.5 items-center">
        {/* Hidden genuine file selector */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept="image/*,application/pdf,text/plain"
        />

        <button
          type="button"
          onClick={handleFileClick}
          disabled={isLoading}
          title="Joindre un cours (PDF, Photo...)"
          className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-indigo-600 rounded-xl transition flex items-center justify-center flex-shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleFileClick}
          disabled={isLoading}
          title="Prendre une photo de vos notes"
          className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-indigo-600 rounded-xl transition flex items-center justify-center flex-shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Camera className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={attachedFile ? "Décrivez ce que le Coach doit analyser..." : "Posez une question, ou joignez un fichier..."}
          disabled={isLoading}
          className="flex-1 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition disabled:opacity-50"
          id="coach-user-input"
        />
        <button
          type="submit"
          disabled={(!input.trim() && !attachedFile) || isLoading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition flex items-center justify-center flex-shrink-0 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400"
          id="send-message-button"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
