import { RegisterInput, LoginInput } from '../schemas/auth.schema.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export interface MeResult {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface AuthService {
  register(data: RegisterInput): Promise<AuthResult>;
  login(data: LoginInput): Promise<AuthResult>;
  getMe(userId: string): Promise<MeResult>;
}
