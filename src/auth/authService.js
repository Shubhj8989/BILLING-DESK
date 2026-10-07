import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils';
import dbInstance from '../db/db';
import { supabase } from '../db/supabaseClient';

const SESSION_KEY = 'billing_session';
const ATTEMPTS_KEY = 'billing_login_attempts';
const PBKDF2_ITERATIONS = 60000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;
const SESSION_TTL_REMEMBER = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_TTL_DEFAULT = 12 * 60 * 60 * 1000; // 12 hours

export const ROLES = {
  admin: 'Admin (Owner)',
  staff: 'Staff (Billing only)'
};

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

async function hashPassword(password, saltHex) {
  const key = await pbkdf2Async(sha256, password, hexToBytes(saltHex), { c: PBKDF2_ITERATIONS, dkLen: 32 });
  return bytesToHex(key);
}

// Constant-time comparison of two hex strings
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function generateRecoveryCode() {
  // 16 hex chars grouped as XXXX-XXXX-XXXX-XXXX
  return bytesToHex(randomBytes(8)).toUpperCase().match(/.{4}/g).join('-');
}

export function validatePassword(password) {
  if (!password || password.length < 6) return 'Password must be at least 6 characters long.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must contain both letters and numbers.';
  return null;
}

function validateUsername(username) {
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return 'Username must be 3-32 characters: letters, numbers, dot, dash or underscore.';
  }
  return null;
}

function toSessionUser(user) {
  return {
    id: user.id,
    mode: 'local',
    name: user.name,
    username: user.username,
    email: user.username,
    role: user.role
  };
}

function cloudToSessionUser(user) {
  return {
    id: user.id,
    mode: 'cloud',
    name: user.user_metadata?.full_name || user.email,
    username: user.email,
    email: user.email,
    role: 'admin'
  };
}

// --- Failed-attempt lockout (per username, per browser) ---
function readAttempts() {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAttempts(map) {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(map));
  } catch {
    // storage unavailable: lockout simply won't persist
  }
}

function checkLockout(key) {
  const entry = readAttempts()[key];
  if (entry && entry.lockedUntil && entry.lockedUntil > Date.now()) {
    const secs = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    throw new Error(`Too many failed attempts. Try again in ${secs} seconds.`);
  }
}

function recordFailure(key) {
  const map = readAttempts();
  // An expired lockout entry starts a fresh count
  const previous = map[key] && !map[key].lockedUntil ? map[key].count : 0;
  const count = previous + 1;
  map[key] = count >= MAX_FAILED_ATTEMPTS ? { count: 0, lockedUntil: Date.now() + LOCKOUT_MS } : { count };
  writeAttempts(map);
}

function clearFailures(key) {
  const map = readAttempts();
  delete map[key];
  writeAttempts(map);
}

// --- Session persistence ---
function saveSession(sessionUser, remember) {
  const payload = JSON.stringify({
    userId: sessionUser.id,
    mode: sessionUser.mode,
    expiresAt: Date.now() + (remember ? SESSION_TTL_REMEMBER : SESSION_TTL_DEFAULT)
  });
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, payload);
  } catch {
    // ignore storage failures; the user will just need to log in again
  }
}

function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

class AuthService {
  isCloudConfigured() {
    return supabase !== null;
  }

