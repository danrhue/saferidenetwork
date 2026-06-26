'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { resolveProfilePhotoUrl } from '@/lib/storage/profile-photos';

interface DriverAvatarProps {
  photoPath: string | null | undefined;
  size?: number;
  className?: string;
}

export default function DriverAvatar({ photoPath, size = 32, className = '' }: DriverAvatarProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoPath) {
      setSignedUrl(null);
      return;
    }

    let isMounted = true;
    const loadSigned = async () => {
      const url = await resolveProfilePhotoUrl(supabase, photoPath);
      if (isMounted && url) {
        setSignedUrl(url);
      }
    };
    loadSigned();

    return () => { isMounted = false; };
  }, [photoPath]);

  if (!signedUrl) {
    return (
      <div 
        className={`bg-blue-100 rounded-full flex items-center justify-center text-blue-950 text-xs font-medium ${className}`} 
        style={{ width: size, height: size }}
      >
        👤
      </div>
    );
  }

  return (
    <img 
      src={signedUrl} 
      alt="Driver" 
      className={`rounded-full object-cover border border-blue-200 ${className}`} 
      style={{ width: size, height: size }} 
    />
  );
}