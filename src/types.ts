export type EditContainer = {
  schema: string;
  fileName: string;
  metaFileName?: string;
  data: any;
  meta?: Meta;
};

export type HawkshawConfig = {
  routing: string;
  schema: string;
};

export type Router = {
  schema: string;
  directory: string;
  prefix: string;
};

export type Entry = {
  id: number;
  key: string;
};

export type Meta = {
  title?: string;
  description?: string;
  color?: string;
  tags?: string[];
  comments?: { [key: string]: MetaComment };
};

export type MetaComment = {
  message: string;
  contributor: string;
  reactions: MetaReaction[];
  status: number;
  date: string;
};

export type MetaReaction = {
  react: string;
  contributors: string[];
};

export type keyRefOptions = {};
