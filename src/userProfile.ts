export type UserProfile = {
  name: string;
  email?: string;
  role: string;
  photo?: string;
};

const PROFILE_KEY = 'rm-user-profile';
const REGISTRY_KEY = 'rm-registered-profiles';

const DEFAULT_PROFILE: UserProfile = {
  name: 'Guest Researcher',
  role: 'Guest Researcher',
};

function readRegistry(): Record<string, UserProfile> {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, UserProfile>) : {};
  } catch {
    return {};
  }
}

export function saveRegisteredProfile(name: string, email: string) {
  const profile: UserProfile = {
    name: name.trim(),
    email: email.trim(),
    role: 'Researcher',
  };
  try {
    const registry = readRegistry();
    registry[profile.email!.toLowerCase()] = profile;
    registry[profile.name.toLowerCase()] = profile;
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable */
  }
}

export function saveLoginProfile(usernameOrEmail: string) {
  const input = usernameOrEmail.trim();
  const registry = readRegistry();
  const existing = registry[input.toLowerCase()];

  const profile: UserProfile = existing ?? {
    name: input.includes('@') ? input.split('@')[0] : input,
    email: input.includes('@') ? input : undefined,
    role: 'Researcher',
  };

  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable */
  }
}

export function readUserProfile(): UserProfile {
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY) ?? localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserProfile>;
      if (parsed.name) {
        return {
          name: parsed.name,
          email: parsed.email,
          role: parsed.role || 'Researcher',
          photo: parsed.photo,
        };
      }
    }
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_PROFILE;
}

export function getProfileInitials(name: string): string {
  if (name === DEFAULT_PROFILE.name) return 'R';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'R';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
