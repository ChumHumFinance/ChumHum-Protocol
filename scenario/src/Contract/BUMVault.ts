import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface BUMVaultMethods {
  admin(): Callable<string>
  pendingAdmin(): Callable<string>
  _setPendingAdmin(string): Sendable<number>
  _acceptAdmin(): Sendable<number>
  _setComptroller(string): Sendable<number>
}

export interface BUMVault extends Contract {
  methods: BUMVaultMethods
}
