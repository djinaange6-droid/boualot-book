/**
 * types.ts
 * Type definitions for Boualot Book
 */

export interface CourseSynthesis {
  title: string;
  plan: string[];
  concepts: {
    word: string;
    definition: string;
  }[];
  essential: string[];
  markdownContent?: string; // HTML-like or markdown-formatted content progressive stream
}

export interface QuizQuestion {
  id: number;
  type: 'QCM' | 'QCD';
  question: string;
  options?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
    Vrai?: string;
    Faux?: string;
  } | string[]; // Can be object with keys or array
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'Vrai' | 'Faux' | string;
  explanation: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'coach';
  text: string;
  timestamp: string;
  attachedFile?: {
    name: string;
    type: string;
    base64?: string;
  };
}

export interface StudySession {
  id: string;
  courseName: string;
  date: string;
  synthesis?: CourseSynthesis;
  quiz?: QuizQuestion[];
  quizAnswers?: Record<number, string>; // questionId -> selectedOption
  sourceFile?: {
    name: string;
    type: string;
    base64?: string;
    text?: string;
  };
}
