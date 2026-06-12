import type { SessionState } from './model';
import { canonicalJson } from './canonicalJson';
import { demoSession } from './fixtures';

const encoder = new TextEncoder();
const toBase64Url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const fromBase64Url = (value: string): Uint8Array => Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(value.length/4)*4,'=')), (char) => char.charCodeAt(0));
const toHex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2,'0')).join('');
export const createSessionPayload = (state: SessionState): string => `hc1.${toBase64Url(encoder.encode(canonicalJson(state)))}`;
export const readSessionPayload = (payload: string): SessionState => {
  const [, encoded] = payload.split('.');
  if (!payload.startsWith('hc1.') || !encoded) throw new Error('Unsupported Happy Calendar payload.');
  const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as Partial<SessionState>;
  const events = parsed.events?.length ? [...parsed.events] : [...demoSession.events];
  return {
    ...demoSession,
    ...parsed,
    events,
    eventGroups: parsed.eventGroups?.length
      ? [...parsed.eventGroups]
      : [{ id: createLegacyGroupId(events), title: parsed.groupName ?? demoSession.groupName, eventIds: events.map((event) => event.id) }],
  };
};
export const createSessionFingerprint = async (state: SessionState, password: string): Promise<string> => { const digest = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalJson({ password, state }))); return `hc-sha256-${toHex(new Uint8Array(digest)).slice(0,24)}`; };
export const isNewerSession = (left: Pick<SessionState,'updatedAt'>, right: Pick<SessionState,'updatedAt'>): boolean => new Date(left.updatedAt).getTime() > new Date(right.updatedAt).getTime();

const createLegacyGroupId = (events: ReadonlyArray<{ id: string }>): string => `legacy-group-${events[0]?.id ?? 'default'}`;
