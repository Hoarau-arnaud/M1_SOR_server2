import type { SQLOutputValue } from "node:sqlite";

/**
 * Vue API
 */
export interface Poll {
  id: string;
  title: string;
  description?: string;
  options: PollOption[];
  userId?: string;
  createdAt: string;
  expiresAt?: string;
  isActive: boolean;
  restrictedToAuth: boolean;
}

export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

export interface Vote {
  id: string;
  pollId: string;
  optionId: string;
  userId?: string;
  createdAt: string;
}

/**
 * Vue DB
 */
export interface PollRow {
  id: string;
  title: string;
  description: string | null;
  user_id: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: number; // 0/1
  restricted_to_auth: number; // 0/1
  [key: string]: SQLOutputValue;
}

export interface PollOptionRow {
  id: string;
  poll_id: string;
  text: string;
  vote_count: number;
  [key: string]: SQLOutputValue;
}

export interface VoteRow {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string | null;
  created_at: string;
  [key: string]: SQLOutputValue;
}

/**
 * Réponses API
 */
export enum APIErrorCode {
  NOT_FOUND = "NOT_FOUND",
  SERVER_ERROR = "SERVER_ERROR",
  TIMEOUT = "TIMEOUT",
  UNAUTHORIZED = "UNAUTHORIZED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  BAD_REQUEST = "BAD_REQUEST",
}

export interface APIError {
  code: APIErrorCode;
  message: string;
}

export interface APISuccess<T> {
  success: true;
  data: T;
  error?: never;
}

export interface APIFailure {
  success: false;
  data?: never;
  error: APIError;
}

export type APIResponse<T> = APISuccess<T> | APIFailure;

/**
 * WebSockets
 */

export interface VoteCastMessage {
  type: "vote_cast";
  voteId: string;
  pollId: string;
  optionId: string;
  userId?: string;
}

export interface VoteAckMessageFailure {
  type: "vote_ack";
  pollId: string;
  optionId: string;
  success: false;
  error: APIError;
}

export interface VoteAckMessageSuccess {
  type: "vote_ack";
  pollId: string;
  optionId: string;
  success: true;
  error?: never;
}

export type VoteAckMessage = VoteAckMessageFailure | VoteAckMessageSuccess;

export interface VotesUpdateMessage {
  type: "votes_update";
  pollId: string;
  optionId: string;
  voteCount: number;
}


/**
 * Authentification
 */
export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  isAdmin?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Côté serveur (payload décodé du JWT)
export interface AuthPayload {
  userId: string;
  username: string;
  isAdmin: boolean;
  exp: number;
}

/**
 * Vue DB
 */
export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  is_admin: number; // 0/1
  created_at: string;
  [key: string]: SQLOutputValue;
}

export interface CreatePollRequest {
  title: string;
  description?: string;
  expiresAt?: string;
  options: { text: string }[];
  restrictedToAuth?: boolean;
}

export interface UpdatePollRequest {
  title?: string;
  description?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
  restrictedToAuth?: boolean;
}