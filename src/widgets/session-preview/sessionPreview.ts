import { demoSession } from '../../entities/session/fixtures';
import { createSessionPayload } from '../../entities/session/hashSession';
export const buildDemoSessionPreview = () => { const payload = createSessionPayload(demoSession); return { groupName: demoSession.groupName, participantsCount: demoSession.participants.length, eventsCount: demoSession.events.length, payloadSample: `${payload.slice(0, 26)}…${payload.slice(-12)}` } as const; };
