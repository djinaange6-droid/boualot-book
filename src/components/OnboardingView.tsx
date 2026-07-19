import React from "react";
import { motion } from "motion/react";
import { 
  Sparkles, Trophy, Brain, Library, BookOpen, ChevronRight, GraduationCap, Compass, HelpCircle 
} from "lucide-react";

interface OnboardingViewProps {
  onComplete: () => void;
  darkMode: boolean;
}

export default function OnboardingView({ onComplete, darkMode }: OnboardingViewProps) {
  return (
    <motion.div
      initial={{ opacity: 1, x: 0 }}
      exit={{ x: "-100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className={`fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto px-6 py-8 md:px-12 md:py-16 ${
        darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
      id="onboarding-container"
    >
      {/* Decorative ambient blobs in background */}
      <div className="absolute top-0 left-1/4 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-80 h-80 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

      {/* Main content wrapper */}
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col justify-center space-y-8 md:space-y-12">
        
        {/* Top welcome brand */}
        <div className="text-center space-y-3">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring" }}
            className="inline-flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/20 rounded-full py-1.5 px-4.5 text-[10px] uppercase tracking-widest text-indigo-400 font-black"
          >
            <GraduationCap className="w-3.5 h-3.5 animate-pulse" />
            <span>Boualot Book • Compagnon Académique</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-5xl font-black font-display tracking-tight leading-none bg-gradient-to-r from-white via-indigo-100 to-indigo-400 bg-clip-text text-transparent"
          >
            Bienvenue sur <span className="text-indigo-500">Boualot Book</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`text-xs md:text-sm max-w-lg mx-auto leading-relaxed ${
              darkMode ? "text-slate-400" : "text-slate-600"
            }`}
          >
            L'excellence universitaire au bout des doigts. Transformez n'importe quel cours complexe en outils d'assimilation d'élite de manière instantanée.
          </motion.p>
        </div>

        {/* Modern Interactive Illustration with Motion & Lucide Icons */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="relative max-w-sm mx-auto w-full aspect-video rounded-3xl overflow-hidden border flex items-center justify-center shadow-2xl shadow-indigo-500/10 p-4 bg-gradient-to-b from-indigo-950/40 to-slate-900/40 border-indigo-500/15"
        >
          {/* Scientific Orbits / Tech backdrop */}
          <div className="absolute inset-0 border border-dashed border-indigo-500/10 rounded-full scale-75 animate-spin duration-[15s]" />
          <div className="absolute inset-0 border border-indigo-500/5 rounded-full scale-50" />
          
          {/* Floating UI mock widgets */}
          <div className="relative flex items-center gap-4">
            <motion.div 
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="p-3 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 shadow-md backdrop-blur-md"
            >
              <Sparkles className="w-6 h-6" />
            </motion.div>

            <motion.div 
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 4.5, delay: 0.5, ease: "easeInOut" }}
              className="p-4 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 shadow-md backdrop-blur-md scale-110"
            >
              <GraduationCap className="w-8 h-8 animate-bounce" />
            </motion.div>

            <motion.div 
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3.8, delay: 1, ease: "easeInOut" }}
              className="p-3 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 shadow-md backdrop-blur-md"
            >
              <Trophy className="w-6 h-6 animate-pulse" />
            </motion.div>
          </div>

          <div className="absolute bottom-2 font-mono text-[7px] text-indigo-450/60 uppercase tracking-widest text-center">
            Moteur cognitif actif • Mode universitaire
          </div>
        </motion.div>

        {/* The 4 core services briefly previewed - motivating visual list */}
        <div className="space-y-3.5 max-w-lg mx-auto w-full">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 text-center pb-1">
            4 modules d'apprentissage d'élite :
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 1. Résumé Flash */}
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className={`p-3.5 rounded-2xl border flex items-start gap-3.5 transition ${
                darkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-xs font-display">Résumé Flash</h4>
                <p className={`text-[10px] leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-550"}`}>
                  Fiches synthétiques ultra-structurées de vos cours et PDF complexes en un clin d'œil.
                </p>
              </div>
            </motion.div>

            {/* 2. Défi Quiz */}
            <motion.div 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className={`p-3.5 rounded-2xl border flex items-start gap-3.5 transition ${
                darkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl flex-shrink-0 mt-0.5">
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-xs font-display">Défi Quiz</h4>
                <p className={`text-[10px] leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-550"}`}>
                  30 questions universitaires ciblées pour valider vos connaissances en moins de 15s.
                </p>
              </div>
            </motion.div>

            {/* 3. Ton Coach IA */}
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className={`p-3.5 rounded-2xl border flex items-start gap-3.5 transition ${
                darkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl flex-shrink-0 mt-0.5">
                <Brain className="w-4 h-4 text-rose-400" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-xs font-display font-medium">Ton Coach IA</h4>
                <p className={`text-[10px] leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-550"}`}>
                  Un tuteur académique disponible à toute heure pour clarifier des cours complexes.
                </p>
              </div>
            </motion.div>

            {/* 4. Bibliothèque de Fiches */}
            <motion.div 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              className={`p-3.5 rounded-2xl border flex items-start gap-3.5 transition ${
                darkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl flex-shrink-0 mt-0.5">
                <Library className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-xs font-display">Bibliothèque</h4>
                <p className={`text-[10px] leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-550"}`}>
                  Mémoire d'apprentissage permanente. Vos synthèses stockées sans aucune surcharge.
                </p>
              </div>
            </motion.div>
          </div>
        </div>

      </div>

      {/* Persistent Proceed Footer */}
      <div className="mt-8 md:mt-12 text-center max-w-sm mx-auto w-full z-10">
        <motion.button 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          onClick={onComplete}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm py-4 px-6 rounded-2xl shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 transform active:scale-98 transition duration-200 cursor-pointer"
        >
          <span>Commencer l'étude sur Boualot Book</span>
          <ChevronRight className="w-4 h-4" />
        </motion.button>
        <p className="text-[10px] text-slate-500 mt-3 font-mono">
          Propulsé par Gemini 1.5 Flash • Haute Rigueur Académique
        </p>
      </div>

    </motion.div>
  );
}
