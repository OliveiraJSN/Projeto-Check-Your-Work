// Tipagem do matcher toPassAsync() que o ArchUnitTS registra no Vitest (globals: true)
import 'vitest';

declare module 'vitest' {
  interface Assertion<T = any> {
    toPassAsync(): Promise<void>;
  }
}
