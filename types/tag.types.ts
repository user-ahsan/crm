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

export interface TagWithEntity extends Tag {
  entityCount?: number;
}

export interface TagFormData {
  name: string;
  color?: string;
}
