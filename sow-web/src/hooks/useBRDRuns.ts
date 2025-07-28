import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

const fetchWorkflowRuns = async (templateId: string) => {
  const { data } = await api.get(`/ps/runs?workflowId=${templateId}`);
  return data;
};

export function useBRDRuns(templateId: string) {
  return useQuery({
    queryKey: ['workflowRuns', templateId],
    queryFn: () => fetchWorkflowRuns(templateId),
    enabled: !!templateId,
    staleTime: 1000 * 60 * 5,
  });
}
