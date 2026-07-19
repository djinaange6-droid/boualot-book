import React, { useState, useEffect, useRef } from "react";
import { 
  Award, RefreshCw, CheckCircle2, XCircle, ArrowRight, BookOpen, AlertCircle, 
  HelpCircle, Trophy, RefreshCcw, Landmark, Clock, ChevronRight, Check,
  Upload, Camera, File, FileText, Sparkles, RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { QuizQuestion, StudySession } from "../types";
import { resizeImage } from "../utils/imageResize";

interface QuizViewProps {
  questions: QuizQuestion[];
  isLoading: boolean;
  onGenerateQuiz: (renewSalt?: number) => void;
  onGenerateQuizFromSource?: (sourceText: string, fileData?: string, fileMime?: string, fileName?: string, renewSalt?: number) => Promise<void>;
  activeSession: StudySession | null;
  onSaveAnswers: (answers: Record<number, string>) => void;
  savedSessions?: StudySession[];
  onSelectSession?: (session: StudySession) => void;
  onResetQuiz?: () => void;
  darkMode?: boolean;
}

export default function QuizView({
  questions,
  isLoading,
  onGenerateQuiz,
  onGenerateQuizFromSource,
  activeSession,
  onSaveAnswers,
  savedSessions = [],
  onSelectSession,
  onResetQuiz,
  darkMode = true
}: QuizViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showFinished, setShowFinished] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // Switch between Choice A (Library) and Choice B (Instant Upload)
  const [activeChoiceTab, setActiveChoiceTab] = useState<"A" | "B">("A");

  // Choice B states
  const [inputText, setInputText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileBase64, setUploadedFileBase64] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize initial component state if activeSession contains pre-saved answers
  useEffect(() => {
    if (activeSession?.quizAnswers) {
      setSelectedAnswers(activeSession.quizAnswers);
    } else {
      setSelectedAnswers({});
      setCurrentIndex(0);
      setShowFinished(false);
    }
  }, [questions, activeSession]);

  const handleFileChange = (selectedFile: File) => {
    setImportError(null);
    if (!selectedFile.type.startsWith("image/") && !selectedFile.name.endsWith(".txt") && !selectedFile.type.includes("pdf")) {
      setImportError("Seulement les images, les photos de cours et les fichiers de notes (.txt / .pdf) sont acceptés.");
      return;
    }

    setUploadedFile(selectedFile);
    
    if (selectedFile.type.startsWith("image/")) {
      resizeImage(selectedFile)
        .then((base64) => {
          setUploadedFileBase64(base64);
        })
        .catch((err) => {
          console.error("Erreur de compression d'image (Quiz):", err);
          const reader = new FileReader();
          reader.onload = (e) => {
            setUploadedFileBase64(e.target?.result as string);
          };
          reader.readAsDataURL(selectedFile);
        });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedFileBase64(e.target?.result as string);
        setInputText(""); // Clear manual text to avoid printing raw binary PDF structures
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

  const handleLaunchChoiceB = async () => {
    setImportError(null);
    if (!inputText.trim() && !uploadedFileBase64) {
      setImportError("Veuillez charger une photo, un PDF ou coller votre cours.");
      return;
    }
    if (onGenerateQuizFromSource) {
      await onGenerateQuizFromSource(
        inputText,
        uploadedFileBase64 || undefined,
        uploadedFile ? uploadedFile.type : undefined,
        uploadedFile ? uploadedFile.name : undefined
      );
    }
  };

  const currentQuestion = questions[currentIndex];
  const isAnswered = selectedAnswers[currentQuestion?.id] !== undefined;
  const selectedOption = selectedAnswers[currentQuestion?.id];

  const handleOptionSelect = (optionKey: string) => {
    if (isAnswered) return; // Prevent changing answer once submitted

    const updatedAnswers = {
      ...selectedAnswers,
      [currentQuestion.id]: optionKey
    };
    setSelectedAnswers(updatedAnswers);
    onSaveAnswers(updatedAnswers);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setShowFinished(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Find missed questions
  const getMissedQuestions = () => {
    return questions.filter((q) => {
      const ans = selectedAnswers[q.id];
      return ans !== q.correctAnswer;
    });
  };

  // Score statistics
  const getScoreInfo = () => {
    let score = 0;
    questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctAnswer) {
        score += 1;
      }
    });

    const percent = Math.round((score / (questions.length || 1)) * 100);
    
    let title = "Assistant d'étude";
    let comment = "Continuez d'étudier pour maximiser vos résultats !";
    let color = "from-amber-500 to-orange-500";
    let emoji = "📚";

    if (percent === 100) {
      title = "Major de Promotion ! 👑";
      comment = "Excellentissime ! Un sans-faute digne d'un génie.";
      color = "from-yellow-400 to-amber-500 animate-pulse";
      emoji = "👑";
    } else if (percent >= 80) {
      title = "Mention Très Bien 🌟";
      comment = "Impressionnant ! Vous maîtrisez parfaitement le sujet.";
      color = "from-emerald-500 to-teal-500";
      emoji = "🌟";
    } else if (percent >= 60) {
      title = "Mention Assez Bien 👍";
      comment = "C'est validé ! Vous avez de très bonnes bases.";
      color = "from-blue-500 to-indigo-500";
      emoji = "🎓";
    } else {
      title = "Rattrapage nécessaire ✍️";
      comment = "Relisez bien la synthèse et discutez avec votre Coach IA pour vous améliorer.";
      color = "from-rose-500 to-red-650";
      emoji = "✍️";
    }

    return { score, percent, title, comment, color, emoji };
  };

  // Action 2 : Renouveler (relancer une génération sur le MÊME document avec de nouvelles questions)
  const handleRenewQuiz = () => {
    // 1. Crée une variable 'timestamp' contenant l'heure actuelle en millisecondes
    const salt = Date.now();

    // 2. Réinitialisation complète de l'état des réponses et de la progression de l'utilisateur
    setSelectedAnswers({});
    setCurrentIndex(0);
    setShowFinished(false);
    setQuizError(null);
    
    // 3. Déclenchement de la génération de nouvelles questions avec l'état de chargement (isLoading)
    if (activeSession && !activeSession.synthesis && activeSession.sourceFile && onGenerateQuizFromSource) {
      onGenerateQuizFromSource(
        activeSession.sourceFile.text || "",
        activeSession.sourceFile.base64,
        activeSession.sourceFile.type,
        activeSession.sourceFile.name,
        salt
      );
    } else {
      onGenerateQuiz(salt);
    }
  };

  // Action 1 : Nouveau Quiz (réinitialiser complètement pour téléverser un NOUVEAU document)
  const handleNewQuiz = () => {
    setSelectedAnswers({});
    setCurrentIndex(0);
    setShowFinished(false);
    setUploadedFile(null);
    setUploadedFileBase64(null);
    setInputText("");
    setActiveChoiceTab("B");
    if (onResetQuiz) onResetQuiz();
  };

  const handleSessionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedSessionId(id);
    if (onSelectSession) {
      const match = savedSessions.find(s => s.id === id);
      if (match) onSelectSession(match);
    }
  };

  return (
    <div className={`space-y-4 px-1 py-1 transition-colors duration-200 ${darkMode ? "text-slate-100" : "text-slate-800"}`} id="quiz-card-root">
      
      {/* 1. SELECTION SCREEN : NO ACTIVE EXAM QUESTIONS YET */}
      {!isLoading && questions.length === 0 && (
        <div 
          className={`p-5 md:p-6 border rounded-2xl space-y-5 ${
            darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          }`} 
          id="quiz-uninitialized-state"
        >
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto text-indigo-400 animate-pulse">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm font-display mt-2">Défi Quiz Universitaire</h3>
            <p className={`text-[11px] max-w-xs mx-auto leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Évaluez vos connaissances grâce à un test rigoureux de 30 questions rédigées sur mesure par l'IA.
            </p>
          </div>

          {/* Pill Switcher Tab (Choice A vs Choice B) */}
          <div className={`p-1 rounded-xl flex gap-1 border ${
            darkMode ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"
          }`} id="quiz-choice-tab-switcher">
            <button
              type="button"
              onClick={() => setActiveChoiceTab("A")}
              className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeChoiceTab === "A"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              📂 Option A : Document Sauvegardé
            </button>
            <button
              type="button"
              onClick={() => setActiveChoiceTab("B")}
              className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeChoiceTab === "B"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              ⚡ Option B : Source Instantanée
            </button>
          </div>

          {/* CHOPPING OPTIONS DISPLAY */}
          <AnimatePresence mode="wait">
            {activeChoiceTab === "A" ? (
              <motion.div
                key="choice-a-panel"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-4"
              >
                {/* Styled Dropdown select sheet */}
                <div className="space-y-1.5 text-left max-w-xs mx-auto">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Sélectionnez une fiche de cours :
                  </label>
                  <select
                    value={selectedSessionId || (activeSession ? activeSession.id : "")}
                    onChange={handleSessionChange}
                    className={`w-full text-xs p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 border transition-colors ${
                      darkMode 
                        ? "bg-slate-850 border-slate-800 text-white" 
                        : "bg-white border-slate-250 text-slate-850"
                    }`}
                  >
                    {!activeSession && <option value="">-- Choisissez un document --</option>}
                    {activeSession && (
                      <option value={activeSession.id}>
                        ✨ Cours Actif : {activeSession.synthesis?.title || activeSession.courseName}
                      </option>
                    )}
                    {savedSessions
                      .filter(s => s.id !== activeSession?.id)
                      .map((session) => (
                        <option key={session.id} value={session.id}>
                          📁 {session.synthesis?.title || session.courseName}
                        </option>
                      ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => onGenerateQuiz()}
                  disabled={!activeSession && !selectedSessionId}
                  className="w-full max-w-xs mx-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl py-3 shadow-md active:scale-[0.98] transition cursor-pointer font-display uppercase tracking-wider block"
                >
                  🚀 Lancer le Quiz (30 Questions)
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="choice-b-panel"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-4 text-left"
              >
                {/* Styled File Uploader Button for Choice B Quiz */}
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerFileSelect}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center transition cursor-pointer flex flex-col items-center justify-center gap-2.5 min-h-[120px] ${
                    isDragOver 
                      ? "border-indigo-500 bg-indigo-600/5" 
                      : uploadedFile 
                        ? "border-emerald-500 bg-emerald-500/5" 
                        : darkMode 
                          ? "border-slate-850 bg-slate-900/60 hover:bg-slate-905" 
                          : "border-slate-250 hover:bg-slate-50 bg-white"
                  }`}
                  id="choiceb-file-dropzone"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                    className="hidden" 
                    accept="image/*,.txt,application/pdf"
                  />

                  {uploadedFile ? (
                    <>
                      <div className="p-2 bg-emerald-500/10 rounded-full text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className={`text-[11px] font-bold truncate max-w-[250px] ${darkMode ? "text-slate-100" : "text-slate-700"}`}>
                          {uploadedFile.name}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Source prête • Cliquer pour modifier</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-1.5 justify-center">
                        <span className="p-2 bg-indigo-600/10 text-indigo-400 rounded-lg flex items-center gap-1 font-bold text-[10px] border border-indigo-500/10">
                          <Camera className="w-3.5 h-3.5" /> 📸 Photo
                        </span>
                        <span className="p-2 bg-blue-600/10 text-blue-400 rounded-lg flex items-center gap-1 font-bold text-[10px] border border-blue-500/10">
                          <File className="w-3.5 h-3.5" /> 📄 PDF
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">Glissez-déposez ou cliquez ici pour charger la source</p>
                    </>
                  )}
                </div>

                {/* Paste note option */}
                <div className="space-y-1">
                  <label className={`text-[10px] font-bold flex items-center gap-1 ${darkMode ? "text-slate-350" : "text-slate-600"}`}>
                    <FileText className="w-3 h-3 text-indigo-500" />
                    Ou collez le texte d'étude :
                  </label>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Collez le texte brut à évaluer..."
                    className={`w-full h-16 text-xs p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none transition-colors ${
                      darkMode 
                        ? "bg-slate-850 border-slate-800 text-slate-100" 
                        : "bg-white border-slate-200 text-slate-850"
                    }`}
                  />
                </div>

                {importError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-rose-700 text-[10px] flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                    <p>{importError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleLaunchChoiceB}
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl py-3 shadow-md active:scale-[0.98] transition cursor-pointer font-display uppercase tracking-wider text-center block"
                >
                  ⚡ Créer Quiz Instantané (30 Questions)
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 2. LOADING STATE */}
      {isLoading && (
        <div 
          className={`rounded-2xl p-6 border flex flex-col items-center justify-center text-center space-y-4 py-12 ${
            darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-md"
          }`} 
          id="quiz-loading-view"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-100/20 border-t-indigo-600 animate-spin" />
            <Sparkles className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Coach IA en action</span>
            <h3 className="text-sm font-bold font-display">Génération du Défi Quiz par le Coach IA...</h3>
            <p className={`text-xs max-w-xs mx-auto leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Le Coach IA analyse directement votre document en arrière-plan et formule instantanément un quiz de 30 questions de niveau universitaire (QCM/QCD).
            </p>
          </div>
        </div>
      )}

      {/* 3. ACTIVE QUIZ PLAYBACK */}
      {!isLoading && questions.length > 0 && !showFinished && currentQuestion && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3.5"
          id="quiz-active-interface"
        >
          {/* Top minimal progress info */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>Défi Quiz</span>
              <button
                type="button"
                onClick={handleRenewQuiz}
                className="text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-0.5 px-2 rounded-md flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
                title="Générer de nouvelles questions sur le même document"
              >
                <RefreshCcw className="w-2.5 h-2.5" /> Renouveler 🔄
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-bold">
                Question {currentIndex + 1} / {questions.length}
              </span>
              <button
                type="button"
                onClick={handleNewQuiz}
                className="text-[10px] bg-orange-600 hover:bg-orange-500 text-white font-extrabold py-0.5 px-2.5 rounded-md flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
                title="Vider et ajouter un nouveau document"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Nouveau Quiz
              </button>
            </div>
          </div>

          {/* Alerte Quiz déjà complété - Option de renouvellement */}
          {activeSession?.quizAnswers && Object.keys(activeSession.quizAnswers).length > 0 && (
            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-fade-in ${
              darkMode ? "bg-amber-500/10 border-amber-500/15 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"
            }`}>
              <div className="flex items-center gap-2 text-left w-full sm:w-auto">
                <span className="text-lg">✏️</span>
                <div>
                  <p className="font-bold text-[11px]">Fiche déjà répondue</p>
                  <p className="text-[9px] opacity-80 leading-tight">Vous pouvez réviser vos choix ci-dessous, ou renouveler entièrement.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRenewQuiz}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold p-1.5 px-3 rounded-lg active:scale-95 transition-all cursor-pointer text-[10px] whitespace-nowrap flex items-center gap-1 shadow-xs ml-auto sm:ml-0"
              >
                <RefreshCcw className="w-3 h-3" /> Renouveler Quiz
              </button>
            </div>
          )}

          {/* Thin Progress bar at the high top */}
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden" id="quiz-progression-panel">
            <div 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>

          {/* Question text panel */}
          <div className={`border rounded-2xl p-4.5 space-y-4 shadow-sm ${
            darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
          }`}>
            <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-2 py-0.5 font-display ${
              currentQuestion.type === "QCM" 
                ? "bg-blue-500/15 text-blue-400" 
                : "bg-purple-500/15 text-purple-400"
            }`}>
              {currentQuestion.type === "QCM" ? "Choix Multiples (QCM)" : "Vrai ou Faux (QCD)"}
            </span>

            <h3 className="font-bold text-xs leading-snug font-display">
              {currentQuestion.question}
            </h3>

            {/* Vertically stacked thumb-targeted options */}
            <div className="space-y-2">
              {Object.entries(currentQuestion.options || {}).map(([key, optionText]) => {
                if (!optionText || optionText === "N/A" || optionText.toLowerCase() === "empty") return null;

                const isSelected = selectedOption === key;
                const isCorrect = currentQuestion.correctAnswer === key;
                
                let buttonStyle = darkMode 
                  ? "border-slate-800 hover:bg-slate-800/50 bg-slate-850/60 text-slate-200" 
                  : "border-slate-200 hover:bg-slate-50 text-slate-700 bg-white";
                let badgeStyle = darkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600";
                let icon = null;

                if (isAnswered) {
                  if (isCorrect) {
                     buttonStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-300 font-bold";
                     badgeStyle = "bg-emerald-600 text-white";
                     icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
                  } else if (isSelected) {
                     buttonStyle = "border-rose-500 bg-rose-500/10 text-rose-300 font-bold";
                     badgeStyle = "bg-rose-500 text-white";
                     icon = <XCircle className="w-4 h-4 text-rose-400" />;
                  } else {
                     buttonStyle = "opacity-40 border-transparent";
                     badgeStyle = "opacity-40";
                  }
                } else {
                  if (isSelected) {
                    buttonStyle = "border-indigo-500 bg-indigo-500/10 text-indigo-300 font-bold";
                    badgeStyle = "bg-indigo-600 text-white";
                  }
                }

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleOptionSelect(key)}
                    disabled={isAnswered}
                    className={`w-full text-left p-3 text-xs rounded-xl border flex items-center justify-between gap-3 transition active:scale-[0.99] font-semibold ${buttonStyle} ${
                      !isAnswered ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold font-mono transition-colors ${badgeStyle}`}>
                        {key}
                      </span>
                      <span className="text-[11px] font-normal leading-tight">{optionText}</span>
                    </div>
                    {icon}
                  </button>
                );
              })}
            </div>

            {/* Pedagogical explanation block instantly below */}
            <AnimatePresence>
              {isAnswered && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className={`rounded-xl p-3 text-[11px] space-y-1 border ${
                    darkMode ? "bg-slate-850/50 border-slate-800 text-slate-350" : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  <p className="font-bold flex items-center gap-1 text-[10px] uppercase tracking-wider text-indigo-400">
                    <BookOpen className="w-3.5 h-3.5" /> Explication Pédagogique
                  </p>
                  <p className="leading-relaxed">{currentQuestion.explanation}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation Controls in Thumb Zone */}
          <div className="flex justify-between items-center pt-1">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="px-4 py-2.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-200 disabled:opacity-30 transition cursor-pointer disabled:cursor-not-allowed"
            >
              Précédent
            </button>

            <button
              onClick={handleNext}
              disabled={!isAnswered}
              className={`px-5 py-2.5 text-xs rounded-xl font-bold font-display shadow-sm cursor-pointer transition flex items-center gap-1.5 ${
                isAnswered 
                  ? "bg-indigo-600 text-white hover:bg-indigo-700" 
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              {currentIndex === questions.length - 1 ? "Terminer le Quiz" : "Question Suivante"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* 4. FINAL SCORECARD PANEL WITH MISSED QUESTIONS ACCORDION */}
      {showFinished && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-2xl p-5 border text-center space-y-4 shadow-lg max-w-sm mx-auto ${
            darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-800"
          }`}
          id="quiz-scoreboard-panel"
        >
          {/* Circular badge score visualization */}
          <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-tr ${getScoreInfo().color} flex flex-col items-center justify-center text-white shadow-md relative`}>
            <span className="text-xl font-extrabold leading-none">{getScoreInfo().score}</span>
            <span className="text-[10px] border-t border-white/30 pt-0.5 mt-0.5 block opacity-80">/ {questions.length}</span>
          </div>

          <div className="space-y-1">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display">Rapport de Score</h4>
            <h3 className="text-sm font-bold leading-tight font-display">
              {getScoreInfo().title}
            </h3>
            <p className="text-[10px] font-mono text-indigo-400">
              Soit {getScoreInfo().percent}% de réussite
            </p>
          </div>

          <p className={`text-xs leading-relaxed font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
            {getScoreInfo().comment}
          </p>

          {/* MISSED QUESTIONS CORRECTION LIST IN GREEN */}
          {getMissedQuestions().length > 0 && (
            <div className="text-left space-y-2 mt-4 pt-1 border-t border-slate-800">
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-[#f59e0b] block">
                🚨 Questions ratées & Corrections :
              </h4>
              <div className="max-h-[170px] overflow-y-auto space-y-2 pr-1" id="quiz-missed-questions-scroll">
                {getMissedQuestions().map((q, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-xl border text-[11px] space-y-1.5 ${
                      darkMode ? "bg-slate-850 border-slate-800" : "bg-slate-50 border-slate-150"
                    }`}
                  >
                    <p className="font-semibold text-[11px] text-slate-300">
                      Q : {q.question}
                    </p>
                    <p className="text-rose-400 flex items-center gap-1 font-medium">
                      ❌ Votre réponse : {selectedAnswers[q.id] || "Aucune"}
                    </p>
                    {/* Correction in vibrant Green */}
                    <p className="text-emerald-450 bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20 font-bold flex items-start gap-1">
                      <Check className="w-3.5 h-3.5 mt-0.5 text-emerald-450 flex-shrink-0" />
                      Correction : Réponse {q.correctAnswer} - {(q.options as any)?.[q.correctAnswer] || ""}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-normal pl-4 font-normal italic">
                      {q.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
               onClick={handleRenewQuiz}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl text-xs font-bold font-display shadow-md flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
            >
              <RefreshCcw className="w-3.5 h-3.5" /> Renouveler (Même document)
            </button>
            <button
               onClick={handleNewQuiz}
              className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl text-xs font-bold font-display shadow-md flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Nouveau Quiz (Nouveau document)
            </button>
          </div>
        </motion.div>
      )}

      {/* 5. FAILED TO GENERATE QUESTIONS (SITUATIONAL BACKUP) */}
      {!isLoading && activeSession?.synthesis && questions.length === 0 && (
        <div className="text-center p-8 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4" id="quiz-ready-to-generate-state">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full w-14 h-14 mx-auto flex items-center justify-center animate-bounce">
            <Award className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-xs mx-auto">
            <h3 className="font-bold text-slate-800 font-display text-sm">Le Défi Quiz est prêt !</h3>
            <p className="text-xs text-slate-500">
              Prêt à générer 30 questions uniques sur mesure pour évaluer votre apprentissage ?
            </p>
          </div>
          <button
            onClick={() => onGenerateQuiz()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl px-5 py-2.5 transition shadow cursor-pointer font-display"
          >
            Générer mon Quiz de 30 Questions ⚡
          </button>
        </div>
      )}
    </div>
  );
}
