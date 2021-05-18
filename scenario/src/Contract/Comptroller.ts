import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface ComptrollerMethods {
  getAccountLiquidity(string): Callable<{0: number, 1: number, 2: number}>
  getHypotheticalAccountLiquidity(account: string, asset: string, redeemTokens: encodedNumber, borrowAmount: encodedNumber): Callable<{0: number, 1: number, 2: number}>
  membershipLength(string): Callable<string>
  checkMembership(user: string, cToken: string): Callable<string>
  getAssetsIn(string): Callable<string[]>
  admin(): Callable<string>
  oracle(): Callable<string>
  maxAssets(): Callable<number>
  liquidationIncentiveMantissa(): Callable<number>
  closeFactorMantissa(): Callable<number>
  getBlockNumber(): Callable<number>
  collateralFactor(string): Callable<string>
  markets(string): Callable<{0: boolean, 1: number, 2?: boolean}>
  _setMaxAssets(encodedNumber): Sendable<number>
  _setLiquidationIncentive(encodedNumber): Sendable<number>
  _supportMarket(string): Sendable<number>
  _setPriceOracle(string): Sendable<number>
  _setCollateralFactor(string, encodedNumber): Sendable<number>
  _setCloseFactor(encodedNumber): Sendable<number>
  _setBUMMintRate(encodedNumber): Sendable<number>
  _setChumHumBUMVaultRate(encodedNumber): Sendable<number>
  _setBUMController(string): Sendable<number>
  enterMarkets(markets: string[]): Sendable<number>
  exitMarket(market: string): Sendable<number>
  fastForward(encodedNumber): Sendable<number>
  _setPendingImplementation(string): Sendable<number>
  comptrollerImplementation(): Callable<string>
  unlist(string): Sendable<void>
  admin(): Callable<string>
  pendingAdmin(): Callable<string>
  _setPendingAdmin(string): Sendable<number>
  _acceptAdmin(): Sendable<number>
  _setProtocolPaused(bool): Sendable<number>
  protocolPaused(): Callable<boolean>
  _addChumHumMarkets(markets: string[]): Sendable<void>
  _dropChumHumMarket(market: string): Sendable<void>
  getChumHumMarkets(): Callable<string[]>
  refreshChumHumSpeeds(): Sendable<void>
  chumhumRate(): Callable<number>
  chumhumSupplyState(string): Callable<string>
  chumhumBorrowState(string): Callable<string>
  chumhumAccrued(string): Callable<string>
  chumhumSupplierIndex(market: string, account: string): Callable<string>
  chumhumBorrowerIndex(market: string, account: string): Callable<string>
  chumhumSpeeds(string): Callable<string>
  claimChumHum(string): Sendable<void>
  _setChumHumRate(encodedNumber): Sendable<void>
  _setChumHumSpeed(cToken: string, encodedNumber): Sendable<void>
  mintedBUMs(string): Callable<number>
  _setMarketBorrowCaps(cTokens:string[], borrowCaps:encodedNumber[]): Sendable<void>
  _setBorrowCapGuardian(string): Sendable<void>
  borrowCapGuardian(): Callable<string>
  borrowCaps(string): Callable<string>
  _setTreasuryData(guardian, address, percent: encodedNumber): Sendable<number>
}

export interface Comptroller extends Contract {
  methods: ComptrollerMethods
}
