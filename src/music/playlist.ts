export interface PublicTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
}

// Add tracks you have permission to publish. These tracks are visible to every visitor.
export const PUBLIC_PLAYLIST: PublicTrack[] = [
  {
    id: 'marociasong',
    title: 'Marociasong خويي',
    artist: 'ECO Music',
    audioUrl: '/music/marociasong.mp3',
  },
];
