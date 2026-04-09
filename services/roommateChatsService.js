import {
  ensureDirectChat,
  getDirectChats,
  openDirectChat,
} from "./directChatsService";

export const getRoommateDirectChats = getDirectChats;
export const ensureRoommateDirectChat = ensureDirectChat;
export const openRoommateDirectChat = openDirectChat;

export default {
  getRoommateDirectChats,
  ensureRoommateDirectChat,
  openRoommateDirectChat,
};