  // Quick reachability probe so we can tell the user the cloud is down instead of hanging
  async isCloudReachable(timeoutMs = 5000) {
    if (!supabase) return false;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        signal: controller.signal
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async hasLocalUsers() {
    const users = await dbInstance.getUsers();
    return users.length > 0;
  }

  // --- First-run owner setup ---
  async createOwner({ name, username, password }) {
    if (await this.hasLocalUsers()) {
      throw new Error('An owner account already exists. Please sign in.');
    }
    const user = await this._createUser({ name, username, password, role: 'admin' });
    const recoveryCode = await this._issueRecoveryCode(user);
    return { user: toSessionUser(user), recoveryCode };
  }

  async _createUser({ name, username, password, role }) {
    const uname = normalizeUsername(username);
    const usernameError = validateUsername(uname);
    if (usernameError) throw new Error(usernameError);
    const passwordError = validatePassword(password);
    if (passwordError) throw new Error(passwordError);
    if (!String(name || '').trim()) throw new Error('Please enter a display name.');
    if (await dbInstance.getUserByUsername(uname)) throw new Error('That username is already taken.');

    const salt = bytesToHex(randomBytes(16));
    const user = {
      name: name.trim(),
      username: uname,
      role: role === 'admin' ? 'admin' : 'staff',
      salt,
      passwordHash: await hashPassword(password, salt),
      active: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };
    user.id = await dbInstance.saveUser(user);
    return user;
  }

  async _issueRecoveryCode(user) {
    const code = generateRecoveryCode();
    const recoverySalt = bytesToHex(randomBytes(16));
    await dbInstance.saveUser({
      ...user,
      recoverySalt,
      recoveryHash: await hashPassword(code, recoverySalt)
    });
    return code;
  }

  // --- Local login ---
  async loginLocal(username, password, remember = false) {
    const uname = normalizeUsername(username);
    const lockKey = `local:${uname}`;
    checkLockout(lockKey);

    const user = await dbInstance.getUserByUsername(uname);
    // Always hash to keep timing similar whether or not the user exists
    const computed = await hashPassword(password || '', user ? user.salt : '00'.repeat(16));

    if (!user || !safeEqual(computed, user.passwordHash)) {
      recordFailure(lockKey);
      throw new Error('Invalid username or password.');
    }
    if (!user.active) {
      throw new Error('This account has been disabled. Contact the shop owner.');
    }

    clearFailures(lockKey);
    await dbInstance.saveUser({ ...user, lastLoginAt: new Date().toISOString() });
    const sessionUser = toSessionUser(user);
    saveSession(sessionUser, remember);
    return sessionUser;
  }

  // --- Password recovery with the one-time recovery code ---
  async resetWithRecoveryCode(username, code, newPassword) {
    const uname = normalizeUsername(username);
    const lockKey = `recovery:${uname}`;
    checkLockout(lockKey);

    const passwordError = validatePassword(newPassword);
    if (passwordError) throw new Error(passwordError);

    const user = await dbInstance.getUserByUsername(uname);
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!user || !user.recoveryHash) {
      recordFailure(lockKey);
      throw new Error('Invalid username or recovery code.');
    }
    const computed = await hashPassword(normalizedCode, user.recoverySalt);
    if (!safeEqual(computed, user.recoveryHash)) {
      recordFailure(lockKey);
      throw new Error('Invalid username or recovery code.');
    }

    clearFailures(lockKey);
    const salt = bytesToHex(randomBytes(16));
    const updated = { ...user, salt, passwordHash: await hashPassword(newPassword, salt) };
    await dbInstance.saveUser(updated);
    // The old code is now spent; hand out a fresh one
    return this._issueRecoveryCode(updated);
  }

  async regenerateRecoveryCode(userId) {
    const user = await dbInstance.getUserById(userId);
    if (!user) throw new Error('User not found.');
    return this._issueRecoveryCode(user);
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await dbInstance.getUserById(userId);
    if (!user) throw new Error('User not found.');
    const computed = await hashPassword(currentPassword || '', user.salt);
    if (!safeEqual(computed, user.passwordHash)) throw new Error('Current password is incorrect.');
    const passwordError = validatePassword(newPassword);
    if (passwordError) throw new Error(passwordError);
    const salt = bytesToHex(randomBytes(16));
    await dbInstance.saveUser({ ...user, salt, passwordHash: await hashPassword(newPassword, salt) });
  }

