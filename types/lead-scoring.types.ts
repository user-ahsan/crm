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

export const SCORING_FACTORS: ScoringFactor[] = [
  { key: 'email_present', label: 'Email present', weight: 20, description: '+20 if email exists' },
  { key: 'phone_present', label: 'Phone present', weight: 15, description: '+15 if phone exists' },
  { key: 'company_present', label: 'Company present', weight: 10, description: '+10 if company exists' },
  { key: 'source_quality', label: 'Source quality', weight: 15, description: '+15 if referral or website' },
  { key: 'tags_count', label: 'Tags', weight: 5, description: '+5 per tag' },
  { key: 'lost_penalty', label: 'Lost penalty', weight: -10, description: '-10 if status is lost' },
];
