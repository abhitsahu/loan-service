'use client';

import { useEffect } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/app/_lib/firebase-client';

export default function DocsPage() {
  useEffect(() => {
    // Live token — kept fresh by onIdTokenChanged (Firebase rotates every ~1 h)
    let token = '';
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      token = user ? await user.getIdToken() : '';
    });

    // Override app's dark theme for this page only
    const prev = {
      bg: document.body.style.background,
      color: document.body.style.color,
    };
    document.body.style.background = '#fff';
    document.body.style.color = '#3b4151';

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js';
    script.onload = () => {
      (window as any).SwaggerUIBundle({
        url: '/api/openapi',
        dom_id: '#swagger-ui',
        presets: [(window as any).SwaggerUIBundle.presets.apis, (window as any).SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
        deepLinking: true,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        // Inject the Firebase ID token automatically — no manual Authorize needed
        requestInterceptor: (req: { headers: Record<string, string> }) => {
          if (token) req.headers['Authorization'] = `Bearer ${token}`;
          return req;
        },
      });
    };
    document.body.appendChild(script);

    return () => {
      unsubscribe();
      document.body.style.background = prev.bg;
      document.body.style.color = prev.color;
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div
      id="swagger-ui"
      style={{ minHeight: '100vh', background: '#fff', color: '#3b4151' }}
    />
  );
}
