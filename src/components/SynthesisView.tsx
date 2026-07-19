import React, { useState, useEffect, useRef } from "react";
import { jsPDF } from 'jspdf';
const html2pdf = typeof window !== 'undefined' ? require('html2pdf.js') : null;
import { 
  FileText, Upload, Sparkles, AlertCircle, BookOpen, AlertTriangle,
  RotateCcw, CheckCircle2, Bookmark, ArrowRight, HelpCircle, 
  Camera, File, Copy, Save, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; 
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { CourseSynthesis, StudySession } from "../types";
import { resizeImage } from "../utils/imageResize";
import { fetchWithRetry } from "../utils/connectivity";

interface SynthesisViewProps {
  onSynthesisGenerated: (
    synthesis: CourseSynthesis, 
    sourceText: string,
    fileInfo?: { name: string; type: string; base64?: string; text?: string; }
  ) => void;
  activeSession: StudySession | null;
  onStartQuiz: () => void;
  onSaveToLibrary: (session: StudySession) => void;
  onCreateNewSession?: () => void;
  darkMode?: boolean;
}

const STEP_MESSAGES = [
  "Régulation anti-blocage du Coach IA (cooldown 4s)...",
  "Le Coach IA consulte votre document universitaire...",
  "Lecture invisible en arrière-plan par le Coach...",
  "Extraction de la structure et des formules scientifiques...",
  "Identification de la thématique centrale...",
  "Rédaction de la synthèse d'excellence par le Coach...",
  "Finalisation de votre fiche d'étude Boualot Book..."
];

interface SimpleFile {
  name: string;
  type: string;
}

const cleanScientificText = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\Delta_r\s*G\^\\circ/g, 'ΔrG°')
    .replace(/\\Delta_r\s*G/g, 'ΔrG')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\^\\circ\s*/g, '°')
    .replace(/\$K\^\\circ\$/g, 'K°')
    .replace(/K\^\\circ/g, 'K°')
    .replace(/\\cdot/g, '·')
    .replace(/\\ln/g, 'ln')
    .replace(/\\,/g, ' ')
    .replace(/\^{-1}/g, '⁻¹')
    .replace(/\\/g, '');
};

