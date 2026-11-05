declare module 'soundfont-player' {
  export type SoundfontPlayer = {
    play: (note: string, when?: number, options?: { duration?: number; gain?: number }) => void;
    stop: (when?: number) => void;
  };

  type SoundfontModule = {
    instrument: (
      context: AudioContext,
      name: string,
      options?: {
        destination?: AudioNode;
        notes?: string[];
        soundfont?: string;
        format?: string;
      },
    ) => Promise<SoundfontPlayer>;
  };

  const soundfont: SoundfontModule;
  export default soundfont;
}
