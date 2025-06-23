// app/components/ElevenLabsAgent.tsx
"use client";

import { useEffect } from "react";

export default function ElevenLabsAgent() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    script.async = true;
    script.type = "text/javascript";
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <elevenlabs-convai agent-id="agent_01jy8ecewzfwzbqynksce8xqsc"></elevenlabs-convai>
  );
}
