import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Simple Portal component that renders children into document.body
export default function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  const [container, setContainer] = useState(null);

  useEffect(() => {
    const el = document.createElement('div');
    setContainer(el);
    document.body.appendChild(el);
    setMounted(true);
    return () => {
      try {
        document.body.removeChild(el);
      } catch {}
    };
  }, []);

  if (!mounted || !container) return null;
  return createPortal(children, container);
}
