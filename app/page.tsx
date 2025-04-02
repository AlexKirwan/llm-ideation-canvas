'use client';

import Canvas from './components/Canvas';
import { useState, useEffect } from 'react';

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);

  // Wait for client-side hydration to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="h-screen w-full bg-gray-100" />;
  }

  return (
    <div className="relative h-screen overflow-hidden">
      <Canvas />
    </div>
  );
}