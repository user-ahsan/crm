export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyId?: string;
  leadIds: string[];
  location?: string;
  socialLinks: string[];
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactFormData {
  name: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyId?: string;
  leadIds?: string[];
  location?: string;
  socialLinks: string[];
  tags: string[];
  notes?: string;
}
