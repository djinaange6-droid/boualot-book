import React, { useState, useEffect } from "react";
import { 
  BookOpen, Trophy, Brain, Library, Smartphone, Laptop, Sparkles, BookMarked,
  Layers, PlusCircle, Trash2, Calendar, FileText, Check, Award, Compass, ChevronRight,
  Moon, Sun, Search, AlertTriangle, HelpCircle, Eye, Image, FileBox, LogIn, LogOut, User, Loader2
} from "lucide-react";
import { CourseSynthesis, QuizQuestion, ChatMessage, StudySession } from "./types";
import SynthesisView from "./components/SynthesisView";
import QuizView from "./components/QuizView";
import CoachView from "./components/CoachView";
import OnboardingView from "./components/OnboardingView";
import { AnimatePresence } from "motion/react";
import { resizeImage } from "./utils/imageResize";
import { fetchWithRetry } from "./utils/connectivity";
import { auth, db } from "./firebase";
import AuthModal from "./components/AuthModal";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";



const DEMO_SESSION_TEXT = `Histoire de l'atome et physique quantique.
Le concept d'atome remonte à l'Antiquité grecque avec Démocrite (400 av. J.-C.), qui supposait que la matière était constituée de particules indivisibles nommées "atomos".
En 1897, J.J. Thomson découvre l'électron grâce à ses expériences sur les rayons cathodiques, proposant le modèle du "plum pudding" où des charges négatives sont plongées dans une sphère positive.
En 1911, Ernest Rutherford réalise sa célèbre expérience de la feuille d'or. Il bombarde une fine feuille d'or avec des particules alpha et constate que la grande majorité des particules traversent sans déviation, tandis que quelques-unes sont fortement déviées. Il en déduit que l'atome est essentiellement constitué de vide, avec un noyau central très dense et chargé positivement, autour duquel gravitent les électrons.
In 1913, Niels Bohr affine ce modèle en introduisant la quantification des orbites électroniques. Les électrons ne peuvent graviter que sur des niveaux d'énergie bien définis, sans émettre de rayonnement en dehors de ces transitions.
Enfin, la mécanique quantique moderne (Schrödinger, Heisenberg) remplace l'orbite précise de Bohr par la notion d'orbitale atomique, représentant la probabilité de présence de l'électron à un endroit donné.`;

export default function App() {
 const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
 
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  // Status states
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  
  // Selected responsive tab
  const [selectedMobileTab, setSelectedMobileTab] = useState<"dashboard" | "cours" | "quiz" | "coach" | "biblio">("dashboard");

  // Dark Mode State - Default to true for eye-friendly late-night study
  const [darkMode, setDarkMode] = useState<boolean>(true);
  // Search filter and custom delete confirmation states
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Welcome Onboarding Screen state - active on every fresh entry/reload
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);

  // Firebase auth & layout states
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
 

