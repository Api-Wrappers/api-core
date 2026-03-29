import type { CacheStore } from "./types";

interface CacheEntry {
	value: unknown;
	expiresAt: number | null;
}

export class MemoryStore implements CacheStore {
	private readonly store = new Map<string, CacheEntry>();

	get(key: string): unknown | undefined {
		const entry = this.store.get(key);
		if (!entry) return undefined;
		if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return undefined;
		}
		return entry.value;
	}

	set(key: string, value: unknown, ttlMs?: number): void {
		this.store.set(key, {
			value,
			expiresAt: ttlMs != null ? Date.now() + ttlMs : null,
		});
	}

	delete(key: string): void {
		this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}
}
