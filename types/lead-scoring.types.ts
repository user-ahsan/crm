export interface LeadScore {
  id: string;
  leadId: string;
  score: number;
  factors: Record<string, number>;
  updatedAt: string;
}

export type ScoringFactor = {
  key: string;
  label: string;
  weight: number;
  description: string;
};

