// Shared session storage for the demo-quiz app
// In production this would be a database, but for demo purposes we use in-memory storage

export let sessions: any[] = [];

export const addSession = (session: any) => {
  const existingIndex = sessions.findIndex(s => s.sessionId === session.sessionId);
  if (existingIndex !== -1) {
    sessions[existingIndex] = { ...sessions[existingIndex], ...session };
    return sessions[existingIndex];
  } else {
    sessions.push(session);
    return session;
  }
};

export const updateSession = (sessionId: string, updates: any) => {
  const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
  if (sessionIndex !== -1) {
    sessions[sessionIndex] = { ...sessions[sessionIndex], ...updates };
    return sessions[sessionIndex];
  }
  return null;
};

export const findSession = (sessionId: string) => {
  return sessions.find(s => s.sessionId === sessionId);
};

export const getAllSessions = () => {
  return [...sessions];
};

export const removeSession = (sessionId: string) => {
  const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
  if (sessionIndex !== -1) {
    const removedSession = sessions[sessionIndex];
    sessions.splice(sessionIndex, 1);
    return removedSession;
  }
  return null;
};