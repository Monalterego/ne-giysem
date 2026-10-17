import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export type StyleEntry = { name: string; weight: number };

/** Kullanıcının style_profiles.styles kaydı — Profil özeti ve Stil DNA ekranı ortak */
export function useStyleEntries(userId: string | undefined) {
  const [entries, setEntries] = useState<StyleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    // Sorgu builder'ı PromiseLike döner (.finally yok) → async/try-finally
    (async () => {
      try {
        const { data } = await supabase
          .from('style_profiles')
          .select('styles')
          .eq('user_id', userId)
          .maybeSingle();
        if (!cancelled && data?.styles) setEntries(data.styles);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return { entries, loading };
}