export default function SynthesisView({ 
  onSynthesisGenerated, 
  activeSession, 
  onStartQuiz,
  onSaveToLibrary,
  onCreateNewSession,
  darkMode = true
}: SynthesisViewProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | SimpleFile | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [unreadableMsg, setUnreadableMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Pre-load manual file inputs from library session
  useEffect(() => {
    if (activeSession?.sourceFile && !activeSession.synthesis) {
      if (activeSession.sourceFile.base64) {
        setFile({ name: activeSession.sourceFile.name, type: activeSession.sourceFile.type });
        setFileBase64(activeSession.sourceFile.base64);
        setText("");
      } else if (activeSession.sourceFile.text) {
        setText(activeSession.sourceFile.text);
        setFile(null);
        setFileBase64(null);
      }
    } else if (!activeSession?.synthesis) {
      setText("");
      setFile(null);
      setFileBase64(null);
    }
  }, [activeSession]);

  const startStepAnimation = () => {
    setCurrentStepIndex(0);
    if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    stepIntervalRef.current = setInterval(() => {
      setCurrentStepIndex((prev) => (prev < STEP_MESSAGES.length - 1 ? prev + 1 : prev));
    }, 1800);
  };

  const stopStepAnimation = () => {
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
  };

  const handleFileChange = (selectedFile: File) => {
    setError(null);
    setUnreadableMsg(null);
    if (!selectedFile.type.startsWith("image/") && !selectedFile.name.endsWith(".txt") && !selectedFile.type.includes("pdf")) {
      setError("Seulement les images, les photos de cours, fichiers PDF et fichiers de notes (.txt) sont acceptés.");
      return;
    }

    setFile(selectedFile);
    
    if (selectedFile.type.startsWith("image/")) {
      resizeImage(selectedFile)
        .then((base64) => {
          setFileBase64(base64);
        })
        .catch((err) => {
          console.error("Erreur de compression d'image:", err);
          const reader = new FileReader();
          reader.onload = (e) => {
            setFileBase64(e.target?.result as string);
          };
          reader.readAsDataURL(selectedFile);
        });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileBase64(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isStreaming) return;
    if (!text.trim() && !fileBase64) {
      setError("Veuillez saisir le texte de votre cours ou importer une photo/document.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setUnreadableMsg(null);
    setStreamedText("");
    setIsStreaming(true);
    startStepAnimation();

    try {
      const response = await fetchWithRetry("https://boualot-book.onrender.com/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          fileData: fileBase64,
          fileMime: file ? file.type : "application/pdf"
        })
      });

      if (!response.ok) {
        let errMsg = "Le serveur a retourné une erreur lors de la synthèse.";
        try {
          const errJson = await response.json();
          if (errJson && errJson.error) errMsg = errJson.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Le flux de réponse n'est pas lisible.");

      const decoder = new TextDecoder("utf-8");
      let done = false;
      let accumulatedText = "";
      let buffer = "";
      let hasReceivedFirstChunk = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          let boundary = buffer.indexOf("\n");
          while (boundary !== -1) {
            const line = buffer.substring(0, boundary).trim();
            buffer = buffer.substring(boundary + 1);

            if (line.startsWith("data: ")) {
              const dataStr = line.replace("data: ", "").trim();
              if (dataStr === "[DONE]") break;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.error) throw new Error(parsed.error);
                if (parsed.text) {
                  accumulatedText += parsed.text;
                  // On applique directement le nettoyage lors du streaming
                  setStreamedText(cleanScientificText(accumulatedText));

                  if (!hasReceivedFirstChunk) {
                    hasReceivedFirstChunk = true;
                    setIsLoading(false);
                    stopStepAnimation();
                  }
                }
              } catch (e: any) {
                if (e.message) throw e;
              }
            }
            boundary = buffer.indexOf("\n");
          }
        }
      }

      setIsStreaming(false);

      if (!accumulatedText.trim()) {
        throw new Error("Aucun texte n'a pu être généré par l'assistant.");
      }

      let titleStr = "Synthèse d'Excellence";
      const titleMatch = accumulatedText.match(/(?:^|\n)(?:#|\*\*|📌)\s*([^\n\*#📌:]+)/);
      if (titleMatch && titleMatch[1]) {
        titleStr = titleMatch[1].trim();
      } else if (file) {
        titleStr = file.name.replace(/\.[^/.]+$/, "");
      }

      const cleanedFinalText = cleanScientificText(accumulatedText);

      const synthesis: CourseSynthesis = {
        title: titleStr,
        plan: [],
        concepts: [],
        essential: [],
        markdownContent: cleanedFinalText
      };

      const fileInfo = file ? {
        name: file.name,
        type: file.type,
        text: cleanedFinalText
      } : text ? {
        name: "Notes collées",
        type: "text/plain",
        text: cleanedFinalText
      } : undefined;

      onSynthesisGenerated(synthesis, cleanedFinalText, fileInfo);
      setText("");
      setFile(null);
      setFileBase64(null);

    } catch (err: any) {
      setError(err.message || "Une erreur réseau est survenue. Veuillez réessayer.");
      setIsLoading(false);
      setIsStreaming(false);
      stopStepAnimation();
    }
  };

  const handleReset = () => {
    setText("");
    setFile(null);
    setFileBase64(null);
    setError(null);
    setUnreadableMsg(null);
    setStreamedText("");
  };

  const cleanMarkdownForClipboard = (md: string): string => {
    if (!md) return "";
    let clean = md;
    clean = clean.replace(/\$\$(.*?)\$\$/gs, "$1");
    clean = clean.replace(/\$(.*?)\$/g, "$1");
    clean = clean.replace(/^[\|\s\-\:\+]+$/gm, "");
    clean = clean.replace(/\|/g, "  ");
    clean = clean.replace(/^#\s+(.+)$/gm, "📌 === $1 ===\n");
    clean = clean.replace(/^##\s+(.+)$/gm, "🔬 $1\n");
    clean = clean.replace(/^###\s+(.+)$/gm, "👉 $1\n");
    clean = clean.replace(/^####\s+(.+)$/gm, "  • $1\n");
    clean = clean.replace(/^\s*#+\s+(.+)$/gm, "• $1");
    clean = clean.replace(/\*\*\*(.*?)\*\*\*/g, "$1");
    clean = clean.replace(/\*\*\((.*?)\*\*/g, "$1");
    clean = clean.replace(/\*(.*?)\*/g, "$1");
    clean = clean.replace(/__(.*?)__/g, "$1");
    clean = clean.replace(/_(.*?)_/g, "$1");
    clean = clean.replace(/~~(.*?)~~/g, "$1");
    clean = clean.replace(/```[a-z]*\n([\s\S]*?)```/gi, "$1");
    clean = clean.replace(/`(.*?)`/g, "$1");
    clean = clean.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
    clean = clean.replace(/^\s*[\-\*]\s+(.+)$/gm, "• $1");
    clean = clean.replace(/\n{3,}/g, "\n\n");
    return clean.trim();
  };

  const handleCopyToClipboard = () => {
    const element = document.getElementById("synthesis-rendered-content");
    let textToCopy = "";
    
    if (element) {
      textToCopy = element.innerText || element.textContent || "";
    }

    if (!textToCopy) {
      const rawText = activeSession?.synthesis?.markdownContent || streamedText;
      textToCopy = cleanMarkdownForClipboard(rawText);
    }
    
    if (textToCopy) {
      textToCopy = textToCopy
        .replace(/\n([<>=+\-–—→])/g, " $1")
        .replace(/([<>=+\-–—→])\n/g, "$1 ")
        .replace(/([A-Za-z0-9À-ÿ])\n([A-Za-z0-9À-ÿ])/g, "$1$2")
        .replace(/\n+/g, "\n")
        .replace(/\n\s*\n/g, "\n\n");

      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch((err) => {
        console.error("Erreur de copie :", err);
      });
    }
  };

  const handleSaveToFile = async () => {
    try {
      let rawSynthesis = activeSession && 'synthesis' in activeSession ? (activeSession as any).synthesis : "";
      let markdownText = "";

      if (typeof rawSynthesis === "string") {
        markdownText = rawSynthesis;
      } else if (rawSynthesis && typeof rawSynthesis === "object") {
        markdownText = rawSynthesis.markdownContent || rawSynthesis.content || rawSynthesis.text || rawSynthesis.markdown || streamedText;
      }

      if (!markdownText) markdownText = streamedText;
      markdownText = cleanScientificText(markdownText.replace(/\\n/g, '\n'));

      const sections = markdownText.split(/(?=### )/);
      const container = document.createElement('div');
      container.style.width = '1120px';
      container.style.backgroundColor = '#ffffff';

      sections.forEach((section, index) => {
        if (!section.trim()) return;

        let htmlContent = section
          .replace(/### (.*?)\n/g, '<h2 style="color: #e53e3e; font-size: 28px; font-weight: bold; margin-bottom: 20px;">$1</h2>')
          .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #2b6cb0;">$1</strong>')
          .replace(/\* (.*?)\n/g, '<li style="color: #2d3748; font-size: 20px; margin-bottom: 12px; line-height: 1.5;">$1</li>');

        htmlContent = htmlContent.replace(/(<li>.*?<\/li>)/gs, '<ul style="padding-left: 25px; list-style-type: disc;">$1</ul>');
        
        htmlContent = htmlContent.split('\n\n').map(p => {
          const trimmed = p.trim();
          if (trimmed.startsWith('<h2') || trimmed.startsWith('<ul')) return trimmed;
          return `<p style="color: #2d3748; font-size: 20px; margin-bottom: 12px; line-height: 1.5;">${trimmed}</p>`;
        }).join('');

        const slide = document.createElement('div');
        slide.className = 'pdf-slide';
        slide.style.width = '1120px';
        slide.style.height = '630px';
        slide.style.padding = '50px';
        slide.style.boxSizing = 'border-box';
        slide.style.fontFamily = '"Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        slide.style.position = 'relative';
        slide.style.backgroundColor = '#ffffff';
        
        if (index > 0) {
          slide.style.pageBreakBefore = 'always';
        }

        slide.innerHTML = `
          <div style="height: 100%; border: 2px solid #e2e8f0; padding: 30px; box-sizing: border-box; border-radius: 8px;">
            ${htmlContent}
            <div style="position: absolute; bottom: 25px; right: 50px; font-size: 14px; color: #a0aec0;">
              Boualot Book • Page ${index + 1}
            </div>
          </div>
        `;

        container.appendChild(slide);
      });

      const sessionTitle = activeSession && 'title' in activeSession ? (activeSession as any).title : 'Presentation';
      const fileName = `${sessionTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

      const options = {
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
      };

      await html2pdf().set(options).from(container).save();

      if (activeSession && typeof onSaveToLibrary === "function") {
        onSaveToLibrary(activeSession);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

    } catch (error) {
      console.error("Erreur lors de la génération du PDF de présentation :", error);
    }
  };

  return (
    <div className={`space-y-4 px-1 py-1 transition-colors duration-200 ${darkMode ? "text-slate-100" : "text-slate-800"}`} id="synthesis-widget-container">
      <AnimatePresence mode="wait">
        {/* State 1: Loading */}
        {isLoading && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`rounded-2xl p-6 shadow-xl border flex flex-col items-center justify-center text-center space-y-6 py-10 ${
              darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
            }`}
            id="synthesis-loading-state"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-indigo-500 animate-spin flex items-center justify-center" />
              <Sparkles className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            
            <div className="space-y-2 max-w-sm">
              <h3 className={`text-md font-bold ${darkMode ? "text-slate-100" : "text-slate-800"}`}>
                Analyse IA en cours
              </h3>
              <p className={`text-xs h-10 flex items-center justify-center font-medium ${darkMode ? "text-slate-300" : "text-slate-500"}`}>
                {STEP_MESSAGES[currentStepIndex]}
              </p>
            </div>

            <div className="w-full bg-slate-200/50 dark:bg-slate-800 h-2 rounded-full overflow-hidden max-w-xs relative shadow-inner">
              <motion.div 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full"
                animate={{ width: `${((currentStepIndex + 1) / STEP_MESSAGES.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </motion.div>
        )}

        {/* State 2: Unreadable Warning */}
        {!isLoading && unreadableMsg && (
          <motion.div 
            key="unreadable"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded-2xl p-6 border text-center space-y-4 ${
              darkMode ? "bg-slate-900 border-amber-500/30 text-amber-100" : "bg-amber-50 border-amber-200"
            }`}
            id="synthesis-unreadable-warning"
          >
            <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className={`text-md font-bold ${darkMode ? "text-white" : "text-slate-800"}`}>
              Source illisible ou incompatible
            </h3>
            <p className={`text-xs leading-relaxed max-w-md mx-auto ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
              {unreadableMsg}
            </p>
            <button 
              type="button"
              onClick={handleReset}
              className="mt-1 inline-flex items-center gap-2 bg-indigo-600 hover:bg-slate-700 text-white rounded-xl px-5 py-2.5 text-xs font-semibold transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Charger un autre document
            </button>
          </motion.div>
        )}

        {/* State 3: Document Upload / Form */}
        {!isLoading && !unreadableMsg && !activeSession?.synthesis && !streamedText && (
          <motion.form 
            key="input-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSubmit}
            className="space-y-4"
            id="synthesis-input-form"
          >
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
              className={`border-2 border-dashed rounded-2xl p-5 text-center transition cursor-pointer flex flex-col items-center justify-center gap-2.5 min-h-[140px] ${
                isDragOver 
                  ? "border-indigo-500 bg-indigo-600/5" 
                  : file 
                    ? "border-emerald-500 bg-emerald-500/5" 
                    : darkMode 
                      ? "border-slate-800 bg-slate-900/60 hover:bg-slate-900" 
                      : "border-slate-200 hover:bg-slate-50 bg-white"
              }`}
              id="dropzone-file-upload"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                className="hidden" 
                accept="image/*,.txt,application/pdf"
              />

              {file ? (
                <>
                  <div className="p-2.5 bg-emerald-500/10 rounded-full text-emerald-500">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className={`text-xs font-bold truncate max-w-[270px] ${darkMode ? "text-slate-100" : "text-slate-700"}`}>
                      {file.name}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Fichier prêt • Cliquer pour modifier</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-2 justify-center">
                    <span className="p-2.5 bg-indigo-600/10 text-indigo-400 rounded-xl flex items-center gap-1 font-semibold text-xs border border-indigo-500/10">
                      <Camera className="w-4 h-4" /> 📸 Prendre une Photo
                    </span>
                    <span className="p-2.5 bg-blue-600/10 text-blue-400 rounded-xl flex items-center gap-1 font-semibold text-xs border border-blue-500/10">
                      <File className="w-4 h-4" /> 📄 Importer un PDF
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Glissez-déposez vos cours ou cliquez sur un bouton ci-dessus</p>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <label className={`text-[11px] font-bold flex items-center gap-1.5 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                Ou collez votre cours :
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Collez le texte brut du cours universitaire..."
                className={`w-full h-24 text-xs p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-colors ${
                  darkMode 
                    ? "bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500" 
                    : "bg-white border-slate-200 text-slate-800 placeholder-slate-400"
                }`}
                id="course-raw-textarea"
              />
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs flex items-start gap-2" id="error-alert">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isStreaming}
              className={`w-full text-white font-bold text-xs rounded-xl py-3 shadow-md transition uppercase tracking-wider ${
                isLoading || isStreaming
                  ? "bg-slate-700/50 opacity-50 cursor-not-allowed text-slate-400"
                  : "bg-gradient-to-r from-indigo-600 to-blue-600 active:scale-[0.98] cursor-pointer"
              }`}
              id="submit-synthesis-button"
            >
              🚀 Synthétiser mon Cours ✨
            </button>
          </motion.form>
        )}

        {/* State 4: Streamed / Finished Results */}
        {!isLoading && !unreadableMsg && (activeSession?.synthesis || streamedText) && (
          <motion.div 
            key="synthesis-result"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
            id="synthesis-result-panel"
          >
            <div className="flex items-center justify-between">
              <button 
                onClick={() => {
                  handleReset();
                  if (onCreateNewSession) onCreateNewSession();
                }}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Nouveau cours
              </button>
              
              <div className="flex items-center gap-1.5">
                {copied && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Copié !
                  </span>
                )}
                {saved && (
                  <span className="text-[10px] bg-teal-500/10 text-teal-400 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Enregistré ! 📂
                  </span>
                )}
              </div>
            </div>

            <div className={`max-h-[340px] overflow-y-auto p-3.5 rounded-2xl border space-y-4 ${
              darkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-100 text-slate-800"
            }`} id="scrollable-synthesis-textbox">
              
              {isStreaming && (
                <div className="flex items-center gap-2 p-2 bg-indigo-500/10 text-indigo-400 rounded-xl text-[10px] font-bold animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>✍️ Votre Coach IA rédige la synthèse scientifique...</span>
                </div>
              )}

              <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed space-y-3 font-sans markdown-body" id="synthesis-rendered-content">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {cleanScientificText(activeSession?.synthesis?.markdownContent || streamedText)}
                </ReactMarkdown>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyToClipboard}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> Copier le texte
              </button>
              <button
                type="button"
                onClick={handleSaveToFile}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Exporter en Slide PDF
              </button>
              <button
                type="button"
                onClick={onStartQuiz}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" /> Vos cours 🚀
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}