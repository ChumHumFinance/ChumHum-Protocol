import { Map } from 'immutable';

import { Event } from './Event';
import { World } from './World';
import { accountMap } from './Accounts';
import { Contract } from './Contract';
import { mustString } from './Utils';

import { CErc20Delegate } from './Contract/CErc20Delegate';
import { CHUM } from './Contract/CHUM';
import { BUM } from './Contract/BUM';
import { Comptroller } from './Contract/Comptroller';
import { ComptrollerImpl } from './Contract/ComptrollerImpl';
import { BUMController } from './Contract/BUMController';
import { BUMControllerImpl } from './Contract/BUMControllerImpl';
import { BUMVault } from './Contract/BUMVault';
import { BUMVaultImpl } from './Contract/BUMVaultImpl';
import { CToken } from './Contract/CToken';
import { Governor } from './Contract/Governor';
import { Erc20 } from './Contract/Erc20';
import { InterestRateModel } from './Contract/InterestRateModel';
import { PriceOracle } from './Contract/PriceOracle';
import { Timelock } from './Contract/Timelock';

type ContractDataEl = string | Map<string, object> | undefined;

function getContractData(world: World, indices: string[][]): ContractDataEl {
  return indices.reduce((value: ContractDataEl, index) => {
    if (value) {
      return value;
    } else {
      return index.reduce((data: ContractDataEl, el) => {
        let lowerEl = el.toLowerCase();

        if (!data) {
          return;
        } else if (typeof data === 'string') {
          return data;
        } else {
          return (data as Map<string, ContractDataEl>).find((_v, key) => key.toLowerCase().trim() === lowerEl.trim());
        }
      }, world.contractData);
    }
  }, undefined);
}

function getContractDataString(world: World, indices: string[][]): string {
  const value: ContractDataEl = getContractData(world, indices);

  if (!value || typeof value !== 'string') {
    throw new Error(
      `Failed to find string value by index (got ${value}): ${JSON.stringify(
        indices
      )}, index contains: ${JSON.stringify(world.contractData.toJSON())}`
    );
  }

  return value;
}

export function getWorldContract<T>(world: World, indices: string[][]): T {
  const address = getContractDataString(world, indices);

  return getWorldContractByAddress<T>(world, address);
}

export function getWorldContractByAddress<T>(world: World, address: string): T {
  const contract = world.contractIndex[address.toLowerCase()];

  if (!contract) {
    throw new Error(
      `Failed to find world contract by address: ${address}, index contains: ${JSON.stringify(
        Object.keys(world.contractIndex)
      )}`
    );
  }

  return <T>(<unknown>contract);
}

export async function getTimelock(world: World): Promise<Timelock> {
  return getWorldContract(world, [['Contracts', 'Timelock']]);
}

export async function getUnitroller(world: World): Promise<Comptroller> {
  return getWorldContract(world, [['Contracts', 'Unitroller']]);
}

export async function getBUMUnitroller(world: World): Promise<Comptroller> {
  return getWorldContract(world, [['Contracts', 'BUMUnitroller']]);
}

export async function getMaximillion(world: World): Promise<Comptroller> {
  return getWorldContract(world, [['Contracts', 'Maximillion']]);
}

export async function getComptroller(world: World): Promise<Comptroller> {
  return getWorldContract(world, [['Contracts', 'Comptroller']]);
}

export async function getComptrollerImpl(world: World, comptrollerImplArg: Event): Promise<ComptrollerImpl> {
  return getWorldContract(world, [['Comptroller', mustString(comptrollerImplArg), 'address']]);
}
export async function getBUMController(world: World): Promise<BUMController> {
  return getWorldContract(world, [['Contracts', 'BUMController']]);
}

export async function getBUMControllerImpl(world: World, bumcontrollerImplArg: Event): Promise<BUMControllerImpl> {
  return getWorldContract(world, [['BUMController', mustString(bumcontrollerImplArg), 'address']]);
}
export async function getBUMVaultProxy(world: World): Promise<Comptroller> {
  return getWorldContract(world, [['Contracts', 'BUMVaultProxy']]);
}
export async function getBUMVaultImpl(world: World, bumvaultImplArg: Event): Promise<BUMVaultImpl> {
  return getWorldContract(world, [['BUMVault', mustString(bumvaultImplArg), 'address']]);
}
export async function getBUMVault(world: World): Promise<BUMVault> {
  return getWorldContract(world, [['Contracts', 'BUMVault']]);
}
export function getCTokenAddress(world: World, cTokenArg: string): string {
  return getContractDataString(world, [['cTokens', cTokenArg, 'address']]);
}

export function getCTokenDelegateAddress(world: World, cTokenDelegateArg: string): string {
  return getContractDataString(world, [['CTokenDelegate', cTokenDelegateArg, 'address']]);
}

export function getErc20Address(world: World, erc20Arg: string): string {
  return getContractDataString(world, [['Tokens', erc20Arg, 'address']]);
}

export function getGovernorAddress(world: World, governorArg: string): string {
  return getContractDataString(world, [['Contracts', governorArg]]);
}

export async function getPriceOracleProxy(world: World): Promise<PriceOracle> {
  return getWorldContract(world, [['Contracts', 'PriceOracleProxy']]);
}

export async function getPriceOracle(world: World): Promise<PriceOracle> {
  return getWorldContract(world, [['Contracts', 'PriceOracle']]);
}

