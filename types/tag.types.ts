export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  usageCount?: number;
}

export interface Tagging {
  id: string;
  tagId: string;
  taggableId: string;
  taggableType: 'lead' | 'contact' | 'company' | 'task' | 'meeting' | 'deal';
  createdAt: string;
}

// ponytail: removed TagWithEntity — never imported anywhere, add back if needed
export interface TagFormData {
  name: string;
  color?: string;
}
