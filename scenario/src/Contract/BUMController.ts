import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface BUMControllerMethods {
  admin(): Callable<string>
  pendingAdmin(): Callable<string>
  _setPendingAdmin(string): Sendable<number>
  _acceptAdmin(): Sendable<number>
  _setComptroller(string): Sendable<number>
  mintBUM(amount: encodedNumber): Sendable<number>
  repayBUM(amount: encodedNumber): Sendable<{0: number, 1: number}>
  getMintableBUM(string): Callable<{0: number, 1: number}>
  liquidateBUM(borrower: string, repayAmount: encodedNumber, cTokenCollateral: string): Sendable<{0: number, 1: number}>
  _setTreasuryData(guardian, address, percent: encodedNumber): Sendable<number>
  initialize(): Sendable<void>
}

export interface BUMController extends Contract {
  methods: BUMControllerMethods
}
