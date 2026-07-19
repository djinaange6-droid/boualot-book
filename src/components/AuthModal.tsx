import React, { useState } from "react";
import { X, Mail, Lock, Loader2, Sparkles, BookOpen, Shield, ChevronRight, ArrowLeft } from "lucide-react";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  onAuthSuccess: (user: any, profile: any) => void;
}

export default function AuthModal({ isOpen, onClose, darkMode, onAuthSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Veuillez remplir tous les champs.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Le mot de passe doit contenir au moins 6 caractères.");
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Create secure account
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        // Automatically provision student profile in firestore
        const initialProfile = {
          email: user.email,
          statut: "Gratuit",
          quiz_du_jour: 0,
          max_quiz_gratuit: 3,
          dateInscription: new Date().toISOString()
        };

        await setDoc(doc(db, "users", user.uid), initialProfile);
        
        setSuccessMsg("Votre compte étudiant Boualot Book a été créé avec succès ! 🎉");
        setTimeout(() => {
          onAuthSuccess(user, initialProfile);
          onClose();
        }, 1500);

      } else {
        // Sign-in existing user
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        // Fetch student profile 
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        let profile = {
          email: user.email,
          statut: "Gratuit",
          quiz_du_jour: 0,
          max_quiz_gratuit: 3
        };

        if (docSnap.exists()) {
          profile = docSnap.data() as any;
        } else {
          // If profile doc missing, provision automatically
          await setDoc(docRef, profile);
        }

        setSuccessMsg("Heureux de vous revoir sur Boualot Book ! 🤗");
        setTimeout(() => {
          onAuthSuccess(user, profile);
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      console.error("Firebase auth incident:", err);
      let localizedError = "Échec de l'authentification. Identifiants incorrects ou déjà existants.";
      if (err.code === "auth/email-already-in-use") {
        localizedError = "Cette adresse email est déjà associée à un compte.";
      } else if (err.code === "auth/invalid-email") {
        localizedError = "Format d'adresse email invalide.";
      } else if (err.code === "auth/weak-password") {
        localizedError = "Le mot de passe est trop faible.";
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        localizedError = "Email ou mot de passe incorrect.";
      }
      setErrorMsg(localizedError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in" id="auth-modal-overlay">
      <div 
        className={`max-w-md w-full rounded-3xl shadow-2xl border flex flex-col overflow-hidden relative transition-all duration-300 transform scale-100 ${
          darkMode ? "bg-slate-900 border-indigo-500/15 text-slate-100" : "bg-white border-slate-100 text-slate-800"
        }`}
        id="auth-modal-container"
      >
        {/* Header background accents */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-500" />

        {/* Back Button */}
        <button
          onClick={onClose}
          className={`absolute top-5 left-5 px-2 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition active:scale-95 text-[11px] font-extrabold ${
            darkMode ? "hover:bg-slate-805 text-slate-350 bg-slate-850/40" : "hover:bg-slate-100 text-slate-600 bg-slate-50"
          }`}
          title="Retour"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour</span>
        </button>

        {/* Dismiss Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full cursor-pointer transition active:scale-90 ${
            darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
          }`}
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content main body */}
        <div className="p-6 md:p-8 space-y-6">
          
          {/* Branded Logo representation inside modal */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-gradient-to-tr from-indigo-600 to-blue-500 text-white rounded-2xl shadow-lg shadow-indigo-500/15 mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black font-display tracking-tight">
                {isSignUp ? "Créer un compte Boualot Book" : "Me connecter à Boualot Book"}
              </h2>
              <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-505"}`}>
                Accédez à vos résumés doctoraux et quiz n'importe où
              </p>
            </div>
          </div>

          {/* Form wrapper */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Input field label & wrapper: Email */}
            <div className="space-y-1.5">
              <label htmlFor="auth-email" className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                Adresse email universitaire
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@gmail.com"
                  className={`w-full text-xs pl-10 pr-4 py-3 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                    darkMode 
                      ? "bg-slate-850/60 border-slate-800 text-slate-100 placeholder-slate-500" 
                      : "bg-slate-50 border-slate-200 text-slate-805 placeholder-slate-400"
                  }`}
                  required
                />
              </div>
            </div>

            {/* Input field label & wrapper: Password */}
            <div className="space-y-1.5">
              <label htmlFor="auth-password" className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 caractères minimum"
                  className={`w-full text-xs pl-10 pr-4 py-3 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                    darkMode 
                      ? "bg-slate-850/60 border-slate-800 text-slate-100 placeholder-slate-500" 
                      : "bg-slate-50 border-slate-200 text-slate-805 placeholder-slate-400"
                  }`}
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* Feedback components */}
            {errorMsg && (
              <div className="p-3.5 rounded-2xl border bg-rose-500/10 border-rose-500/20 text-xs text-rose-400 font-medium flex items-start gap-2 animate-pulse">
                <span>⚠️</span>
                <p className="flex-1">{errorMsg}</p>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-2xl border bg-emerald-500/10 border-emerald-500/20 text-xs text-emerald-400 font-medium flex items-start gap-2">
                <span>✅</span>
                <p className="flex-1">{successMsg}</p>
              </div>
            )}

            {/* Action Buttons Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Traitement en cours...</span>
                </>
              ) : (
                <>
                  <span>{isSignUp ? "Créer mon compte étudiant" : "Accéder à mon espace"}</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch link */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="text-xs font-bold text-indigo-400 hover:underline transition cursor-pointer"
            >
              {isSignUp ? "Déjà inscrit ? Connectez-vous ici" : "Pas encore de compte ? Créer mon espace gratuit"}
            </button>
          </div>

          {/* Academic Benefits details */}
          <div className={`p-4 rounded-2xl border border-dashed flex items-start gap-3 ${
            darkMode ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-200"
          }`}>
            <Shield className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wide">Espace Sécurisé de l'Étudiant</p>
              <p className={`text-[10px] leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-505"}`}>
                Votre connexion est cryptée. Vos fichiers de cours et statistiques de quiz sont automatiquement synchronisés en temps réel dès que vous cliquez sur "Enregistrer".
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
