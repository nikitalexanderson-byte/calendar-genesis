import { useEffect, useState } from 'react';
import { physisRequest } from '../cloud-sync';
export function usePhysisAccess(userId: string) {
  const [owner, setOwner] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    if (userId) void physisRequest<{ available: boolean; ownerId: string }>('/access', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setOwner(result.available && result.ownerId === userId ? userId : ''); })
      .catch(() => { if (!controller.signal.aborted) setOwner(''); });
    return () => controller.abort();
  }, [userId]);
  return Boolean(userId && owner === userId);
}
