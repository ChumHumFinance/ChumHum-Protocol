import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';

interface BUMUnitrollerMethods {
  admin(): Callable<string>;
  pendingAdmin(): Callable<string>;
  _acceptAdmin(): Sendable<number>;
  _setPendingAdmin(pendingAdmin: string): Sendable<number>;
  _setPendingImplementation(pendingImpl: string): Sendable<number>;
  bumcontrollerImplementation(): Callable<string>;
  pendingBUMControllerImplementation(): Callable<string>;
}

export interface BUMUnitroller extends Contract {
  methods: BUMUnitrollerMethods;
}