export async function getCHUM(
  world: World,
  chumhumArg: Event
): Promise<CHUM> {
  return getWorldContract(world, [['CHUM', 'address']]);
}

export async function getCHUMData(
  world: World,
  chumhumArg: string
): Promise<[CHUM, string, Map<string, string>]> {
  let contract = await getCHUM(world, <Event>(<any>chumhumArg));
  let data = getContractData(world, [['CHUM', chumhumArg]]);

  return [contract, chumhumArg, <Map<string, string>>(<any>data)];
}

export async function getBUM(
  world: World,
  chumhumArg: Event
): Promise<BUM> {
  return getWorldContract(world, [['BUM', 'address']]);
}

export async function getBUMData(
  world: World,
  chumhumArg: string
): Promise<[BUM, string, Map<string, string>]> {
  let contract = await getBUM(world, <Event>(<any>chumhumArg));
  let data = getContractData(world, [['BUM', chumhumArg]]);

  return [contract, chumhumArg, <Map<string, string>>(<any>data)];
}

export async function getGovernorData(
  world: World,
  governorArg: string
): Promise<[Governor, string, Map<string, string>]> {
  let contract = getWorldContract<Governor>(world, [['Governor', governorArg, 'address']]);
  let data = getContractData(world, [['Governor', governorArg]]);

  return [contract, governorArg, <Map<string, string>>(<any>data)];
}

export async function getInterestRateModel(
  world: World,
  interestRateModelArg: Event
): Promise<InterestRateModel> {
  return getWorldContract(world, [['InterestRateModel', mustString(interestRateModelArg), 'address']]);
}

export async function getInterestRateModelData(
  world: World,
  interestRateModelArg: string
): Promise<[InterestRateModel, string, Map<string, string>]> {
  let contract = await getInterestRateModel(world, <Event>(<any>interestRateModelArg));
  let data = getContractData(world, [['InterestRateModel', interestRateModelArg]]);

  return [contract, interestRateModelArg, <Map<string, string>>(<any>data)];
}

export async function getErc20Data(
  world: World,
  erc20Arg: string
): Promise<[Erc20, string, Map<string, string>]> {
  let contract = getWorldContract<Erc20>(world, [['Tokens', erc20Arg, 'address']]);
  let data = getContractData(world, [['Tokens', erc20Arg]]);

  return [contract, erc20Arg, <Map<string, string>>(<any>data)];
}

export async function getCTokenData(
  world: World,
  cTokenArg: string
): Promise<[CToken, string, Map<string, string>]> {
  let contract = getWorldContract<CToken>(world, [['cTokens', cTokenArg, 'address']]);
  let data = getContractData(world, [['CTokens', cTokenArg]]);

  return [contract, cTokenArg, <Map<string, string>>(<any>data)];
}

export async function getCTokenDelegateData(
  world: World,
  cTokenDelegateArg: string
): Promise<[CErc20Delegate, string, Map<string, string>]> {
  let contract = getWorldContract<CErc20Delegate>(world, [['CTokenDelegate', cTokenDelegateArg, 'address']]);
  let data = getContractData(world, [['CTokenDelegate', cTokenDelegateArg]]);

  return [contract, cTokenDelegateArg, <Map<string, string>>(<any>data)];
}

export async function getComptrollerImplData(
  world: World,
  comptrollerImplArg: string
): Promise<[ComptrollerImpl, string, Map<string, string>]> {
  let contract = await getComptrollerImpl(world, <Event>(<any>comptrollerImplArg));
  let data = getContractData(world, [['Comptroller', comptrollerImplArg]]);

  return [contract, comptrollerImplArg, <Map<string, string>>(<any>data)];
}
export async function getBUMControllerImplData(
  world: World,
  bumcontrollerImplArg: string
): Promise<[BUMControllerImpl, string, Map<string, string>]> {
  let contract = await getComptrollerImpl(world, <Event>(<any>bumcontrollerImplArg));
  let data = getContractData(world, [['BUMController', bumcontrollerImplArg]]);

  return [contract, bumcontrollerImplArg, <Map<string, string>>(<any>data)];
}
export async function getBUMVaultImplData(
  world: World,
  bumvaultImplArg: string
): Promise<[BUMVaultImpl, string, Map<string, string>]> {
  let contract = await getBUMVaultImpl(world, <Event>(<any>bumvaultImplArg));
  let data = getContractData(world, [['BUMVault', bumvaultImplArg]]);

  return [contract, bumvaultImplArg, <Map<string, string>>(<any>data)];
}
export function getAddress(world: World, addressArg: string): string {
  if (addressArg.toLowerCase() === 'zero') {
    return '0x0000000000000000000000000000000000000000';
  }

  if (addressArg.startsWith('0x')) {
    return addressArg;
  }

  let alias = Object.entries(world.settings.aliases).find(
    ([alias, addr]) => alias.toLowerCase() === addressArg.toLowerCase()
  );
  if (alias) {
    return alias[1];
  }

  let account = world.accounts.find(account => account.name.toLowerCase() === addressArg.toLowerCase());
  if (account) {
    return account.address;
  }

  return getContractDataString(world, [
    ['Contracts', addressArg],
    ['cTokens', addressArg, 'address'],
    ['CTokenDelegate', addressArg, 'address'],
    ['Tokens', addressArg, 'address'],
    ['Comptroller', addressArg, 'address']
  ]);
}

export function getContractByName(world: World, name: string): Contract {
  return getWorldContract(world, [['Contracts', name]]);
}
