// src/types/player.ts

export interface User {
  id: string;
  name: string;
  isMaster: boolean;
}

export interface Song {
  id: string;
  title: string;
  thumbnail?: string;
  sender: string;
}

export type Command =
  | { type: "JOIN"; user: User }
  | { type: "ADD_SONG"; url: string; user: User }
  | { type: "PLAY"; user: User }
  | { type: "PAUSE"; user: User }
  | { type: "STOP"; user: User }
  | { type: "NEXT"; user: User }
  // | { type: "SET_VOLUME"; volume: number; user: User } // ลบออก
  | { type: "GET_STATE" }
  | {
      type: "UPDATE_STATE";
      queue: Song[];
      currentId: string | null;
      users: User[];
      masterId: string | null;
    };
