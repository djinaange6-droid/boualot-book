import express from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.use(cors());

// Set up larger limit for document uploads (photos/PDF base64)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize the standard Gemini client
// User-Agent: 'aistudio-build' is required for telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Robust wrapper to perform generateContent calls with 429 auto-retry and a resilient fallback to gemini-3.1-flash-lite and gemini-flash-latest
async function generateContentWithFallback(params: {
  model: string;
  contents: any;
  config?: any;
}) {
  const modelsToTry = [params.model, "gemini-3.1-flash-lite", "gemini-flash-latest"];
  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model: currentModel,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = (err.message || "").toUpperCase();
        const errStatus = err.status || 0;
        
        const isRateLimit = 
          errStatus === 429 || 
          errMsg.includes("429") || 
          errMsg.includes("RESOURCE_EXHAUSTED") || 
          errMsg.includes("TOO MANY REQUESTS") || 
          errMsg.includes("QUOTA EXCEEDED");

        if (isRateLimit) {
          attempts++;
          if (attempts < maxAttempts) {
            let delayMs = 3500 * attempts; // baseline exponential delay
            
            // Extract proposed delay from Gemini API message, e.g. "Please retry in 9.981520312s"
            const matchSeconds = err.message?.match(/Please retry in (\d+(\.\d+)?)\s*s/i);
            if (matchSeconds && matchSeconds[1]) {
              const seconds = parseFloat(matchSeconds[1]);
              delayMs = Math.ceil(seconds * 1000) + 1200; // wait slightly longer to be absolutely sure
            } else {
              try {
                const detailMatch = err.message?.match(/"retryDelay"\s*:\s*"(\d+)\s*s"/i);
                if (detailMatch && detailMatch[1]) {
                  delayMs = (parseInt(detailMatch[1], 10) * 1000) + 1800;
                }
              } catch (_) {}
            }

            // Ingress proxy timeouts exist, so we shouldn't block a single HTTP request for too long (e.g. 45s+)
            if (delayMs > 45000) {
              console.warn(`[Gemini API 429] Necessary delay (${delayMs}ms) is too large for web server socket safety. Breaking attempts earlier.`);
              break;
            }

            console.warn(`[Gemini API 429] Rate limit hit on ${currentModel}. Retrying in ${delayMs / 1000} seconds (attempt ${attempts}/${maxAttempts})...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          }
        }
        
        // Non-rate limit errors or depleted attempts
        break;
      }
    }
    
    console.warn(`[Gemini API Fallback] Failed with model ${currentModel}. Trying next fallback...`);
  }
  
  throw lastError;
}

// Endpoint 1: COURSE SUMMARIZER (📌 Titre, 📝 Plan Global, 💡 Concepts Clés, 🚀 L'Essentiel à Retenir)
app.post("/api/synthesize", async (req, res) => {
  try {
    const { text, fileData, fileMime } = req.body;

    if (!text && !fileData) {
      return res.status(400).json({ error: "Aucun contenu ni fichier fourni pour la synthèse." });
    }

    // Prepare headers for Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const contentsParts: any[] = [];
    if (fileData) {
      const mime = fileMime || "application/pdf";
      const base64Data = fileData.split(",").pop() || fileData;
      console.log(`[Streaming Synthesis] Reading document file directly (Mime: ${mime})`);
      contentsParts.push({
        inlineData: {
          mimeType: mime,
          data: base64Data,
        },
      });
    }

    if (text) {
      contentsParts.push({ text: `Texte ou notes collés par l'étudiant:\n${text}` });
    }

    const systemInstruction = "Tu es le Coach IA, incarnant un Enseignant-Chercheur universitaire de haut niveau. Analyse directement et intégralement avec une rigueur scientifique absolue ce document (cours, exercices, formules). Ne le retranscris pas mot à mot sur l'écran. Rédige directement une synthèse scientifique extrêmement claire, structurée et pédagogique avec les notions et mots-clés essentiels en gras.\n\n" +
      "CONSIGNES SCIENTIFIQUES ULTRA-STRICTES POUR LES FORMULES :\n" +
      "1. Tu dois détecter, interpréter et retranscrire TOUTES les formules mathématiques (dérivées, intégrales, matrices, équations différentielles) et formules chimiques (formules brutes, développées, équations bilan de réactions).\n" +
      "2. Pour que ces formules s'affichent proprement et professionnellement à l'écran, utilise ABSOLUMENT la notation standard LaTeX :\n" +
      "   - Pour les équations ou formules isolées de grande taille (en bloc), entoure-les de doubles dollars, comme ceci : $$E = mc^2$$ ou $$\\Delta G = \\Delta H - T \\Delta S$$.\n" +
      "   - Pour les formules, variables ou symboles insérés au milieu du texte (en ligne), entoure-les d'un simple dollar, comme ceci : $x$, $\\theta$, $\\Delta$, ou $H_2O$.\n" +
      "3. Conserve l'intégralité de la ponctuation, des indices, des exposants, des flèches (\\rightarrow, \\rightleftharpoons), et des lettres grecques (\\alpha, \\beta, \\lambda, \\Delta) pour ne pas dénaturer le sens logique et la rigueur du cours.\n" +
      "4. Reste d'une précision chirurgicale sur les unités physiques et les coefficients stœchiométriques.\n" +
      "Ton retour doit être uniquement le résumé final rédigé avec rigueur.";

    console.log(`[Streaming Synthesis] Preparing streams...`);
    // Force gemini-1.5-flash with ultra-fast lightweight fallbacks to ensure completion under 15 seconds
    const modelsToTry = ["gemini-1.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let streamSuccess = false;
    let fallbackError: any = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`[Streaming Synthesis] Trying to start stream with ultra-fast Model: ${modelName}`);
        const stream = await ai.models.generateContentStream({
          model: modelName,
          contents: contentsParts,
          config: {
            systemInstruction,
            temperature: 0.65,
            maxOutputTokens: 1536, // Optimize output limits for instant performance under 15s
          },
        });

        let firstChunkParsed = false;
        try {
          for await (const chunk of stream) {
            const chunkText = chunk.text;
            if (chunkText) {
              if (!firstChunkParsed) {
                firstChunkParsed = true;
                streamSuccess = true;
                console.log(`[Streaming Synthesis] Successfully receiving chunks from Model: ${modelName}`);
              }
              res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }
          }
          if (streamSuccess) {
            break;
          }
        } catch (loopErr: any) {
          fallbackError = loopErr;
          console.warn(`[Streaming Synthesis] Error during stream processing with model ${modelName}:`, loopErr.message);
          if (firstChunkParsed) {
            throw loopErr;
          }
        }
      } catch (initErr: any) {
        fallbackError = initErr;
        console.warn(`[Streaming Synthesis] Error initializing stream with model ${modelName}:`, initErr.message);
      }
    }

    if (!streamSuccess) {
      throw fallbackError || new Error("Impossible d'initialiser le flux de synthèse avec les modèles disponibles.");
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("Erreur de flux de synthèse:", error);
    const errMsg = error.message || "Une erreur est survenue durant l'analyse.";
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
});

