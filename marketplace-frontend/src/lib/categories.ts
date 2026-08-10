import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import api from '@/lib/axios';
import type { Category } from '@/types';
import { unwrap } from '@/pages/pageShared';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => unwrap<Category[]>(r)),
  });
}

export function useRequestCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.post('/categories/request', { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}
