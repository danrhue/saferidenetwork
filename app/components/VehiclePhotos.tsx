'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface VehiclePhotosProps {
  photoPaths: string[];
  maxDisplay?: number;
}

export default function VehiclePhotos({ photoPaths, maxDisplay = 1 }: VehiclePhotosProps) {
  const [signedUrls, setSignedUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!photoPaths || photoPaths.length === 0) {
      setSignedUrls([]);
      return;
    }

    let mounted = true;
    const load = async () => {
      const signed = await Promise.all(
        photoPaths.slice(0, maxDisplay).map(async (path) => {
          const { data } = await supabase.storage.from('driver-photos').createSignedUrl(path, 3600);
          return data?.signedUrl || '';
        })
      );
      if (mounted) setSignedUrls(signed.filter(Boolean));
    };
    load();
    return () => { mounted = false; };
  }, [photoPaths, maxDisplay]);

  if (signedUrls.length === 0) return null;

  return (
    <div className="flex gap-2 mt-2">
      {signedUrls.map((url, i) => (
        <img 
          key={i} 
          src={url} 
          alt={`Vehicle ${i+1}`} 
          className="w-12 h-12 object-cover rounded border border-gray-200" 
        />
      ))}
      {photoPaths.length > maxDisplay && (
        <div className="text-xs text-blue-800 self-center">+{photoPaths.length - maxDisplay} more</div>
      )}
    </div>
  );
}