// Endpoint 2: QUIZ CREATOR (Exactly 30 questions)
app.post("/api/quiz", async (req, res) => {
  try {
    const { sourceText, courseTitle, fileData, fileMime, excludeQuestions, seed, renewSalt } = req.body;

    if (!sourceText && !fileData) {
      return res.status(400).json({ error: "Aucun cours ou texte de référence n'est disponible pour concevoir le quiz." });
    }

    // Exclusion instructions to ensure total novelty of questions
    let exclusionInstruction = "";
    if (excludeQuestions && Array.isArray(excludeQuestions) && excludeQuestions.length > 0) {
      exclusionInstruction = `\n\nCONSIGNE IMPORTANTE DE RENOUVELLEMENT : Tu DOIS générer un TOUT AUTRE EXERCICE complètement différent du précédent. Tu devez impérativement concevoir 30 questions totalement DIFFÉRENTES de celles-ci (ne réutilise ni le même énoncé, ni le même angle d'évaluation, ni les mêmes phrases du document) :\n${excludeQuestions.map((q) => `- ${q}`).join("\n")}\n\nVarie les notions abordées, explore d'autres chapitres, lignes, détails ou définitions du document pour que l'étudiant ait un test entièrement inédit.`;
    }

    if (renewSalt) {
      exclusionInstruction += `\n\n[ID DE RENOUVELLEMENT UNIQUE FORCE : ${renewSalt}] - Ce paramètre force la rupture totale avec les questions déjà générées. Explore de nouveaux horizons thématiques dans le texte fourni.`;
    }

    // Direct system instruction prompt as requested
    const systemInstruction = `Tu es le Coach IA de Boualot Book, l'unique moteur d'évaluation scientifique. Analyse instantanément ce fichier de cours ou document. Sans le recopier, génère directement un quiz de révision interactif. Base tes questions sur les concepts clés, les formules mathématiques, les réactions chimiques et les détails précis du document (en tenant compte de la ponctuation et des symboles exacts).

Génère de façon autonome exactement 30 questions à visée d'évaluation universitaire d'excellence. Après les réponses de l'étudiant, l'application calculera son score et fournira une correction guidée, brève et ultra-pédagogique pour chaque réponse afin de lui expliquer son erreur comme un tuteur particulier.

CONSIGNE DE FORMATAGE STRICTE :
Tu dois écrire exclusivement en français standard. N'utilise JAMAIS de caractères spéciaux complexes, de symboles mathématiques ou physiques rares, ni de balises de code complexes. Pour la mise en forme, utilise uniquement du texte brut et du Markdown très simple (comme des astérisques pour le gras **texte** ou des tirets pour les listes). Tous les accents français (é, è, à, ô, ç) doivent être écrits normalement, sans encodage bizarre.

Le quiz doit contenir un mélange équilibré de :
- Questions à Choix Multiples (QCM) avec 4 propositions (A, B, C, D) et une seule bonne réponse.
- Questions à Choix Doubles (QCD) de type Vrai ou Faux, où l'option A est "Vrai" et l'option B est "Faux" (les options C et D doivent alors être vides).

Pour chaque question, fournis obligatoirement :
- L'id (de 1 à 30).
- Le type de question: 'QCM' ou 'QCD'.
- L'énoncé de la question.
- Les options possibles. (Pour le vrai/faux, l'option A doit être "Vrai" et l'option B "Faux", C et D doivent être absentes ou vides).
- La bonne réponse sous forme de lettre (A, B, C ou D).
- Une correction pédagogique détaillée (l'explication) expliquant le rationnel.

Règles de génération :
1. Génère de façon 100% autonome exactement 30 questions de niveau universitaire. Pas moins, pas plus. S'il te plaît, numérote les ids de 1 à 30.
2. Tout doit être rédigé en français académique et accessible, mais rigoureux.
3. Reste RIGOUREUSEMENT fidèle aux faits du document d'origine. N'entreprends pas de hors-sujet.
4. Tu dois absolument varier les questions pour fournir un test alternatif renouvelé et totalement inédit. ${exclusionInstruction}

Graine d'entropie dynamique pour assurer la variété : ${seed || "Par défaut"}`;

    const contentsParts: any[] = [];
    if (fileData) {
      const mime = fileMime || "application/pdf";
      const base64Data = fileData.split(",").pop() || fileData;
      console.log(`[Quiz Instant Direct Call] Embedding document file directly (Mime: ${mime})`);
      contentsParts.push({
        inlineData: {
          mimeType: mime,
          data: base64Data,
        },
      });
    }

    if (sourceText) {
      contentsParts.push({ text: `Texte ou notes de cours fournis par l'étudiant:\n${sourceText}` });
    }

    contentsParts.push({ text: `Génère exactement le QCM/QCD interactif de 30 questions au format JSON conformément aux instructions définies.${exclusionInstruction}` });

    console.log(`[Quiz Direct Call] Launching fast generation with gemini-1.5-flash fallback pipeline`);
    const response = await generateContentWithFallback({
      model: "gemini-1.5-flash",
      contents: contentsParts,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: renewSalt ? 1.25 : 1.05,
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              type: { type: Type.STRING, description: "Le type de question: 'QCM' ou 'QCD'" },
              question: { type: Type.STRING, description: "L'énoncé de la question de cours." },
              options: {
                type: Type.OBJECT,
                properties: {
                  A: { type: Type.STRING },
                  B: { type: Type.STRING },
                  C: { type: Type.STRING },
                  D: { type: Type.STRING }
                },
                required: ["A", "B"]
              },
              correctAnswer: { type: Type.STRING, description: "La lettre de la bonne réponse: A, B, C ou D." },
              explanation: { type: Type.STRING, description: "Une explication courte et pédagogique de la correction." }
            },
            required: ["id", "type", "question", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });

    const quizQuestions = JSON.parse(response.text || "[]");
    res.json(quizQuestions);
  } catch (error: any) {
    console.error("Erreur de quiz:", error);
    const errMsg = (error.message || "").toUpperCase();
    const isRateLimit = 
      error.status === 429 || 
      errMsg.includes("429") || 
      errMsg.includes("RESOURCE_EXHAUSTED") || 
      errMsg.includes("TOO MANY REQUESTS") || 
      errMsg.includes("QUOTA EXCEEDED");

    if (isRateLimit) {
      let waitSeconds = "10";
      const matchSeconds = error.message?.match(/Please retry in (\d+(\.\d+)?)\s*s/i);
      if (matchSeconds && matchSeconds[1]) {
        waitSeconds = Math.ceil(parseFloat(matchSeconds[1])).toString();
      }
      return res.status(429).json({
        error: `⚠️ Les serveurs de l'Assistant Défi Quiz Boualot Book sont temporairement très demandés. S'il te plaît, attends environ ${waitSeconds} secondes avant de relancer l'analyse de tes questions.`
      });
    }

    res.status(500).json({ error: "Erreur lors de la génération du défi quiz : " + error.message });
  }
});

