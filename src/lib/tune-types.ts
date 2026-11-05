export type Tune = {
  id: string;
  title: string;
  type: string;
  key: string;
  composer: string;
  difficulty: string;
  description: string;
  youtubeId: string;
  sheetMusicPath: string;
  tags: string[];
  practiceTips?: string;
  museScorePath?: string;
};