  // --- Admin user management ---
  async listUsers() {
    const users = await dbInstance.getUsers();
    return users.map(({ passwordHash: _p, salt: _s, recoveryHash: _r, recoverySalt: _rs, ...rest }) => rest);
  }

  async addUser(data) {
    const user = await this._createUser(data);
    return user.id;
  }

  async setUserPassword(userId, newPassword) {
    const user = await dbInstance.getUserById(userId);
    if (!user) throw new Error('User not found.');
    const passwordError = validatePassword(newPassword);
    if (passwordError) throw new Error(passwordError);
    const salt = bytesToHex(randomBytes(16));
    await dbInstance.saveUser({ ...user, salt, passwordHash: await hashPassword(newPassword, salt) });
  }

  async _assertAnotherActiveAdmin(userId) {
    const users = await dbInstance.getUsers();
    const others = users.filter(u => u.id !== Number(userId) && u.role === 'admin' && u.active);
    if (others.length === 0) throw new Error('At least one active admin account must remain.');
  }

  async updateUser(userId, { name, role, active }) {
    const user = await dbInstance.getUserById(userId);
    if (!user) throw new Error('User not found.');
    const demoting = user.role === 'admin' && (role === 'staff' || active === false);
    if (demoting) await this._assertAnotherActiveAdmin(userId);
    await dbInstance.saveUser({
      ...user,
      name: name !== undefined ? String(name).trim() || user.name : user.name,
      role: role !== undefined ? (role === 'admin' ? 'admin' : 'staff') : user.role,
      active: active !== undefined ? Boolean(active) : user.active
    });
  }

  async deleteUser(userId) {
    const user = await dbInstance.getUserById(userId);
    if (!user) return;
    if (user.role === 'admin') await this._assertAnotherActiveAdmin(userId);
    await dbInstance.deleteUser(userId);
  }

  // --- Cloud (Supabase) auth ---
  async loginCloud(email, password, remember = false) {
    if (!supabase) throw new Error('Cloud sync is not configured.');
    const lockKey = `cloud:${String(email).toLowerCase()}`;
    checkLockout(lockKey);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      recordFailure(lockKey);
      throw new Error(error.message === 'Failed to fetch'
        ? 'Cannot reach the cloud server. Check your internet connection or use a local account.'
        : error.message);
    }
    clearFailures(lockKey);
    const sessionUser = cloudToSessionUser(data.user);
    saveSession(sessionUser, remember);
    return sessionUser;
  }

  async signUpCloud({ email, password, fullName }) {
    if (!supabase) throw new Error('Cloud sync is not configured.');
    const passwordError = validatePassword(password);
    if (passwordError) throw new Error(passwordError);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) throw new Error(error.message);
    if (data.session) {
      const sessionUser = cloudToSessionUser(data.user);
      saveSession(sessionUser, true);
      return { user: sessionUser, needsConfirmation: false };
    }
    return { user: null, needsConfirmation: true };
  }

  async sendCloudPasswordReset(email) {
    if (!supabase) throw new Error('Cloud sync is not configured.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw new Error(error.message);
  }

  async updateCloudPassword(newPassword) {
    const passwordError = validatePassword(newPassword);
    if (passwordError) throw new Error(passwordError);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  }

  // --- Session restore / logout ---
  async restoreSession() {
    const session = readSession();
    if (!session) return null;
    if (!session.expiresAt || session.expiresAt < Date.now()) {
      clearSession();
      return null;
    }

    if (session.mode === 'cloud') {
      if (!supabase) return null;
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        clearSession();
        return null;
      }
      return cloudToSessionUser(data.session.user);
    }

    const user = await dbInstance.getUserById(session.userId);
    if (!user || !user.active) {
      clearSession();
      return null;
    }
    return toSessionUser(user);
  }

  async logout(sessionUser) {
    clearSession();
    if (sessionUser?.mode === 'cloud' && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Cloud sign out failed:', err);
      }
    }
  }
}

const authService = new AuthService();
export default authService;