// Helper functions for RAG (Retrieval-Augmented Generation) & Smart Chunking
function chunkText(text: string, size = 1500, overlap = 200): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let index = 0;
  while (index < text.length) {
    chunks.push(text.substring(index, index + size));
    index += size - overlap;
  }
  return chunks;
}

function retrieveRelevantChunks(query: string, chunks: string[], topK = 4): string {
  if (chunks.length <= topK) return chunks.join("\n\n");
  
  const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  if (queryWords.length === 0) return chunks.slice(0, topK).join("\n\n");

  const scoredChunks = chunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    queryWords.forEach(w => {
      if (chunkLower.includes(w)) {
        score += 1;
      }
    });
    return { chunk, score };
  });

  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, topK).map(s => s.chunk).join("\n\n");
}

// Endpoint 3: IA COACH CHATBOT
app.post("/api/coach", async (req, res) => {
  try {
    const { message, history, courseContext, fileData, fileMime } = req.body;

    let transcribedText = "";
    let isFileAttached = false;

    // Step 1: Expert Transcription if a document or photo is sent inside the chat
    if (fileData && fileMime) {
      console.log(`[Coach Pipeline] User attached a file to chat (Mime: ${fileMime})`);
      isFileAttached = true;
      const transPrompt = `Tu es un transcripteur professionnel expert. Ton rôle est de lire le fichier fourni (qui est un PDF ou une photo de cours) et d'en extraire l'intégralité du texte.

Consignes strictes :
1. Transcris le cours en français, mot à mot, exactement comme il est écrit sur le document.
2. Conserve la structure d'origine (titres, paragraphes, listes).
3. Ne fais aucun résumé, aucune modification et n'ajoute aucun commentaire personnel. Renvoie uniquement le texte brut nettoyé et lisible.
4. Si le texte d'origine comporte des formules chimiques, géologiques ou mathématiques, retranscris-les le plus fidèlement possible.`;

      const transResponse = await generateContentWithFallback({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: fileMime,
              data: fileData.split(",").pop() || fileData,
            },
          },
          { text: transPrompt }
        ],
      });

      transcribedText = transResponse.text || "";
      console.log(`[Coach Pipeline] Transcription complete. Extracted ${transcribedText.length} characters.`);
    }

    const docContext = transcribedText || courseContext || "";
    let retrievedContext = "";

    // Step 2: RAG Retrieval if context exists and is long (keeps token counts optimally small!)
    if (docContext.trim().length > 0) {
      const chunks = chunkText(docContext);
      retrievedContext = retrieveRelevantChunks(message || "Synthèse Rapport Doctoral", chunks, 5);
      console.log(`[RAG Engine] Input context of size ${docContext.length} chunked into ${chunks.length} parts. Retrieved top relevant contexts.`);
    }

    // Step 3: Configure the Enseignant-Chercheur Academic System Instruction
    const systemInstruction = `Tu es "Mon Coach IA", l'assistant principal de l'application Boualot Book. Tu es une intelligence artificielle experte dans l'analyse, l'explication et la compréhension de n'importe quel type de fichiers numériques (PDF, DOCX, TXT, XLSX, CSV, PPTX, images JPG/PNG, fichiers audio ou vidéo décrits, code Python/JS/HTML/CSS/C/Java, archives ZIP, etc.). Tu possèdes la rigueur, la culture et la pédagogie d'un Enseignant-Chercheur et Docteur d'université.

CONSIGNE DE FORMATAGE STRICTE :
Tu dois écrire exclusivement en français standard. N'utilise JAMAIS de caractères spéciaux complexes, de symboles mathématiques ou physiques rares, ni de balises de code complexes. Pour la mise en forme, utilise uniquement du texte brut et du Markdown très simple (comme des astérisques pour le gras **texte** ou des tirets pour les listes). Tous les accents français (é, è, à, ô, ç) doivent être écrits normalement, sans encodage bizarre.

Fonctions principales :
- Détecter automatiquement le type de fichier fourni (texte, tableur, présentation, image, code, etc.).
- Extraire le contenu important et reconnaître le texte (OCR) avec précision sans jamais inventer une information absente du fichier.
- Détecter les tableaux, graphiques, erreurs ou codes informatiques complexes pour les expliquer simplement, étape par étape.
- Traduire, comparer, corriger ou synthétiser du contenu à la demande.
- Mémoriser fidèlement le contexte du document pendant toute la durée de la conversation.

Dès que l'étudiant t'envoie un fichier (PDF, image, photo de cours, code), peu importe sa taille, ton premier rôle est d'analyser son type, d'en extraire les données importantes et de générer automatiquement un "Rapport d'Analyse Doctoral" structuré ainsi :

1. 🔬 **THÉMATIQUE & PROBLÉMATIQUE CENTRALE** (Explique en quelques phrases le cœur du sujet traité par le document).
2. 📖 **SYNTHÈSE APPROFONDIE PAR AXES** (Divise ton analyse selon les grands chapitres ou concepts du document. Reste ultra-complet, cite les formules, les classifications, les mécanismes géologiques, chimiques ou biologiques essentiels. Ne vulgarise pas à l'excès, utilise le vocabulaire scientifique exact).
3. 💡 **GLOSSAIRE TECHNIQUE** (Définitions académiques et pédagogiques des mots-clés).
4. 📝 **ORIENTATIONS POUR L'EXAMEN** (Conseils sur les pièges classiques à éviter et les notions clés exigées lors d'une évaluation).

Une fois ce rapport généré, ou si l'étudiant te pose d'autres questions (ex: "Résume ce PDF", "Explique cette image", "Analyse ce tableau", "Explique ce code"), réponds de façon synthétique en environ 3 lignes de manière pédagogique, autonome, structurée et bienveillante, tout en lui prodiguant fréquemment des conseils de méthodologie d'apprentissage (ex: Pomodoro, méthode Feynman, cartes mentales) pour booster son rendement scolaire.`;

    const coachPrompt = isFileAttached 
      ? `Voici le cours transcrit :
${transcribedText}

Génère immédiatement le "Rapport d'Analyse Doctoral" structuré comme décrit dans tes consignes de base. ${message ? `De plus, prends en compte la remarque de l'étudiant : "${message}"` : ""}`
      : message;

    // Map the message history parameter to Gemini chat contents structure if available
    const geminiContents: any[] = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        geminiContents.push({
          role: msg.sender === "user" ? "user" : "model",
          parts: [{ text: msg.text }],
        });
      });
    }

    // Add retrieved context block as extra context hint if it's a specific question
    let userMsgText = "";
    if (retrievedContext) {
      userMsgText += `[RAG CONTEXT (Extraits pertinents du document) :\n${retrievedContext}]\n\n`;
    }
    userMsgText += coachPrompt;

    geminiContents.push({
      role: "user",
      parts: [{ text: userMsgText }],
    });

    const response = await generateContentWithFallback({
      model: "gemini-3.5-flash",
      contents: geminiContents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ 
      reply: response.text,
      transcribedText: transcribedText || undefined
    });
  } catch (error: any) {
    console.error("Erreur Coach IA (RAG):", error);
    const errMsg = (error.message || "").toUpperCase();
    const isRateLimit = 
      error.status === 429 || 
      errMsg.includes("429") || 
      errMsg.includes("RESOURCE_EXHAUSTED") || 
      errMsg.includes("TOO MANY REQUESTS") || 
      errMsg.includes("QUOTA EXCEEDED");

    if (isRateLimit) {
      let waitSeconds = "10";
      const matchSeconds = error.message?.match(/Please retry in (\d+(\.\d+)?)\s*s/i);
      if (matchSeconds && matchSeconds[1]) {
        waitSeconds = Math.ceil(parseFloat(matchSeconds[1])).toString();
      }
      return res.status(429).json({
        error: `⚠️ Mon Coach IA est en train d'aider d'autres étudiants de Boualot Book. S'il te plaît, patiente environ ${waitSeconds} secondes avant de lui envoyer ton message.`
      });
    }

    res.status(500).json({ error: "Une erreur s'est produite lors de la connexion avec votre Coach : " + error.message });
  }
});

// Configure Vite or Serve SPA Static files and listen
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind strictly as required
 app.listen(PORT, '0.0.0.0', () => {
  console.log(`Boualot Book Server running on port ${PORT}`);
});
}

bootstrap().catch((err) => {
  console.error("Erreur d'initialisation du serveur:", err);
});
