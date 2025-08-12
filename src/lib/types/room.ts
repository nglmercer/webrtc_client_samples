// src/lib/types/room.ts

export interface RoomExtra {
  name: string;
}

export interface Room {
  createdAt: string;
  extra: RoomExtra;
  identifier: string;
  maxParticipantsAllowed: number;
  maxUsers: number;
  owner: string;
  participants: string[];
  socketCustomEvent: string;
  socketMessageEvent: string;
}

export interface RoomsResponse {
  [roomName: string]: Room;
}

export interface RoomListItem {
  name: string;
  owner: string;
  participantCount: number;
  maxParticipants: number;
  createdAt: string;
  canJoin: boolean;
}