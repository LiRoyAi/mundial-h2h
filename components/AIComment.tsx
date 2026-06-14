"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const B = "var(--font-bebas), 'Bebas Neue', sans-serif";

export default function AIComment({
  comment,
  onDismiss,
}: {
  comment: string | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!comment) return;
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [comment, onDismiss]);

  return (
    <AnimatePresence>
      {comment && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.4 }}
          className="relative mt-3 px-4 py-3"
          style={{
            background: "#0a0a0a",
            borderLeft: "2px solid #FFD700",
          }}
        >
          <p
            className="text-[11px] leading-relaxed italic pr-5"
            style={{ fontFamily: B, color: "#FFD700" }}
          >
            {comment}
          </p>
          <button
            onClick={onDismiss}
            className="absolute top-2 right-2 text-[10px] leading-none transition-colors hover:text-[#FFD700]"
            style={{ color: "#555" }}
            aria-label="Zamknij"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
