import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  // Se calcula desde el primer render: si arrancara en "no móvil", en una pantalla angosta el
  // primer pintado usaría el layout de escritorio (barra lateral + contenido estrecho), el
  // contenido se desbordaría, el navegador ensancharía el viewport y window.innerWidth
  // quedaría >= 768, dejando la barra fija para siempre (sin botón de hamburguesa).
  const [isMobile, setIsMobile] = React.useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
