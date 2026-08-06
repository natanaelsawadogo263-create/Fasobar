"use client";

import { useEffect, useRef } from "react";

type PosKeyboardHandlers = {
  onSearch?: () => void;
  onOpenOrders?: () => void;
  onCheckout?: () => void;
  onEscape?: () => void;
};

export function usePosKeyboard(handlers: PosKeyboardHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingTarget =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;

      if (event.key === "F2" || (event.key === "/" && !isTypingTarget && !event.ctrlKey && !event.metaKey)) {
        event.preventDefault();
        handlersRef.current.onSearch?.();
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        handlersRef.current.onOpenOrders?.();
        return;
      }

      if (event.key === "F8") {
        event.preventDefault();
        handlersRef.current.onCheckout?.();
        return;
      }

      if (event.key === "Escape") {
        handlersRef.current.onEscape?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
