"use client";
import { motion } from "framer-motion";
import CompareView from "@/components/CompareView";
import { MODELS } from "@/lib/models";

export default function ComparePage() {
  return (
    <motion.main
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 max-w-5xl mx-auto px-6 py-12 w-full"
    >
      <header className="mb-10">
        <h1 className="text-2xl font-bold font-mono text-slate-100">
          Compare Models
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Synthesize the same text across all models side by side.
        </p>
      </header>

      <CompareView
        modelIds={MODELS.map((m) => m.id)}
        modelName={(id) => {
          const m = MODELS.find((mod) => mod.id === id);
          return m ? m.name : id;
        }}
      />
    </motion.main>
  );
}