// Helper to save session to Firebase Cloud Firestore directly
  const saveSessionToCloud = async (userId: string, session: StudySession) => {
    try {
      const sessionRef = doc(db, "users", userId, "sessions", session.id);
      const sanitizedSourceFile = session.sourceFile ? {
        name: session.sourceFile.name || "",
        type: session.sourceFile.type || "",
        text: session.sourceFile.text || undefined,
        base64: undefined // Never send heavy base64 to cloudfirestore to prevent Quota issues
      } : undefined;

      const sanitizedSession = {
        id: session.id,
        courseName: session.courseName || "",
        date: session.date || "",
        synthesis: session.synthesis || null,
        quiz: session.quiz || null,
        quizAnswers: session.quizAnswers || null,
        sourceFile: sanitizedSourceFile || null
      };

      await setDoc(sessionRef, sanitizedSession);
    } catch (err) {
      console.error("Erreur de sauvegarde Firestore pour la session: " + session.id, err);
    }
  };

  // Helper to delete session from Firestore
  const deleteSessionFromCloud = async (userId: string, sessionId: string) => {
    try {
      const sessionRef = doc(db, "users", userId, "sessions", sessionId);
      await deleteDoc(sessionRef);
    } catch (err) {
      console.error("Erreur de suppression Firestore pour la session: " + sessionId, err);
    }
  };

  // 1. Initial local load plus real-time Auth State Monitoring
  useEffect(() => {
    // A. Local storage initial fallback
    const saved = localStorage.getItem("boualot_book_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) {
          const mostRecent = parsed[0];
          setActiveSession(mostRecent);
          setQuizQuestions(mostRecent.quiz || []);
        }
      } catch (e) {
        console.error("Failed to parse local library:", e);
      }
    }

    // B. Firebase Authentication Listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setIsSyncing(true);
        try {
          // Fetch user profile status
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setUserProfile(userDocSnap.data());
          } else {
            const defaultProfile = {
              email: user.email,
              statut: "Gratuit",
              quiz_du_jour: 0,
              max_quiz_gratuit: 3,
              dateInscription: new Date().toISOString()
            };
            await setDoc(userDocRef, defaultProfile);
            setUserProfile(defaultProfile);
          }

          // Fetch user's direct online courses library from Firestore
          const sessionsCol = collection(db, "users", user.uid, "sessions");
          const querySnapshot = await getDocs(sessionsCol);
          const cloudSessions: StudySession[] = [];
          querySnapshot.forEach((doc) => {
            cloudSessions.push(doc.data() as StudySession);
          });

          if (cloudSessions.length > 0) {
            cloudSessions.sort((a, b) => b.id.localeCompare(a.id));
            setSessions(cloudSessions);
            setActiveSession(cloudSessions[0]);
            setQuizQuestions(cloudSessions[0].quiz || []);
          }
        } catch (err) {
          console.error("Failed to fetch cloud sessions on connection:", err);
        } finally {
          setIsSyncing(false);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = async (user: any, profile: any) => {
    setCurrentUser(user);
    setUserProfile(profile);
    // When connect successfully, sync current local sessions up to user cloud storage
    if (sessions.length > 0) {
      for (const s of sessions) {
        await saveSessionToCloud(user.uid, s);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      setShowUserDropdown(false);
      alert("Déconnexion réussie ! Vos révisions locales restent accessibles.");
    } catch (err) {
      console.error("Sign out fail:", err);
    }
  };

  // Save general library update helper
  const saveSessionsToLocalStorage = (updatedSessions: StudySession[]) => {
    // Prune serialized sessions to keep localStorage usage extra-light and prevent QuotaLimitation exception
    const prunedSessions = updatedSessions.map((session) => {
      // If the session synthesis or quiz is already generated, we don't need the heavy raw file base64
      if (session.synthesis || (session.quiz && session.quiz.length > 0)) {
        if (session.sourceFile) {
          return {
            ...session,
            sourceFile: {
              ...session.sourceFile,
              base64: undefined // Safely delete heavy visual binary data
            }
          };
        }
      }
      return session;
    });

    setSessions(prunedSessions);

    try {
      localStorage.setItem("boualot_book_sessions", JSON.stringify(prunedSessions));
    } catch (e: any) {
      console.warn("Storage quota warning, performing aggressive cleanup of remaining base64 fields...");
      // Aggressive fallback to prevent crash: strip ALL base64 fields entirely
      const aggressivelyPruned = prunedSessions.map((session) => {
        if (session.sourceFile) {
          return {
            ...session,
            sourceFile: {
              ...session.sourceFile,
              base64: undefined
            }
          };
        }
        return session;
      });

      try {
        localStorage.setItem("boualot_book_sessions", JSON.stringify(aggressivelyPruned));
      } catch (errFallback) {
        console.error("Storage write definitely failed due to exceptional client-side browser disk pressure:", errFallback);
      }
    }

    // DIRECT SYNC WITH FIRESTORE
    if (auth.currentUser) {
      prunedSessions.forEach((s) => {
        saveSessionToCloud(auth.currentUser!.uid, s);
      });
    }
  };

  // Switch/Load past study session
  const handleSelectSession = (session: StudySession) => {
    setActiveSession(session);
    setQuizQuestions(session.quiz || []);
    setChatHistory([]); // Clear past temp chat
    setSelectedMobileTab("cours");
  };

  // Ask for deletion confirmation Dialog box
  const askDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(sessionId);
  };

  // Execute deletion when confirmed by student
  const confirmDeleteSession = () => {
    if (!deleteConfirmId) return;
    const sessionId = deleteConfirmId;
    const filtered = sessions.filter((s) => s.id !== sessionId);
    saveSessionsToLocalStorage(filtered);
    if (activeSession?.id === sessionId) {
      if (filtered.length > 0) {
        setActiveSession(filtered[0]);
        setQuizQuestions(filtered[0].quiz || []);
      } else {
        setActiveSession(null);
        setQuizQuestions([]);
      }
    }
    setDeleteConfirmId(null);
  };

  const cancelDeleteSession = () => {
    setDeleteConfirmId(null);
  };

  const manualFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleManualFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const isImage = selectedFile.type.startsWith("image/");
    const isText = selectedFile.name.endsWith(".txt") || selectedFile.type === "text/plain";

    const createSession = (base64Data?: string, textData?: string) => {
      const newSession: StudySession = {
        id: "session_" + Date.now(),
        courseName: selectedFile.name,
        date: new Date().toLocaleDateString("fr-FR"),
        sourceFile: {
          name: selectedFile.name,
          type: selectedFile.type,
          base64: base64Data,
          text: textData
        }
      };

      const updatedList = [newSession, ...sessions];
      saveSessionsToLocalStorage(updatedList);
      setActiveSession(newSession);
      setQuizQuestions([]);
      alert(`Le document "${selectedFile.name}" a été ajouté à votre bibliothèque avec succès ! 📂`);
    };

    if (isImage) {
      resizeImage(selectedFile)
        .then((base64) => {
          createSession(base64, undefined);
        })
        .catch((err) => {
          console.error("Erreur de compression d'image (Manuelle):", err);
          const reader = new FileReader();
          reader.onload = (event) => {
            createSession(event.target?.result as string, undefined);
          };
          reader.readAsDataURL(selectedFile);
        });
    } else if (isText) {
      const reader = new FileReader();
      reader.onload = (event) => {
        createSession(undefined, event.target?.result as string);
      };
      reader.readAsText(selectedFile);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        createSession(event.target?.result as string, undefined);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  // Create a brand new workspace session
  const handleCreateNewSession = () => {
    const newSession: StudySession = {
      id: "session_" + Date.now(),
      courseName: "Nouveau Cours",
      date: new Date().toLocaleDateString("fr-FR"),
    };
    setActiveSession(newSession);
    setQuizQuestions([]);
    setChatHistory([]);
    setSelectedMobileTab("cours");
  };

  // Called when SynthesisView outputs a valid course object
  const handleSynthesisGenerated = (
    newSynthesis: CourseSynthesis, 
    sourceText: string,
    fileInfo?: { name: string; type: string; base64?: string; text?: string; }
  ) => {
    const sessionId = activeSession?.id || "session_" + Date.now();
    const sessionName = newSynthesis.title || fileInfo?.name || "Cours Sans Titre";

    const updated: StudySession = {
      id: sessionId,
      courseName: sessionName,
      date: new Date().toLocaleDateString("fr-FR"),
      synthesis: newSynthesis,
      sourceFile: fileInfo ? {
        name: fileInfo.name,
        type: fileInfo.type,
        base64: undefined, // Immediately clean memory from bulky file base64 after synthesis
        text: fileInfo.text
      } : undefined
    };

    setActiveSession(updated);
    setQuizQuestions([]); // Reset quiz when course content is updated

    // Auto update/save immediately and automatically in general list
    const exists = sessions.some((s) => s.id === sessionId);
    let updatedList: StudySession[] = [];
    if (exists) {
      updatedList = sessions.map((s) => (s.id === sessionId ? updated : s));
    } else {
      updatedList = [updated, ...sessions];
    }
    saveSessionsToLocalStorage(updatedList);
  };

  // Reset Quiz module completely to allow uploading a new document
  const handleResetQuiz = () => {
    setQuizQuestions([]);
    if (activeSession) {
      const updatedSession: StudySession = {
        ...activeSession,
        quiz: undefined,
        quizAnswers: undefined,
      };
      setActiveSession(updatedSession);
      if (sessions.some((s) => s.id === activeSession.id)) {
        const updatedList = sessions.map((s) => (s.id === activeSession.id ? updatedSession : s));
        saveSessionsToLocalStorage(updatedList);
      }
    }
  };

  // Generate 30 questions based on active course context text
  const handleGenerateQuiz = async (renewSalt?: number) => {
    if (isQuizLoading) return;
    if (!activeSession) return;

    // Support instant upload quizzes that don't have synthesis object
    if (!activeSession.synthesis && activeSession.sourceFile) {
      return handleGenerateQuizFromSource(
        activeSession.sourceFile.text || "",
        activeSession.sourceFile.base64,
        activeSession.sourceFile.type,
        activeSession.sourceFile.name,
        renewSalt
      );
    }
    if (!activeSession.synthesis) return;
    
    setIsQuizLoading(true);
    try {
      // Cooldown delay for continuous stability
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Reconstitute the course context text for the model (prioritizing high-fidelity scientific markdown synthesis)
      const sourceText = activeSession.synthesis.markdownContent || `Cours Titre: ${activeSession.synthesis.title}\n\nPlan:\n${activeSession.synthesis.plan.join("\n")}\n\nConcepts:\n${activeSession.synthesis.concepts.map(c => `${c.word}: ${c.definition}`).join("\n")}\n\nEssentiel:\n${activeSession.synthesis.essential.join("\n")}`;

      // Récupérer les énoncés des questions existantes pour s'assurer que l'IA en génère d'autres
      const existingQuestions = quizQuestions.map(q => q.question);
      setQuizQuestions([]);
      if (activeSession) {
        setActiveSession({
          ...activeSession,
          quizAnswers: undefined
        });
      }

// 1. On ajoute "const response =" pour créer la variable
      const response = await fetchWithRetry("https://boualot-book.onrender.com/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText,
          courseTitle: activeSession.synthesis.title,
          excludeQuestions: existingQuestions,
          seed: Math.random(),
          renewSalt
        })
      }); // <-- Ne pas oublier de bien fermer ici avec });

      if (!response.ok) {
        let errMsg = "Erreur de génération du Quiz";
        try {
          const errJson = await response.json();
          if (errJson && errJson.error) {
            errMsg = errJson.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const questions: QuizQuestion[] = await response.json();
      setQuizQuestions(questions);

      // Save questions array inside active session object
      const updatedSession: StudySession = {
        ...activeSession,
        quiz: questions,
        quizAnswers: undefined // Remettre à zero les réponses pour les nouvelles questions
      };
      setActiveSession(updatedSession);

      // Update library list
      if (sessions.some((s) => s.id === activeSession.id)) {
        const updatedList = sessions.map((s) => (s.id === activeSession.id ? updatedSession : s));
        saveSessionsToLocalStorage(updatedList);
      }
    } catch (e: any) {
      console.error(e);
      alert("Une erreur est survenue lors de la création du Défi Quiz : " + e.message);
    } finally {
      setIsQuizLoading(false);
    }
  };

  // Generate 30 questions on-the-fly for Quiz Choice B (Autonomous extraction)
  const handleGenerateQuizFromSource = async (
    sourceText: string, 
    fileData?: string, 
    fileMime?: string, 
    fileName?: string,
    renewSalt?: number
  ) => {
    if (isQuizLoading) return;
    setIsQuizLoading(true);
    try {
      // Cooldown delay for continuous stability
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Récupérer les énoncés des questions existantes s'il y en a
      const existingQuestions = quizQuestions.map(q => q.question);
      setQuizQuestions([]);
      if (activeSession) {
        setActiveSession({
          ...activeSession,
          quizAnswers: undefined
        });
      }

      // Direct visual/text-to-IA bridge! Send raw file and text directly to the quiz endpoint on our fast server with automatic retries
      const quizResponse = await fetchWithRetry("https://boualot-book.onrender.com/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText,
          fileData,
          fileMime,
          courseTitle: fileName ? fileName.replace(/\.[^/.]+$/, "") : "Quiz Instantané",
          excludeQuestions: existingQuestions,
          seed: Math.random(),
          renewSalt
        })
      });

      if (!quizResponse.ok) {
        let errMsg = "Impossible de générer les questions de quiz.";
        try {
          const errJson = await quizResponse.json();
          if (errJson && errJson.error) {
            errMsg = errJson.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const questions: QuizQuestion[] = await quizResponse.json();
      setQuizQuestions(questions);

      // Construct a session centered on this Quiz
      const newSession: StudySession = {
        id: "session_" + Date.now(),
        courseName: fileName ? fileName.replace(/\.[^/.]+$/, "") + " (Quiz)" : "Défi Quiz Instantané",
        date: new Date().toLocaleDateString("fr-FR"),
        quiz: questions,
        sourceFile: fileName ? {
          name: fileName,
          type: fileMime || "application/octet-stream",
          base64: undefined, // Discard heavy base64 to protect localStorage limit
          text: sourceText
        } : undefined
      };

      setActiveSession(newSession);

      // Save directly and automatically in general list (without base64 for lightweight storage)
      const updatedList = [newSession, ...sessions];
      saveSessionsToLocalStorage(updatedList);
    } catch (e: any) {
      console.error(e);
      alert("Une erreur s'est produite lors de la génération autonome du Quiz : " + e.message);
    } finally {
      setIsQuizLoading(false);
    }
  };

  // Track selected quiz answers
  const handleSaveAnswers = (answers: Record<number, string>) => {
    if (!activeSession) return;
    const updatedSession = {
      ...activeSession,
      quizAnswers: answers
    };
    setActiveSession(updatedSession);
    if (sessions.some((s) => s.id === activeSession.id)) {
      const updatedList = sessions.map((s) => (s.id === activeSession.id ? updatedSession : s));
      saveSessionsToLocalStorage(updatedList);
    }
  };

  // Save current active session to persistent library
  const handleSaveToLibrary = (sessionToSave: StudySession) => {
    const exists = sessions.some((s) => s.id === sessionToSave.id);
    let newList: StudySession[] = [];
    if (exists) {
      newList = sessions.map((s) => (s.id === sessionToSave.id ? sessionToSave : s));
    } else {
      newList = [sessionToSave, ...sessions];
    }
    saveSessionsToLocalStorage(newList);
  };

  // Send interactive chat to Mon Coach IA (Version Stable)
  const handleSendCoachMessage = async (text: string, fileData?: string, fileMime?: string, fileName?: string) => {
    // If text is empty and a file is attached, fill text with a friendly default
    const messageText = text || `Analyse du document universitaire joint : ${fileName || "Nouveau fichier"}`;

    const userMsg: ChatMessage = {
      id: "msg_" + Date.now(),
      sender: "user",
      text: messageText,
      timestamp: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      attachedFile: fileData && fileMime && fileName ? {
        name: fileName,
        type: fileMime,
        base64: fileData
      } : undefined
    };

    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setIsCoachLoading(true);

    try {
      let courseContext = "";
      if (activeSession?.synthesis) {
        courseContext = `Cours Actuel: ${activeSession.synthesis.title}\nPlan: ${activeSession.synthesis.plan.join(", ")}\nConcepts: ${activeSession.synthesis.concepts.map(c => c.word).join(", ")}`;
      }

      const response = await fetchWithRetry("https://boualot-book.onrender.com/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: newHistory.map(m => ({ sender: m.sender, text: m.text })),
          courseContext,
          fileData,
          fileMime
        })
      });

      if (!response.ok) {
        let errMsg = "Problème de connexion avec le Coach IA.";
        try {
          const errJson = await response.json();
          if (errJson && errJson.error) {
            errMsg = errJson.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      
      const coachMsg: ChatMessage = {
        id: "msg_" + (Date.now() + 1),
        sender: "coach",
        text: data.reply,
        timestamp: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      };

      setChatHistory((prev) => [...prev, coachMsg]);

    } catch (e: any) {
      console.error(e);
      alert("Une erreur est survenue avec le Coach IA : " + e.message);
    } finally {
      setIsCoachLoading(false);
    }
  };

  // Helper to filter documents based on search query
  const filteredSessions = sessions.filter(session => 
    session.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (session.synthesis?.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
   if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthModal 
        isOpen={true} 
        onClose={() => {}} 
        onAuthSuccess={(currentUser) => setUser(currentUser)} 
        darkMode={darkMode} 
      />
    );
  }

  return (
    <div className={`w-screen h-[100dvh] transition-colors duration-200 font-sans flex flex-col overflow-hidden relative ${
      darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"
    }`} id="applet-master-root">
      
      <AnimatePresence mode="wait">
        {showOnboarding && (
          <OnboardingView 
            darkMode={darkMode}
            onComplete={() => {
              setShowOnboarding(false);
            }}
          />
        )}
      </AnimatePresence>
      
      {/* 1. TOP APP BAR HEADER */}
      <header className={`px-4.5 py-3 flex items-center justify-between shadow-xs sticky top-0 z-20 border-b flex-shrink-0 ${
        darkMode ? "bg-slate-900/90 border-slate-850/80 backdrop-blur-md" : "bg-white/90 border-slate-200/85 backdrop-blur-md"
      }`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSelectedMobileTab("dashboard")}
            className="flex items-center gap-2 text-left cursor-pointer active:scale-95 transition"
          >
            <div className="p-1.5 bg-gradient-to-tr from-indigo-600 to-blue-500 text-white rounded-xl shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-black text-sm tracking-tight font-display flex items-center gap-1">
                Boualot Book <span className="text-indigo-400 font-normal">📚</span>
              </h1>
            </div>
          </button>

          {/* USER ACCOUNT SIGN-IN / PROFILE HANDLER PLACED SMARTLY NEXT TO LOGO */}
          {currentUser ? (
            <div className="relative" id="user-header-dropdown-container">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className={`flex items-center gap-1.5 p-1 px-2.5 rounded-xl border text-[10px] font-bold transition cursor-pointer active:scale-95 ${
                  darkMode 
                    ? "bg-indigo-950/50 hover:bg-slate-800 border-indigo-550/20 text-indigo-300" 
                    : "bg-indigo-50 hover:bg-indigo-100 border-indigo-105 text-indigo-700"
                }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[9px] uppercase font-mono">
                  {currentUser.email ? currentUser.email[0] : "👤"}
                </div>
                <span className="max-w-[70px] truncate">{currentUser.email?.split("@")[0]}</span>
                {userProfile?.statut === "Premium" ? (
                  <span className="bg-amber-500 text-white text-[8px] font-extrabold px-1 rounded-sm uppercase tracking-wider">PRO</span>
                ) : (
                  <span className="opacity-60 text-[8px] border border-current px-1 rounded-sm uppercase tracking-wider font-normal">Gratuit</span>
                )}
              </button>

              {showUserDropdown && (
                <div className={`absolute left-0 mt-2 w-52 rounded-2xl shadow-xl border p-2 z-55 ${
                  darkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
                }`}>
                  <div className="px-2.5 py-2 border-b border-transparent mb-1">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Espace étudiant</p>
                    <p className="text-xs truncate font-bold mt-0.5">{currentUser.email}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">Status : {userProfile?.statut || "Gratuit"}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-xs font-semibold hover:bg-rose-500/10 hover:text-rose-455 text-slate-400 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Se déconnecter</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1.5 p-1 px-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-[10px] font-bold shadow-xs transition active:scale-95 cursor-pointer uppercase tracking-wider"
              id="header-btn-se-connecter"
            >
              <User className="w-3 h-3 text-indigo-250 animate-pulse" />
              <span>Se connecter</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Dark/light Mode Switcher */}
          <button 
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-xl border text-xs cursor-pointer transition active:scale-90 ${
              darkMode ? "bg-slate-850 border-slate-800 text-amber-400" : "bg-white border-slate-250 text-slate-650"
            }`}
            title={darkMode ? "Activer mode clair" : "Activer mode sombre"}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {/* Re-open Onboarding Guide */}
          <button 
            type="button"
            onClick={() => setShowOnboarding(true)}
            className={`p-2 rounded-xl border text-xs cursor-pointer transition active:scale-90 ${
              darkMode ? "bg-slate-850 border-slate-800 text-indigo-400" : "bg-white border-slate-250 text-slate-650"
            }`}
            title="Revoir le guide d'accueil"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. RESPONSIVE FULL SCREEN MAIN WORKSPACE VIEWPORT */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 relative flex flex-col max-w-3xl mx-auto w-full" id="mobile-viewport-scroller">
        
        {/* TAB 1: WELCOMING DASHBOARD (VISUAL 2x2 HOME SCREEN - OCCUPYING AVAILABLE SPACE FLUIDLY) */}
        {selectedMobileTab === "dashboard" && (
          <div className="flex-1 flex flex-col justify-between gap-5 animate-fade-in" id="mobile-dashboard-accueil">
            
            {/* Header/Greeting board */}
            <div className="text-center py-3 space-y-1 flex-shrink-0">
              <span className="text-4xl animate-bounce inline-block">👋</span>
              <h2 className="text-md font-black font-display leading-tight">
                Salut ! Prêt à bosser aujourd'hui ?
              </h2>
              <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-extrabold pb-1">
                Ton Bureau Boualot Book
              </p>
            </div>

            {/* Active Course Badge if loaded */}
            <div className="flex-shrink-0">
              {activeSession?.synthesis ? (
                <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-2.5 text-xs transition ${
                  darkMode ? "bg-indigo-500/10 border-indigo-550/20" : "bg-indigo-50 border-indigo-105 text-indigo-950"
                }`}>
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-xl">📖</span>
                    <div className="truncate">
                      <p className="font-bold truncate">{activeSession.synthesis.title}</p>
                      <p className="text-[9px] opacity-65 font-mono">Fiche active en cours de révision</p>
                    </div>
                  </div>
                  <span className="bg-indigo-600 text-white text-[9px] font-bold uppercase p-1 px-2.5 rounded-full font-mono">
                    ACTIF
                  </span>
                </div>
              ) : (
                <div className={`p-4 rounded-xl border text-center text-xs space-y-3 shadow-xs ${
                  darkMode ? "bg-slate-900 border-slate-850 text-slate-400" : "bg-white border-slate-200 text-slate-505"
                }`}>
                  <p className="font-medium text-[11px]">Aucun cours actif en ce moment.</p>
                  
                  {/* DEMO BUTTON instantly available right on Dashboard */}
                  <button
                    onClick={() => {
                      handleCreateNewSession();
                      setTimeout(() => {
                        const textarea = document.getElementById("course-raw-textarea") as HTMLTextAreaElement;
                        if (textarea) {
                          textarea.value = DEMO_SESSION_TEXT;
                          const changeEvent = new Event('input', { bubbles: true });
                          textarea.dispatchEvent(changeEvent);
                        }
                      }, 150);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2 px-4 font-bold text-xs active:scale-95 transition cursor-pointer shadow-sm mx-auto flex items-center gap-1.5"
                  >
                    ⚛️ Charger le cours de démo quantique
                  </button>
                </div>
              )}
            </div>

            {/* Interactive onboarding return button on dashboard layout */}
            <div className="flex justify-center -my-1">
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                className={`py-2 px-4.5 rounded-2xl border text-xs font-bold tracking-tight cursor-pointer transition active:scale-95 flex items-center gap-2 shadow-xs ${
                  darkMode ? "bg-slate-900 hover:bg-slate-850 border-indigo-500/15 text-indigo-400" : "bg-white hover:bg-slate-100 border-indigo-200 text-indigo-700"
                }`}
              >
                <Compass className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span>💡 Découvrir le guide d'accueil d'Onboarding</span>
              </button>
            </div>

            {/* 2x2 GRID LARGE VISUAL BUTTON CARDS (RESPONSIVE STRETCH & FLEX CENTERED) */}
            <div className="grid grid-cols-2 gap-3 flex-1 min-h-[220px] md:min-h-[300px]">
              
              {/* CARD 1: FLASH RESUME */}
              <div 
                onClick={() => setSelectedMobileTab("cours")}
                className="p-4 rounded-2xl border text-left transition cursor-pointer hover:scale-[1.02] active:scale-[0.98] flex flex-col justify-between bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-indigo-500/20 relative overflow-hidden shadow-lg shadow-indigo-600/5 min-h-[100px]"
              >
                <div className="p-2 bg-white/10 rounded-xl w-fit">
                  <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wide">Résumé Flash</h4>
                  <p className="text-[10px] text-indigo-100 mt-1">Générez des fiches en 1 clic</p>
                </div>
              </div>

              {/* CARD 2: BIBLIOTHEQUE */}
              <div 
                onClick={() => setSelectedMobileTab("biblio")}
                className="p-4 rounded-2xl border text-left transition cursor-pointer hover:scale-[1.02] active:scale-[0.98] flex flex-col justify-between bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-500/20 relative overflow-hidden shadow-lg shadow-emerald-600/5 min-h-[100px]"
              >
                <div className="p-2 bg-white/10 rounded-xl w-fit">
                  <Library className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wide">Bibliothèque</h4>
                  <p className="text-[10px] text-emerald-100 mt-1">Consultez vos sources & fiches</p>
                </div>
              </div>

              {/* CARD 3: DEFI QUIZ */}
              <div 
                onClick={() => setSelectedMobileTab("quiz")}
                className="p-4 rounded-2xl border text-left transition cursor-pointer hover:scale-[1.02] active:scale-[0.98] flex flex-col justify-between bg-gradient-to-br from-amber-600 to-orange-700 text-white border-amber-500/20 relative overflow-hidden shadow-lg shadow-amber-600/5 min-h-[100px]"
              >
                <div className="p-2 bg-white/10 rounded-xl w-fit">
                  <Trophy className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wide">Défi Quiz</h4>
                  <p className="text-[10px] text-amber-100 mt-1">Testez vos acquis en 30 Qs</p>
                </div>
              </div>

              {/* CARD 4: MON COACH IA */}
              <div 
                onClick={() => setSelectedMobileTab("coach")}
                className="p-4 rounded-2xl border text-left transition cursor-pointer hover:scale-[1.02] active:scale-[0.98] flex flex-col justify-between bg-gradient-to-br from-rose-600 to-purple-700 text-white border-rose-500/20 relative overflow-hidden shadow-lg shadow-rose-600/5 min-h-[100px]"
              >
                <div className="p-2 bg-white/10 rounded-xl w-fit">
                  <Brain className="w-5 h-5 text-rose-350" />
                </div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wide">Mon Coach IA</h4>
                  <p className="text-[10px] text-rose-100 mt-1">Conseils Feynman & Pomodoro</p>
                </div>
              </div>

            </div>

            {/* Micro academic credit line */}
            <p className="text-[9px] text-center opacity-40 font-mono mt-1 flex-shrink-0 uppercase py-1">
              Boualot Book • Propulsé par l'intelligence artificielle
            </p>
          </div>
        )}

        {/* TAB 2: FLASH RESUME FORMS & EXTRACTIONS */}
        {selectedMobileTab === "cours" && (
          <div className="animate-fade-in">
            <SynthesisView 
              onSynthesisGenerated={handleSynthesisGenerated}
              activeSession={activeSession}
              onStartQuiz={() => setSelectedMobileTab("quiz")}
              onSaveToLibrary={handleSaveToLibrary}
              onCreateNewSession={handleCreateNewSession}
              darkMode={darkMode}
            />
          </div>
        )}

        {/* TAB 3: SMARTPHONE SAVED SYSTEM OF SHELF LIBRARY */}
        {selectedMobileTab === "biblio" && (
          <div className="space-y-4 animate-fade-in" id="mobile-library-tab">
            
            <button
              onClick={() => manualFileInputRef.current?.click()}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 px-4 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer font-display uppercase tracking-wider"
            >
              <PlusCircle className="w-4 h-4" /> Ajouter un document ➕
            </button>
            <input 
              type="file" 
              ref={manualFileInputRef}
              onChange={handleManualFileAdd}
              className="hidden"
              accept="image/*,.txt,application/pdf"
            />

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une fiche..."
                className={`w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                  darkMode 
                    ? "bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500" 
                    : "bg-white border-slate-200 text-slate-805 placeholder-slate-400"
                }`}
              />
            </div>

            {/* Library list scroll section */}
            <div className="space-y-2">
              {filteredSessions.length === 0 ? (
                <div className={`text-center py-10 px-5 border-2 border-dashed rounded-2xl space-y-2 ${
                  darkMode ? "border-slate-850 text-slate-500" : "border-slate-200 text-slate-400"
                }`}>
                  <BookMarked className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
                  <p className="text-xs font-semibold">Aucune fiche trouvée</p>
                  <p className="text-[10px] leading-relaxed">Téléversez un cours ou écrivez un concept dans l'onglet "Flash".</p>
                </div>
              ) : (
                filteredSessions.map((item) => {
                  const isPdf = item.courseName.toLowerCase().includes("pdf");
                  const isImg = item.courseName.toLowerCase().includes("png") || item.courseName.toLowerCase().includes("jpg") || item.courseName.toLowerCase().includes("photo");
                  
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSession(item)}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition cursor-pointer ${
                        activeSession?.id === item.id 
                          ? "bg-indigo-650 text-white border-indigo-600 shadow-md scale-[1.01]" 
                          : darkMode 
                            ? "bg-slate-900 border-slate-850 hover:border-slate-800 text-slate-205" 
                            : "bg-white border-slate-150 hover:border-slate-250 text-slate-700"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 truncate">
                        {isPdf ? (
                          <FileBox className="w-4 h-4 mt-0.5 text-rose-500 flex-shrink-0" />
                        ) : isImg ? (
                          <Image className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${activeSession?.id === item.id ? "text-slate-100" : "text-indigo-500"}`} />
                        )}
                        
                        <div className="truncate">
                          <p className="text-xs font-bold font-display truncate pr-2">{item.courseName}</p>
                          <p className="text-[9px] opacity-75 flex items-center gap-1 font-mono mt-0.5">
                            <Calendar className="w-2.5 h-2.5" /> {item.date}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => askDeleteSession(item.id, e)}
                        className="p-1.5 rounded-lg transition flex-shrink-0 text-slate-400 hover:text-rose-500"
                        title="Supprimer la fiche"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DEFI QUIZ (30 QUESTIONS) */}
        {selectedMobileTab === "quiz" && (
          <div className="animate-fade-in">
            <QuizView 
              questions={quizQuestions}
              isLoading={isQuizLoading}
              onGenerateQuiz={handleGenerateQuiz}
              onGenerateQuizFromSource={handleGenerateQuizFromSource}
              activeSession={activeSession}
              onSaveAnswers={handleSaveAnswers}
              savedSessions={sessions}
              onSelectSession={handleSelectSession}
              onResetQuiz={handleResetQuiz}
              darkMode={darkMode}
            />
          </div>
        )}

        {/* TAB 5: COACH IA CONVERSATIONAL PANEL */}
        {selectedMobileTab === "coach" && (
          <div className="animate-fade-in flex flex-col h-[calc(100vh-14rem)] min-h-[350px]">
            <CoachView 
              chatHistory={chatHistory}
              onSendMessage={handleSendCoachMessage}
              isLoading={isCoachLoading}
              activeSession={activeSession}
            />
          </div>
        )}

      </main>

      {/* 3. BOTTOM ERGONOMICAL SECTIONS NAVIGATION BAR (ANCHORED AT THE ABSOLUTE BOTTOM) */}
      <nav className={`fixed bottom-0 left-0 right-0 border-t p-3 px-6 flex items-center justify-between backdrop-blur-md shadow-2xl z-30 h-16 ${
        darkMode ? "bg-slate-900/95 border-slate-850/80" : "bg-white/95 border-slate-200/85"
      }`}>
        <button
          onClick={() => setSelectedMobileTab("dashboard")}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all active:scale-95 ${
            selectedMobileTab === "dashboard" ? "text-indigo-400 scale-105 font-extrabold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="text-xl leading-none">🏠</span>
          <span className="text-[10px] tracking-tight font-medium">Accueil</span>
        </button>

        <button
          onClick={() => setSelectedMobileTab("cours")}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all active:scale-95 ${
            selectedMobileTab === "cours" ? "text-indigo-400 scale-105 font-extrabold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] tracking-tight font-medium font-display">Flash</span>
        </button>

        <button
          onClick={() => setSelectedMobileTab("biblio")}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all active:scale-95 ${
            selectedMobileTab === "biblio" ? "text-indigo-400 scale-105 font-extrabold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Library className="w-5 h-5" />
          <span className="text-[10px] tracking-tight font-medium font-display">Biblio</span>
        </button>

        <button
          onClick={() => setSelectedMobileTab("quiz")}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all active:scale-95 ${
            selectedMobileTab === "quiz" ? "text-indigo-400 scale-105 font-extrabold" : "text-slate-400 hover:text-slate-250"
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] tracking-tight font-medium font-display font-medium">Quiz</span>
        </button>

        <button
          onClick={() => setSelectedMobileTab("coach")}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all active:scale-95 ${
            selectedMobileTab === "coach" ? "text-indigo-400 scale-105 font-extrabold" : "text-slate-400 hover:text-slate-250"
          }`}
        >
          <Brain className="w-5 h-5" />
          <span className="text-[10px] tracking-tight font-medium font-display font-medium">Coach IA</span>
        </button>
      </nav>

      {/* 4. DIALOG POPUP OVERLAY */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-5 z-50 animate-fade-in" id="delete-dialog-overlay-mobile-native">
          <div className={`w-full max-w-[310px] p-5.5 rounded-2xl border text-center space-y-4 shadow-2xl ${
            darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"
          }`}>
            <div className="w-11 h-11 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto text-rose-500">
              <AlertTriangle className="w-5.5 h-5.5 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-sm font-display">Supprimer cette fiche ?</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Cette action détruira définitivement cette fiche de votre bibliothèque ainsi que les réponses enregistrées du questionnaire.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-1">
              <button
                type="button"
                onClick={cancelDeleteSession}
                className={`py-2 px-3 rounded-xl border transition cursor-pointer ${
                  darkMode ? "bg-slate-850 hover:bg-slate-800 border-slate-750 text-slate-300" : "bg-indigo-50 hover:bg-slate-200 border-slate-200 text-slate-600"
                }`}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDeleteSession}
                className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal popup */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        darkMode={darkMode} 
        onAuthSuccess={handleAuthSuccess} 
      />

    </div>
  );
}