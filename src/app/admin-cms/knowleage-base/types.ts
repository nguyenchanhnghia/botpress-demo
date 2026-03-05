export interface FileItem {
  id: string;
  name: string;
  key?: string;
  [key: string]: any;
}

export interface KnowledgeBaseItem {
  id: string;
  name: string;
  createdAt?: string;
  tags?: Record<string, any>;
}
