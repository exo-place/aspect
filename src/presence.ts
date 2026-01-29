import type { Awareness } from "y-protocols/awareness";

export interface PeerState {
  clientId: number;
  name: string;
  color: string;
  currentCardId?: string;
}

interface StoredIdentity {
  name: string;
  color: string;
}

const STORAGE_KEY = "aspect:identity";

const ADJECTIVES = [
  "swift", "calm", "bold", "keen", "warm",
  "cool", "wild", "soft", "bright", "dark",
];

const ANIMALS = [
  "fox", "owl", "elk", "jay", "cat",
  "wolf", "bear", "hare", "wren", "lynx",
];

const COLORS = [
  "#e06c75", "#e5c07b", "#98c379", "#56b6c2",
  "#61afef", "#c678dd", "#d19a66", "#be5046",
  "#7ec8e3", "#f0a1c2",
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateIdentity(): StoredIdentity {
  return {
    name: `${randomPick(ADJECTIVES)} ${randomPick(ANIMALS)}`,
    color: randomPick(COLORS),
  };
}

function loadIdentity(): StoredIdentity {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredIdentity;
      if (parsed.name && parsed.color) return parsed;
    }
  } catch {
    // ignore
  }
  const identity = generateIdentity();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

function saveIdentity(identity: StoredIdentity): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export class Presence {
  private awareness: Awareness;
  private identity: StoredIdentity;
  onChange: (() => void) | null = null;

  constructor(awareness: Awareness) {
    this.awareness = awareness;
    this.identity = loadIdentity();

    this.awareness.setLocalStateField("name", this.identity.name);
    this.awareness.setLocalStateField("color", this.identity.color);

    this.awareness.on("change", () => {
      this.onChange?.();
    });
  }

  setCurrentCard(id: string | null): void {
    if (id) {
      this.awareness.setLocalStateField("currentCardId", id);
    } else {
      this.awareness.setLocalStateField("currentCardId", null);
    }
  }

  setName(name: string): void {
    this.identity.name = name;
    saveIdentity(this.identity);
    this.awareness.setLocalStateField("name", name);
  }

  getLocalIdentity(): { name: string; color: string } {
    return { name: this.identity.name, color: this.identity.color };
  }

  getRemotePeers(): PeerState[] {
    const localId = this.awareness.clientID;
    const peers: PeerState[] = [];
    for (const [clientId, state] of this.awareness.getStates()) {
      if (clientId === localId) continue;
      if (!state || !state.name) continue;
      peers.push({
        clientId,
        name: state.name as string,
        color: state.color as string,
        currentCardId: (state.currentCardId as string) ?? undefined,
      });
    }
    return peers;
  }

  getPeersOnCard(cardId: string): PeerState[] {
    return this.getRemotePeers().filter((p) => p.currentCardId === cardId);
  }
}
