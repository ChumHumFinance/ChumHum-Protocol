import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';

interface BUMVaultProxyMethods {
  admin(): Callable<string>;
  pendingAdmin(): Callable<string>;
  _acceptAdmin(): Sendable<number>;
  _setPendingAdmin(pendingAdmin: string): Sendable<number>;
  _setPendingImplementation(pendingImpl: string): Sendable<number>;
  bumvaultImplementation(): Callable<string>;
  pendingBUMVaultImplementation(): Callable<string>;
}

export interface BUMVaultProxy extends Contract {
  methods: BUMVaultProxyMethods;
}
