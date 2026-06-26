'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface OrganizationLogoProps {
  photoPath: string | null | undefined;
  size?: number;
  className?: string;
  fallbackText?: string;
}

export default function OrganizationLogo({ 
  photoPath, 
  size = 40, 
  className = '', 
  fallbackText = '🏢' 
}: OrganizationLogoProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoPath) {
      setSignedUrl(null);
      return;
    }

    let isMounted = true;
    const loadSignedUrl = async () => {
      try {
        const { data, error } = await supabase
          .storage
          .from('organization-logos')
          .createSignedUrl(photoPath, 3600); // 1 hour

        if (error) {
          console.error('Error creating signed URL for org logo:', error);
          return;
        }

        if (isMounted && data?.signedUrl) {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Failed to load org logo signed URL:', err);
      }
    };

    loadSignedUrl();

    return () => {
      isMounted = false;
    };
  }, [photoPath]);

  if (!signedUrl) {
    return (
      <div 
        className={`bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-xl border border-gray-200 ${className}`} 
        style={{ width: size, height: size }}
        title="Organization logo"
      >
        {fallbackText}
      </div>
    );
  }

  return (
    <img 
      src={signedUrl} 
      alt="Organization Logo" 
      className={`rounded-xl object-cover border border-gray-200 bg-white ${className}`} 
      style={{ width: size, height: size }} 
      title="Organization logo"
    />
  );
}
