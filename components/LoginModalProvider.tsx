"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import LoginModal from "./LoginModal";

type AuthMode = "login" | "register";

interface LoginModalContextType {
  openLoginModal: (mode?: AuthMode, returnPath?: string) => void;
  closeLoginModal: () => void;
}

const LoginModalContext = createContext<LoginModalContextType | null>(null);

export function LoginModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [returnPath, setReturnPath] = useState("/");

  const openLoginModal = useCallback((newMode: AuthMode = "login", newPath: string = "/") => {
    setMode(newMode);
    setReturnPath(newPath);
    setIsOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Listen for custom event
  React.useEffect(() => {
    const handleOpenModal = (e: CustomEvent) => {
      const { mode: eventMode, returnPath: eventPath } = e.detail || {};
      openLoginModal(eventMode, eventPath);
    };

    window.addEventListener("open-login-modal", handleOpenModal as EventListener);
    return () => {
      window.removeEventListener("open-login-modal", handleOpenModal as EventListener);
    };
  }, [openLoginModal]);

  return (
    <LoginModalContext.Provider value={{ openLoginModal, closeLoginModal }}>
      {children}
      <LoginModal
        isOpen={isOpen}
        onClose={closeLoginModal}
        defaultMode={mode}
        returnPath={returnPath}
      />
    </LoginModalContext.Provider>
  );
}

export function useLoginModal() {
  const context = useContext(LoginModalContext);
  if (!context) {
    throw new Error("useLoginModal must be used within LoginModalProvider");
  }
  return context;
}
